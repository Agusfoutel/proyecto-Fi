import webpush from 'web-push';
import { db, meta } from './db.js';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const TZ = process.env.NOTIFY_TZ || 'America/Argentina/Buenos_Aires';
const NOTIFY_HOUR = Number(process.env.NOTIFY_HOUR ?? 10);
const pad = (n) => String(n).padStart(2, '0');

let publicKey = null;

export function initPush() {
  let keys;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else {
    // Se generan una sola vez y quedan guardadas en la base: si cambiaran, las suscripciones dejarían de andar.
    const saved = meta.get('vapid');
    keys = saved ? JSON.parse(saved) : webpush.generateVAPIDKeys();
    if (!saved) meta.set('vapid', JSON.stringify(keys));
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hola@fino.app', keys.publicKey, keys.privateKey);
  publicKey = keys.publicKey;

  setTimeout(tick, 15 * 1000).unref();
  setInterval(tick, 5 * 60 * 1000).unref();
}

export const getPublicKey = () => publicKey;

export async function sendToUser(userId, payload) {
  const subs = db.prepare('SELECT endpoint, p256dh, auth FROM push_subs WHERE user_id = ?').all(userId);
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 36 * 3600 });
      sent += 1;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        db.prepare('DELETE FROM push_subs WHERE endpoint = ?').run(s.endpoint);
      } else {
        console.error('[push] error enviando a', userId, err.statusCode || err.message);
      }
    }
  }));
  return sent;
}

function nowInTz() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour) };
}

// El último día de cada mes (30, 31 o 28/29) avisa para cargar el sueldo del mes que viene.
async function tick() {
  const { y, m, d, h } = nowInTz();
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d !== lastDay || h < NOTIFY_HOUR) return;

  const key = `notified:${y}-${pad(m)}`;
  if (meta.get(key)) return;
  meta.set(key, String(Date.now()));

  const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1];
  const users = db.prepare('SELECT DISTINCT u.id, u.name FROM users u JOIN push_subs p ON p.user_id = u.id').all();
  for (const u of users) {
    const first = String(u.name).split(' ')[0];
    await sendToUser(u.id, {
      title: `Se termina ${MONTHS[m - 1]} 🗓️`,
      body: `¿Ya cobraste, ${first}? Cargá tu plata de ${MONTHS[nm - 1]}. Lo que te sobró se suma solo.`,
      url: `/?mes=${ny}-${pad(nm)}&cargar=1`,
      tag: `fin-de-mes-${y}-${pad(m)}`,
    });
  }
  console.log(`[push] aviso de fin de ${MONTHS[m - 1]} enviado a ${users.length} usuario(s)`);
}
