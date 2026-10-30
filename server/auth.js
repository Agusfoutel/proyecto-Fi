import crypto from 'node:crypto';
import { db } from './db.js';

const COOKIE = 'fino_s';
// 400 días: el máximo que aceptan los navegadores. Se renueva solo cada vez que entrás.
const MAX_AGE = 400 * 24 * 3600;
const SCRYPT = { N: 16384, r: 8, p: 1 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, SCRYPT);
  return `s1$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [version, salt, hash] = String(stored).split('$');
  if (version !== 's1' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(salt, 'hex'), expected.length, SCRYPT);
  return crypto.timingSafeEqual(expected, actual);
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export function readCookie(req, name = COOKIE) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

function cookie(req, value, maxAge) {
  const forced = process.env.COOKIE_SECURE;
  const secure = forced === 'true' || (forced !== 'false' && req.secure);
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

export function startSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  db.prepare('INSERT INTO sessions (token, user_id, created_at, seen_at, agent) VALUES (?, ?, ?, ?, ?)')
    .run(sha256(token), userId, now, now, String(req.get('user-agent') || '').slice(0, 200));
  res.append('Set-Cookie', cookie(req, token, MAX_AGE));
}

export function loadSession(req, res) {
  const token = readCookie(req);
  if (!token) return null;
  const key = sha256(token);
  const row = db.prepare(`
    SELECT s.seen_at, u.id, u.username, u.name, u.palette, u.mode, u.carry, u.onboarded
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ?`).get(key);
  if (!row) return null;

  const now = Date.now();
  if (now - row.seen_at > MAX_AGE * 1000) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(key);
    return null;
  }
  if (now - row.seen_at > 24 * 3600 * 1000) {
    db.prepare('UPDATE sessions SET seen_at = ? WHERE token = ?').run(now, key);
    res.append('Set-Cookie', cookie(req, token, MAX_AGE));
  }
  return row;
}

export function endSession(req, res) {
  const token = readCookie(req);
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(sha256(token));
  res.append('Set-Cookie', cookie(req, '', 0));
}

// Freno simple contra fuerza bruta: N intentos por IP cada 15 minutos.
const attempts = new Map();
export function tooManyAttempts(ip, limit = 12) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.reset < now) {
    attempts.set(ip, { count: 1, reset: now + 15 * 60 * 1000 });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of attempts) if (entry.reset < now) attempts.delete(ip);
}, 10 * 60 * 1000).unref();
