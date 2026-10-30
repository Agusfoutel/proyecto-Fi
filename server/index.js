import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { db, tx } from './db.js';
import { hashPassword, verifyPassword, startSession, loadSession, endSession, tooManyAttempts } from './auth.js';
import { initPush, getPublicKey, sendToUser } from './push.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const INVITE_CODE = process.env.INVITE_CODE || '';

const PALETTES = {
  bordo: { accent: '#6B1E2E', bg: '#F7F2F0' },
  bosque: { accent: '#1F5E45', bg: '#F2F5F2' },
  oceano: { accent: '#1E4E79', bg: '#F1F4F7' },
};
const MODES = ['light', 'dark', 'auto'];
const DEFAULT_CATEGORIES = ['Comida', 'Súper', 'Transporte', 'Salidas', 'Casa', 'Servicios', 'Ropa', 'Salud', 'Otros'];

const isYm = (v) => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const isDate = (v) => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v);
const isAmount = (v) => Number.isInteger(v) && v > 0 && v < 1e13;
const cleanText = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

const app = express();
app.disable('x-powered-by');
const trust = process.env.TRUST_PROXY;
app.set('trust proxy', trust === undefined ? 'loopback' : /^\d+$/.test(trust) ? Number(trust) : trust === 'true' ? true : trust);

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self'",
      "manifest-src 'self'",
      "worker-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  });
  next();
});

app.use('/api', express.json({ limit: '64kb' }));

// Las escrituras sólo se aceptan desde la propia app (header custom + JSON), lo que corta CSRF.
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && req.get('X-Fino') !== '1') return res.status(403).json({ error: 'Origen no permitido' });
  next();
});

function auth(req, res, next) {
  const user = loadSession(req, res);
  if (!user) return res.status(401).json({ error: 'No autenticado' });
  req.user = user;
  next();
}

const publicUser = (u) => ({
  id: u.id, username: u.username, name: u.name, palette: u.palette, mode: u.mode,
  carry: !!u.carry, onboarded: !!u.onboarded,
});
const publicMovement = (m) => ({
  id: m.id, type: m.type, amount: m.amount, desc: m.description, cat: m.category_id, date: m.date,
});

/* ---------- Auth ---------- */

app.get('/api/config', (req, res) => {
  res.json({ inviteRequired: !!INVITE_CODE });
});

app.post('/api/auth/register', (req, res) => {
  if (tooManyAttempts(req.ip)) return res.status(429).json({ error: 'Demasiados intentos. Probá en unos minutos.' });
  const username = cleanText(req.body?.username, 32).toLowerCase();
  const name = cleanText(req.body?.name, 40) || username;
  const password = String(req.body?.password ?? '');

  if (INVITE_CODE && String(req.body?.invite ?? '').trim() !== INVITE_CODE) {
    return res.status(403).json({ error: 'El código de invitación no es correcto.' });
  }
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return res.status(400).json({ error: 'El usuario tiene que tener 3 o más letras o números (sin espacios).' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña tiene que tener al menos 6 caracteres.' });
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
    return res.status(409).json({ error: 'Ese usuario ya existe.' });
  }

  const userId = tx(() => {
    const { lastInsertRowid } = db.prepare('INSERT INTO users (username, name, pass, created_at) VALUES (?, ?, ?, ?)')
      .run(username, name, hashPassword(password), Date.now());
    const insert = db.prepare('INSERT INTO categories (user_id, name, color, sort) VALUES (?, ?, ?, ?)');
    DEFAULT_CATEGORIES.forEach((cat, i) => insert.run(lastInsertRowid, cat, i, i));
    return Number(lastInsertRowid);
  });
  startSession(req, res, userId);
  res.status(201).json({ ok: true });
});

app.post('/api/auth/login', (req, res) => {
  if (tooManyAttempts(req.ip)) return res.status(429).json({ error: 'Demasiados intentos. Probá en unos minutos.' });
  const username = cleanText(req.body?.username, 32).toLowerCase();
  const password = String(req.body?.password ?? '');
  const user = db.prepare('SELECT id, pass FROM users WHERE username = ?').get(username);
  if (!user || !verifyPassword(password, user.pass)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }
  startSession(req, res, user.id);
  res.json({ ok: true });
});

app.post('/api/auth/logout', (req, res) => {
  endSession(req, res);
  res.json({ ok: true });
});

/* ---------- Datos ---------- */

app.get('/api/bootstrap', auth, (req, res) => {
  const uid = req.user.id;
  const categories = db.prepare('SELECT id, name, color, sort FROM categories WHERE user_id = ? ORDER BY sort, id').all(uid);
  const months = Object.fromEntries(
    db.prepare('SELECT ym, budget FROM months WHERE user_id = ? AND budget IS NOT NULL').all(uid).map((m) => [m.ym, m.budget]),
  );
  const movements = db.prepare('SELECT * FROM movements WHERE user_id = ? ORDER BY date DESC, id DESC').all(uid).map(publicMovement);
  res.json({ user: publicUser(req.user), categories, months, movements, pushKey: getPublicKey() });
});

app.patch('/api/me', auth, (req, res) => {
  const b = req.body || {};
  const u = { ...req.user };
  if (b.name !== undefined) u.name = cleanText(b.name, 40) || u.name;
  if (b.palette !== undefined && PALETTES[b.palette]) u.palette = b.palette;
  if (b.mode !== undefined && MODES.includes(b.mode)) u.mode = b.mode;
  if (b.carry !== undefined) u.carry = b.carry ? 1 : 0;
  if (b.onboarded !== undefined) u.onboarded = b.onboarded ? 1 : 0;
  db.prepare('UPDATE users SET name = ?, palette = ?, mode = ?, carry = ?, onboarded = ? WHERE id = ?')
    .run(u.name, u.palette, u.mode, u.carry, u.onboarded, u.id);
  res.json({ user: publicUser(u) });
});

function readMovement(body) {
  const type = body?.type === 'ingreso' ? 'ingreso' : 'gasto';
  const amount = Number(body?.amount);
  if (!isAmount(amount)) return { error: 'Monto inválido' };
  if (!isDate(body?.date)) return { error: 'Fecha inválida' };
  const categoryId = type === 'gasto' && body?.categoryId != null ? Number(body.categoryId) : null;
  return { type, amount, description: cleanText(body?.description, 80), categoryId, date: body.date };
}

function ownCategory(uid, id) {
  return id == null || !!db.prepare('SELECT 1 FROM categories WHERE id = ? AND user_id = ?').get(id, uid);
}

app.post('/api/movements', auth, (req, res) => {
  const m = readMovement(req.body);
  if (m.error) return res.status(400).json({ error: m.error });
  if (!ownCategory(req.user.id, m.categoryId)) return res.status(400).json({ error: 'Categoría inválida' });
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO movements (user_id, type, amount, description, category_id, date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(req.user.id, m.type, m.amount, m.description, m.categoryId, m.date, Date.now());
  res.status(201).json(publicMovement(db.prepare('SELECT * FROM movements WHERE id = ?').get(lastInsertRowid)));
});

app.patch('/api/movements/:id', auth, (req, res) => {
  const m = readMovement(req.body);
  if (m.error) return res.status(400).json({ error: m.error });
  if (!ownCategory(req.user.id, m.categoryId)) return res.status(400).json({ error: 'Categoría inválida' });
  const { changes } = db.prepare(`
    UPDATE movements SET type = ?, amount = ?, description = ?, category_id = ?, date = ?
    WHERE id = ? AND user_id = ?`).run(m.type, m.amount, m.description, m.categoryId, m.date, Number(req.params.id), req.user.id);
  if (!changes) return res.status(404).json({ error: 'No existe' });
  res.json(publicMovement(db.prepare('SELECT * FROM movements WHERE id = ?').get(Number(req.params.id))));
});

app.delete('/api/movements/:id', auth, (req, res) => {
  db.prepare('DELETE FROM movements WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

app.put('/api/months/:ym', auth, (req, res) => {
  if (!isYm(req.params.ym)) return res.status(400).json({ error: 'Mes inválido' });
  const budget = req.body?.budget == null ? null : Number(req.body.budget);
  if (budget !== null && !isAmount(budget)) return res.status(400).json({ error: 'Monto inválido' });
  db.prepare(`
    INSERT INTO months (user_id, ym, budget) VALUES (?, ?, ?)
    ON CONFLICT(user_id, ym) DO UPDATE SET budget = excluded.budget`).run(req.user.id, req.params.ym, budget);
  res.json({ ym: req.params.ym, budget });
});

app.delete('/api/months/:ym', auth, (req, res) => {
  if (!isYm(req.params.ym)) return res.status(400).json({ error: 'Mes inválido' });
  tx(() => {
    db.prepare('DELETE FROM months WHERE user_id = ? AND ym = ?').run(req.user.id, req.params.ym);
    db.prepare("DELETE FROM movements WHERE user_id = ? AND substr(date, 1, 7) = ?").run(req.user.id, req.params.ym);
  });
  res.json({ ok: true });
});

app.post('/api/categories', auth, (req, res) => {
  const name = cleanText(req.body?.name, 24);
  if (!name) return res.status(400).json({ error: 'Poné un nombre' });
  const color = Math.abs(Number.parseInt(req.body?.color, 10) || 0) % 10;
  const { next } = db.prepare('SELECT COALESCE(MAX(sort), -1) + 1 AS next FROM categories WHERE user_id = ?').get(req.user.id);
  const { lastInsertRowid } = db.prepare('INSERT INTO categories (user_id, name, color, sort) VALUES (?, ?, ?, ?)')
    .run(req.user.id, name, color, next);
  res.status(201).json(db.prepare('SELECT id, name, color, sort FROM categories WHERE id = ?').get(lastInsertRowid));
});

app.patch('/api/categories/:id', auth, (req, res) => {
  const cat = db.prepare('SELECT id, name, color, sort FROM categories WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.user.id);
  if (!cat) return res.status(404).json({ error: 'No existe' });
  if (req.body?.name !== undefined) cat.name = cleanText(req.body.name, 24) || cat.name;
  if (req.body?.color !== undefined) cat.color = Math.abs(Number.parseInt(req.body.color, 10) || 0) % 10;
  db.prepare('UPDATE categories SET name = ?, color = ? WHERE id = ?').run(cat.name, cat.color, cat.id);
  res.json(cat);
});

app.delete('/api/categories/:id', auth, (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

app.get('/api/export.csv', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT m.date, m.type, COALESCE(c.name, '') AS cat, m.description, m.amount
    FROM movements m LEFT JOIN categories c ON c.id = m.category_id
    WHERE m.user_id = ? ORDER BY m.date, m.id`).all(req.user.id);
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = ['fecha;tipo;categoria;descripcion;monto', ...rows.map((r) => [r.date, r.type, q(r.cat), q(r.description), r.amount].join(';'))];
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="fino-movimientos.csv"' });
  res.send('﻿' + lines.join('\r\n'));
});

/* ---------- Push ---------- */

app.post('/api/push/subscribe', auth, (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Suscripción inválida' });
  }
  db.prepare(`
    INSERT INTO push_subs (endpoint, user_id, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`)
    .run(endpoint, req.user.id, String(keys.p256dh), String(keys.auth), Date.now());
  res.json({ ok: true });
});

app.post('/api/push/unsubscribe', auth, (req, res) => {
  db.prepare('DELETE FROM push_subs WHERE endpoint = ? AND user_id = ?').run(String(req.body?.endpoint ?? ''), req.user.id);
  res.json({ ok: true });
});

app.post('/api/push/test', auth, async (req, res) => {
  const sent = await sendToUser(req.user.id, {
    title: '¡Listo! 🔔',
    body: 'Así te va a llegar el aviso de fin de mes para cargar tu sueldo.',
    url: '/',
    tag: 'prueba',
  });
  res.json({ sent });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'No encontrado' }));

/* ---------- App ---------- */

// El manifest toma los colores del estilo que eligió cada uno, así el ícono instalado combina.
app.get('/manifest.webmanifest', (req, res) => {
  const user = loadSession(req, res);
  const key = PALETTES[req.query.p] ? req.query.p : user && PALETTES[user.palette] ? user.palette : 'bordo';
  const p = PALETTES[key];
  res.set({ 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-cache' });
  res.send(JSON.stringify({
    name: 'fino — tu plata, clarita',
    short_name: 'fino',
    description: 'Sabé en qué se te va la plata.',
    lang: 'es-AR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: p.bg,
    theme_color: p.bg,
    icons: [
      { src: `/icons/${key}-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `/icons/${key}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `/icons/${key}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }));
});

app.use(express.static(PUBLIC, {
  index: false,
  setHeaders(res, file) {
    const fresh = /\.(html|js|css|webmanifest)$/.test(file);
    res.set('Cache-Control', fresh ? 'no-cache' : 'public, max-age=604800');
    if (file.endsWith('sw.js')) res.set('Service-Worker-Allowed', '/');
  },
}));

const indexHtml = path.join(PUBLIC, 'index.html');
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.type('html').send(fs.readFileSync(indexHtml));
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: 'Algo salió mal' });
});

initPush();

// Si no nos dicen el puerto, escuchamos en los que suelen usar los paneles/Docker,
// así la app responde aunque el contenedor esté mapeado a cualquiera de ellos.
const ports = process.env.PORT ? [PORT] : [3000, 8080, 80];
let failed = 0;
for (const port of ports) {
  const server = http.createServer(app);
  server.on('error', (err) => {
    console.warn(`[fino] no pude usar el puerto ${port}: ${err.code || err.message}`);
    if (++failed === ports.length) process.exit(1);
  });
  server.listen(port, HOST, () => console.log(`fino corriendo en http://localhost:${port}`));
}
