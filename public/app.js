'use strict';

(() => {
  /* =========================================================
   *  Constantes y utilidades
   * ========================================================= */

  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const CACHE_KEY = 'fino-cache-v1';

  // Cada estilo define el tema claro/oscuro y 10 colores armónicos para las categorías.
  // Las categorías guardan un índice de color, así al cambiar de estilo se recolorean solas.
  const PALETTES = {
    bordo: {
      name: 'Bordó',
      light: { accent: '#6B1E2E', accentInk: '#FFF5F4', soft: '#F4E3E4', bg: '#F7F2F0', surface: '#FFFFFF', surface2: '#F2EAE8', ink: '#2A1A1D', muted: '#8E7A7E', line: '#ECE2E0', shadow: 'rgba(107,30,46,0.45)', dim: 'rgba(20,8,12,0.42)' },
      dark: { accent: '#E4A7B2', accentInk: '#2A1016', soft: '#2A2023', bg: '#121012', surface: '#1B181A', surface2: '#242023', ink: '#F1EAE8', muted: '#978C8F', line: '#2B2629', shadow: 'rgba(0,0,0,0.6)', dim: 'rgba(0,0,0,0.6)' },
      cats: ['#B04A5E', '#D98896', '#8C6A72', '#7A2236', '#C49A86', '#E7AFBA', '#9A6288', '#C9705A', '#B5A4A7', '#6E4A5A'],
    },
    bosque: {
      name: 'Bosque',
      light: { accent: '#1F5E45', accentInk: '#F2FBF6', soft: '#E1EFE7', bg: '#F2F5F2', surface: '#FFFFFF', surface2: '#E9EFEA', ink: '#16231C', muted: '#728379', line: '#DFE7E1', shadow: 'rgba(31,94,69,0.45)', dim: 'rgba(8,20,14,0.42)' },
      dark: { accent: '#8FD3B0', accentInk: '#0E2A1E', soft: '#1D2A24', bg: '#0F1211', surface: '#171B19', surface2: '#1F2522', ink: '#E8F0EB', muted: '#8A9A90', line: '#262D29', shadow: 'rgba(0,0,0,0.6)', dim: 'rgba(0,0,0,0.6)' },
      cats: ['#2F7D5B', '#7FBF9A', '#5E7A6A', '#1F4D3A', '#A8B86A', '#4E8C8C', '#B9DCC6', '#D0A85C', '#A3ADA6', '#6B5E45'],
    },
    oceano: {
      name: 'Océano',
      light: { accent: '#1E4E79', accentInk: '#F2F7FC', soft: '#E1EBF5', bg: '#F1F4F7', surface: '#FFFFFF', surface2: '#E8EDF3', ink: '#14202C', muted: '#718296', line: '#DEE5EC', shadow: 'rgba(30,78,121,0.45)', dim: 'rgba(8,14,22,0.42)' },
      dark: { accent: '#8EC5EE', accentInk: '#0D2236', soft: '#1B2631', bg: '#0F1215', surface: '#171B1F', surface2: '#1F252B', ink: '#E8EEF4', muted: '#8895A3', line: '#262D34', shadow: 'rgba(0,0,0,0.6)', dim: 'rgba(0,0,0,0.6)' },
      cats: ['#2E6FA8', '#7DB4E0', '#5F7488', '#1C3F63', '#4FA3A5', '#6A6FB0', '#B7D5EE', '#D49A5C', '#A4AEB8', '#3D5A6E'],
    },
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const ymOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const todayIso = () => iso(new Date());
  const curYm = () => ymOf(new Date());
  const addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number); return ymOf(new Date(y, m - 1 + n, 1)); };
  const daysIn = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
  const monthName = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => (n < 0 ? '−' : '') + '$ ' + Math.round(Math.abs(n)).toLocaleString('es-AR');
  const fmtShort = (n) => {
    const a = Math.abs(n);
    if (a >= 1e6) return (n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + 'M';
    if (a >= 1e3) return Math.round(n / 1e3).toLocaleString('es-AR') + 'k';
    return String(Math.round(n));
  };
  const draftText = (v) => '$ ' + (v ? Number(v).toLocaleString('es-AR') : '0');
  const tint = (color, pct) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;
  const firstName = (u) => String(u?.name || u?.username || '').split(' ')[0];
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  const I = {
    moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    sun: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.5"/><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="12" y1="2" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="22"/><line x1="2" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="22" y2="12"/><line x1="4.9" y1="4.9" x2="6.6" y2="6.6"/><line x1="17.4" y1="17.4" x2="19.1" y2="19.1"/><line x1="4.9" y1="19.1" x2="6.6" y2="17.4"/><line x1="17.4" y1="6.6" x2="19.1" y2="4.9"/></g></svg>',
    pencil: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M14.5 3.5L20.5 9.5L9.5 20.5H3.5V14.5L14.5 3.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    bell: (s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
    wallet: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18"/><path d="M16 14.5h2"/></svg>',
    back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  };

  /* =========================================================
   *  Estado
   * ========================================================= */

  const blankForm = (type = 'gasto', date = todayIso()) => ({ id: null, type, amount: '', desc: '', cat: null, catManual: false, date, newCat: null });

  const S = {
    screen: 'loading',
    cfg: { inviteRequired: false },
    user: null,
    pushKey: null,
    cats: [],
    months: {},
    movs: [],
    view: curYm(),
    lastCur: curYm(),
    tab: 'movs',
    filter: null,
    confirmReset: false,
    sheet: null,
    sheetFresh: false,
    form: blankForm(),
    inline: blankForm(),
    bdraft: '',
    catEdit: null,
    auth: { mode: 'login', err: '', busy: false, v: {} },
    push: 'unknown',
    dark: false,
    lastSync: 0,
    focusNext: null,
    toastAction: null,
    chain: {},
  };

  /* =========================================================
   *  Tema
   * ========================================================= */

  function palette() {
    const key = S.user?.palette || localStorage.getItem('fino-last-palette') || 'bordo';
    return PALETTES[key] ? key : 'bordo';
  }

  function applyTheme() {
    const key = palette();
    const mode = S.user?.mode || 'auto';
    const dark = mode === 'dark' || (mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    const t = PALETTES[key][dark ? 'dark' : 'light'];
    const vars = {};
    for (const k in t) vars['--' + k] = t[k];
    const root = document.documentElement;
    for (const k in vars) root.style.setProperty(k, vars[k]);
    root.style.colorScheme = dark ? 'dark' : 'light';
    S.dark = dark;
    $('meta[name="theme-color"]').content = t.bg;
    $('meta[name="apple-mobile-web-app-status-bar-style"]').content = dark ? 'black' : 'default';
    $('link[rel="apple-touch-icon"]').href = `/icons/${key}-apple.png`;
    $('link[rel="icon"]').href = `/icons/${key}-192.png`;
    $('link[rel="manifest"]').href = `/manifest.webmanifest?p=${key}`;
    try {
      localStorage.setItem('fino-theme', JSON.stringify({ dark, vars }));
      localStorage.setItem('fino-last-palette', key);
    } catch (e) { /* almacenamiento no disponible */ }
  }

  const catColor = (c) => PALETTES[palette()].cats[(c?.color ?? 0) % 10];
  const catById = (id) => S.cats.find((c) => c.id === id) || null;

  /* =========================================================
   *  API y caché local
   * ========================================================= */

  async function api(method, path, body) {
    const opts = { method, credentials: 'same-origin', headers: { 'X-Fino': '1' } };
    if (method !== 'GET') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body ?? {});
    }
    let res;
    try {
      res = await fetch(path, opts);
    } catch (e) {
      throw Object.assign(new Error('Sin conexión'), { status: 0 });
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* respuesta vacía */ }
    if (res.status === 401 && !path.startsWith('/api/auth')) {
      signedOut();
      throw Object.assign(new Error('Tu sesión se cerró'), { status: 401 });
    }
    if (!res.ok) throw Object.assign(new Error(data?.error || 'Algo salió mal'), { status: res.status });
    return data;
  }

  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        user: S.user, cats: S.cats, months: S.months, pushKey: S.pushKey,
        movs: S.movs.filter((m) => typeof m.id === 'number'),
      }));
    } catch (e) { /* sin espacio o sin acceso */ }
  }

  function loadCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) { return null; }
  }

  async function refresh() {
    const d = await api('GET', '/api/bootstrap');
    const pending = S.movs.filter((m) => typeof m.id !== 'number');
    S.user = d.user;
    S.cats = d.categories;
    S.months = d.months;
    S.movs = [...pending, ...d.movements];
    S.pushKey = d.pushKey;
    S.lastSync = Date.now();
    saveCache();
    if (S.screen === 'loading' || S.screen === 'auth') S.screen = S.user.onboarded ? 'app' : 'style';
    applyTheme();
    render();
  }

  function signedOut() {
    try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* nada */ }
    Object.assign(S, { user: null, cats: [], months: {}, movs: [], sheet: null, screen: 'auth' });
    S.auth = { mode: 'login', err: '', busy: false, v: {} };
    applyTheme();
    render();
  }

  /* =========================================================
   *  Cálculos: arrastre de saldo entre meses
   * ========================================================= */

  // Cada mes arranca con lo que sobró del anterior + la plata cargada + ingresos extra.
  // La cadena empieza en el primer mes con monto cargado; antes de eso no se arrastra nada.
  function computeChain() {
    const agg = {};
    for (const m of S.movs) {
      const k = m.date.slice(0, 7);
      const a = agg[k] || (agg[k] = { spent: 0, income: 0 });
      if (m.type === 'gasto') a.spent += m.amount; else a.income += m.amount;
    }
    const keys = [...new Set([...Object.keys(S.months), ...Object.keys(agg)])].sort();
    const chain = {};
    if (!keys.length) return chain;
    const end = [keys[keys.length - 1], S.view, curYm()].sort().pop();
    let started = false;
    let prev = 0;
    for (let k = keys[0]; k <= end; k = addMonths(k, 1)) {
      const a = agg[k] || { spent: 0, income: 0 };
      const budget = S.months[k] ?? null;
      if (budget != null) started = true;
      const carry = started && S.user?.carry ? prev : 0;
      const total = carry + (budget || 0) + a.income;
      chain[k] = { carry, budget, income: a.income, spent: a.spent, total, remaining: total - a.spent };
      if (started) prev = chain[k].remaining;
    }
    return chain;
  }

  const statsOf = (ym) => S.chain[ym] || { carry: 0, budget: S.months[ym] ?? null, income: 0, spent: 0, total: 0, remaining: 0 };

  function catTotals(gastos) {
    const map = new Map();
    for (const g of gastos) {
      const k = g.cat ?? 'none';
      map.set(k, (map.get(k) || 0) + g.amount);
    }
    return [...map].map(([id, sum]) => {
      const c = id === 'none' ? null : catById(id);
      return { id, name: c ? c.name : 'Sin categoría', color: c ? catColor(c) : 'var(--muted)', sum };
    }).sort((a, b) => b.sum - a.sum);
  }

  function catsByUse() {
    const since = new Date(); since.setDate(since.getDate() - 90);
    const from = iso(since);
    const count = {};
    for (const m of S.movs) if (m.cat != null && m.date >= from) count[m.cat] = (count[m.cat] || 0) + 1;
    return [...S.cats].sort((a, b) => (count[b.id] || 0) - (count[a.id] || 0) || a.sort - b.sort);
  }

  function daysLeftIn(ym) {
    const cur = curYm();
    if (ym === cur) return daysIn(ym) - new Date().getDate() + 1;
    return ym > cur ? daysIn(ym) : 0;
  }

  function defaultDate() {
    const cur = curYm();
    if (S.view === cur) return todayIso();
    return S.view < cur ? `${S.view}-${pad(daysIn(S.view))}` : `${S.view}-01`;
  }

  // Si ya cargaste algo parecido antes, sugiere la misma categoría.
  function suggestCat(desc) {
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const q = norm(desc);
    if (q.length < 3) return null;
    const word = q.split(' ')[0];
    const hit = S.movs.find((m) => m.type === 'gasto' && m.cat != null && norm(m.desc) === q)
      || (word.length >= 3 && S.movs.find((m) => m.type === 'gasto' && m.cat != null && norm(m.desc).split(' ')[0] === word));
    return hit && catById(hit.cat) ? hit.cat : null;
  }

  /* =========================================================
   *  Render
   * ========================================================= */

  function render() {
    const keep = snapshotUi();
    S.chain = computeChain();
    const app = $('#app');
    if (S.screen === 'loading') app.innerHTML = '<div class="splash"><span class="logo">fino</span></div>';
    else if (S.screen === 'auth') app.innerHTML = authHtml();
    else if (S.screen === 'style') app.innerHTML = styleHtml();
    else if (S.screen === 'notif') app.innerHTML = notifHtml();
    else app.innerHTML = appHtml();
    if (S.screen !== S.shown) {
      S.shown = S.screen;
      app.firstElementChild?.classList.add('enter');
    }
    renderSheet();
    restoreUi(keep);
  }

  // Al re-renderizar se conserva el foco, el cursor y los scrolls, así nada "salta".
  function snapshotUi() {
    const a = document.activeElement;
    const scrolls = {};
    document.querySelectorAll('[data-scroll]').forEach((el) => { scrolls[el.dataset.scroll] = [el.scrollLeft, el.scrollTop]; });
    let sel = null;
    try { sel = a && a.id && a.selectionStart != null ? [a.selectionStart, a.selectionEnd] : null; } catch (e) { /* inputs sin selección */ }
    return { id: a && a.id, sel, scrolls, y: window.scrollY };
  }

  function restoreUi(k) {
    document.querySelectorAll('[data-scroll]').forEach((el) => {
      const s = k.scrolls[el.dataset.scroll];
      if (s) { el.scrollLeft = s[0]; el.scrollTop = s[1]; }
    });
    if (Math.abs(window.scrollY - k.y) > 1) window.scrollTo(0, k.y);
    const focusId = S.focusNext || k.id;
    S.focusNext = null;
    const el = focusId && document.getElementById(focusId);
    if (el && document.activeElement !== el) {
      el.focus({ preventScroll: true });
      if (k.sel && el.id === k.id) { try { el.setSelectionRange(k.sel[0], k.sel[1]); } catch (e) { /* type=date */ } }
    }
  }

  const segBtn = (label, on, attrs) => `<button type="button" class="${on ? 'on' : ''}" ${attrs}>${label}</button>`;

  /* ---------- Login / registro ---------- */

  function authHtml() {
    const reg = S.auth.mode === 'register';
    const v = S.auth.v;
    return `<div class="auth">
      <div class="auth-hero">
        <span class="logo">fino</span>
        <h1>Sabé en qué se te va <em>la plata</em>.</h1>
        <p>Cargás lo que gastás en dos toques y fino te muestra a dónde se fue. Sin vueltas.</p>
      </div>
      <div class="seg">
        ${segBtn('Entrar', !reg, 'data-a="auth-mode" data-v="login"')}
        ${segBtn('Crear cuenta', reg, 'data-a="auth-mode" data-v="register"')}
      </div>
      <form id="auth-form" novalidate>
        ${reg ? `<label for="a-name">¿Cómo te llamás?</label>
        <input id="a-name" name="name" class="field" data-in="auth" autocomplete="given-name" placeholder="Tu nombre" maxlength="40" value="${esc(v.name)}">` : ''}
        <label for="a-user">Usuario</label>
        <input id="a-user" name="username" class="field" data-in="auth" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="ej: agus" maxlength="32" value="${esc(v.username)}">
        <label for="a-pass">Contraseña</label>
        <input id="a-pass" name="password" type="password" class="field" data-in="auth" autocomplete="${reg ? 'new-password' : 'current-password'}" placeholder="${reg ? 'Mínimo 6 caracteres' : '••••••••'}" value="${esc(v.password)}">
        ${reg && S.cfg.inviteRequired ? `<label for="a-inv">Código de invitación</label>
        <input id="a-inv" name="invite" class="field" data-in="auth" autocomplete="off" placeholder="Te lo pasa quien administra fino" value="${esc(v.invite)}">` : ''}
        <div class="err" role="alert">${esc(S.auth.err)}</div>
        <button class="btn block" type="submit" ${S.auth.busy ? 'disabled' : ''}>${S.auth.busy ? 'Un segundo…' : reg ? 'Crear mi cuenta' : 'Entrar'}</button>
      </form>
      <p class="fine">Tu sesión queda abierta en este dispositivo hasta que la cierres.</p>
    </div>`;
  }

  async function doAuth(form) {
    const data = Object.fromEntries(new FormData(form));
    const reg = S.auth.mode === 'register';
    if (!data.username || !data.password) {
      S.auth.err = 'Completá usuario y contraseña.';
      return render();
    }
    S.auth.busy = true; S.auth.err = ''; render();
    try {
      await api('POST', reg ? '/api/auth/register' : '/api/auth/login', data);
      S.auth = { mode: 'login', err: '', busy: false, v: {} };
      S.screen = 'loading';
      S.view = curYm();
      await refresh();
      checkPush();
    } catch (e) {
      S.auth.busy = false;
      S.auth.err = e.message;
      render();
    }
  }

  /* ---------- Onboarding ---------- */

  function paletteGrid() {
    const current = palette();
    return `<div class="pal-grid">${Object.entries(PALETTES).map(([key, p]) => {
      const t = p[S.dark ? 'dark' : 'light'];
      const vars = `--pbg:${t.bg};--pink:${t.ink};--pacc:${t.accent};--pline:${t.line}`;
      return `<button type="button" class="pal-card ${key === current ? 'on' : ''}" style="${vars}" data-a="palette" data-v="${key}" aria-pressed="${key === current}">
        <span class="mini-logo">fino</span>
        <span class="mini-big">$ 84.500</span>
        <span class="mini-bar"><div></div></span>
        <span class="mini-dots">${p.cats.slice(0, 4).map((c) => `<i style="background:${c}"></i>`).join('')}</span>
        <span class="mini-btn"></span>
        <span class="pal-name">${p.name}</span>
      </button>`;
    }).join('')}</div>`;
  }

  function modeSeg() {
    const m = S.user?.mode || 'auto';
    return `<div class="seg">
      ${segBtn('Claro', m === 'light', 'data-a="mode" data-v="light"')}
      ${segBtn('Oscuro', m === 'dark', 'data-a="mode" data-v="dark"')}
      ${segBtn('Automático', m === 'auto', 'data-a="mode" data-v="auto"')}
    </div>`;
  }

  function styleHtml() {
    return `<div class="auth">
      <div class="steps"><i class="on"></i><i></i></div>
      <div class="auth-hero">
        <span class="logo">fino</span>
        <h1>Hola, ${esc(firstName(S.user))}. <em>Elegí tu estilo.</em></h1>
        <p>El clásico bordó, o el mismo diseño en verde o azul. Lo podés cambiar cuando quieras desde tu perfil.</p>
      </div>
      ${paletteGrid()}
      ${modeSeg()}
      <button class="btn block" data-a="onb-next">Me gusta este</button>
    </div>`;
  }

  function notifHtml() {
    const canAsk = S.push === 'off' || S.push === 'unknown';
    let hint = '';
    if (S.push === 'install') hint = '<div class="hint"><b>En iPhone:</b> tocá <b>Compartir</b> → <b>Agregar a inicio</b>, abrí fino desde ese ícono y activá los avisos en tu perfil.</div>';
    if (S.push === 'denied') hint = '<div class="hint">Los avisos están <b>bloqueados</b> en este navegador. Podés habilitarlos desde la configuración del sitio.</div>';
    if (S.push === 'unsupported') hint = '<div class="hint">Este navegador no permite avisos. Probá desde el celu con la app instalada.</div>';
    return `<div class="auth">
      <div class="steps"><i class="on"></i><i class="on"></i></div>
      <div class="onb-ic">${I.bell(34)}</div>
      <div class="auth-hero">
        <h1>Te aviso <em>a fin de mes</em>.</h1>
        <p>El último día de cada mes te llega un recordatorio para cargar tu sueldo. Lo que te sobró se suma solo al mes siguiente.</p>
      </div>
      ${hint}
      ${canAsk
        ? '<button class="btn block" data-a="onb-push">Activar avisos</button><button class="btn ghost block" data-a="onb-finish">Ahora no</button>'
        : '<button class="btn block" data-a="onb-finish">Empezar</button>'}
    </div>`;
  }

  /* ---------- App principal ---------- */

  function appHtml() {
    const v = S.view;
    const cur = curYm();
    const st = statsOf(v);
    const items = S.movs.filter((m) => m.date.startsWith(v));
    const [vy] = v.split('-').map(Number);
    const label = cap(monthName(v)) + (vy !== new Date().getFullYear() ? ' ' + vy : '');
    let content;
    if (S.tab === 'cats') content = catsHtml(items, v);
    else if (S.tab === 'sum') content = summaryHtml(st, items, v, cur);
    else content = movsHtml(items, v);

    return `<div class="app">
      <header class="top">
        <span class="logo">fino</span>
        <div class="month-nav">
          <button data-a="prev" aria-label="Mes anterior">‹</button>
          <span>${label}</span>
          <button data-a="next" aria-label="Mes siguiente">›</button>
        </div>
        <div class="top-actions">
          <button class="icon-btn" data-a="toggle-mode" aria-label="Cambiar a modo ${S.dark ? 'claro' : 'oscuro'}">${S.dark ? I.sun : I.moon}</button>
          <button class="avatar" data-a="settings" aria-label="Perfil y ajustes">${esc(firstName(S.user).charAt(0).toUpperCase() || 'f')}</button>
        </div>
      </header>
      <div class="layout">
        <aside class="side">
          ${heroHtml(st, items, v)}
          ${calloutsHtml(st, items, v, cur)}
          ${inlineFormHtml()}
        </aside>
        <main class="main">
          <div class="seg tabs">
            ${segBtn('Movimientos', S.tab === 'movs', 'data-a="tab" data-v="movs"')}
            ${segBtn('Categorías', S.tab === 'cats', 'data-a="tab" data-v="cats"')}
            ${segBtn('Resumen', S.tab === 'sum', 'data-a="tab" data-v="sum"')}
          </div>
          ${content}
        </main>
      </div>
      <div class="fab-wrap mobile-only">
        <button class="fab" data-a="open-add"><span class="plus">+</span> Agregar movimiento</button>
      </div>
    </div>`;
  }

  function heroHtml(st, items, v) {
    const name = monthName(v);
    const hasAny = st.budget != null || st.carry !== 0 || items.length > 0;
    if (!hasAny) {
      return `<section class="hero">
        <span class="eyebrow">Para arrancar</span>
        <h1>¿Con cuánta plata arrancás <em>${name}</em>?</h1>
        <button class="btn" data-a="open-budget">Cargar monto</button>
      </section>`;
    }
    if (st.total === 0) {
      return `<section class="hero">
        <span class="eyebrow">Llevás gastado</span>
        <div class="big">${fmt(st.spent)}</div>
        <button class="total-link" data-a="open-budget">Cargá con cuánto arrancás ${name} ${I.pencil}</button>
      </section>`;
    }
    const pct = st.total > 0 ? Math.min(100, Math.round((st.spent / st.total) * 100)) : 100;
    const left = daysLeftIn(v);
    const stats = left > 0
      ? `<span><b>${fmt(Math.max(0, st.remaining) / left)}</b> por día</span><span><b>${left}</b> ${left === 1 ? 'día' : 'días'}</span>`
      : `<span><b>${fmt(st.spent)}</b> gastados</span>`;
    const parts = [];
    if (st.carry) parts.push(`<span>${st.carry > 0 ? 'Sobró' : 'Faltó'} de ${monthName(addMonths(v, -1))} <b>${fmt(Math.abs(st.carry))}</b></span>`);
    if (st.budget) parts.push(`<span>Plata del mes <b>${fmt(st.budget)}</b></span>`);
    if (st.income) parts.push(`<span>Ingresos <b>${fmt(st.income)}</b></span>`);
    return `<section class="hero">
      <span class="eyebrow">${st.remaining < 0 ? 'Te pasaste por' : 'Te quedan'}</span>
      <div class="big ${st.remaining < 0 ? 'neg' : ''}">${fmt(Math.abs(st.remaining))}</div>
      <button class="total-link" data-a="open-budget">de ${fmt(st.total)} ${I.pencil}</button>
      <div class="progress"><div style="width:${pct}%"></div></div>
      <div class="hero-stats">${stats}</div>
      ${parts.length > 1 ? `<div class="breakdown">${parts.join('')}</div>` : ''}
    </section>`;
  }

  function calloutsHtml(st, items, v, cur) {
    const out = [];
    if (v >= cur && st.budget == null && (st.carry !== 0 || items.length)) {
      const extra = st.carry > 0 ? ` Se suma a los <b>${fmt(st.carry)}</b> que te sobraron.` : '';
      out.push(`<button class="callout" data-a="open-budget">
        <span class="ic">${I.wallet}</span>
        <p><b>¿Ya cobraste?</b> Cargá la plata de ${monthName(v)}.${extra}</p>
        <span class="go">›</span>
      </button>`);
    }
    const next = addMonths(cur, 1);
    if (v === cur && st.budget != null && new Date().getDate() >= daysIn(cur) - 1 && S.months[next] == null) {
      out.push(`<button class="callout" data-a="goto-budget" data-ym="${next}">
        <span class="ic">${I.bell(18)}</span>
        <p><b>Se termina ${monthName(cur)}.</b> ¿Ya cobraste? Cargá la plata de ${monthName(next)}.</p>
        <span class="go">›</span>
      </button>`);
    }
    return out.join('');
  }

  function movsHtml(items, v) {
    let list = items;
    let pill = '';
    if (S.filter != null) {
      list = items.filter((m) => m.type === 'gasto' && (S.filter === 'none' ? m.cat == null : m.cat === S.filter));
      const c = S.filter === 'none' ? null : catById(S.filter);
      pill = `<button class="filter-pill" data-a="clear-filter"><span class="dot" style="background:${c ? catColor(c) : 'var(--muted)'}"></span>${esc(c ? c.name : 'Sin categoría')} <span class="muted">×</span></button>`;
    }
    if (!list.length) {
      const msg = S.filter != null ? 'No hay movimientos en esta categoría.' : `Todavía no cargaste nada en ${monthName(v)}.<br>Tocá <b>+ Agregar movimiento</b> cuando gastes algo.`;
      return `<div style="display:flex;flex-direction:column">${pill}<p class="empty">${msg}</p></div>`;
    }
    const t = todayIso();
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yIso = iso(y);
    const groups = {};
    for (const m of list) (groups[m.date] = groups[m.date] || []).push(m);
    const html = Object.keys(groups).sort().reverse().map((date) => {
      const [a, b, c] = date.split('-').map(Number);
      const label = date === t ? 'Hoy' : date === yIso ? 'Ayer' : new Date(a, b - 1, c).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' });
      const rows = groups[date];
      const net = rows.reduce((s, m) => s + (m.type === 'gasto' ? -m.amount : m.amount), 0);
      return `<div class="group">
        <div class="group-head"><span>${label}</span><span>${net > 0 ? '+' : ''}${fmt(net)}</span></div>
        ${rows.map(movRow).join('')}
      </div>`;
    }).join('');

    const reset = S.confirmReset
      ? `<div class="reset-row">¿Borrar todo ${monthName(v)}? <button class="link" data-a="cancel-reset">No</button><button class="btn sm" data-a="do-reset">Sí, borrar</button></div>`
      : '<div class="reset-row"><button class="link" data-a="ask-reset">Reiniciar mes</button></div>';
    return `<div style="display:flex;flex-direction:column;padding-top:6px">${pill}${html}${reset}</div>`;
  }

  function movRow(m) {
    const isIn = m.type === 'ingreso';
    const c = isIn ? null : catById(m.cat);
    const color = isIn ? 'var(--accent)' : c ? catColor(c) : 'var(--muted)';
    const title = m.desc || (isIn ? 'Ingreso' : c ? c.name : 'Gasto');
    const sub = isIn ? 'Ingreso' : c ? c.name : 'Sin categoría';
    const initial = isIn ? '+' : c ? c.name.charAt(0) : '·';
    return `<button class="mov ${typeof m.id === 'number' ? '' : 'pending'}" data-a="edit" data-id="${m.id}">
      <span class="badge" style="background:${tint(color, S.dark ? 22 : 13)};color:${S.dark ? `color-mix(in srgb, ${color} 55%, #fff)` : color}">${esc(initial)}</span>
      <span class="mov-main"><span class="mov-title">${esc(title)}</span><span class="mov-sub">${esc(sub)}</span></span>
      <span class="mov-amt ${isIn ? 'in' : ''}">${isIn ? '+ ' : '− '}${fmt(m.amount)}</span>
    </button>`;
  }

  function catsHtml(items, v) {
    const gastos = items.filter((m) => m.type === 'gasto');
    const manage = '<div class="reset-row"><button class="link" data-a="manage-cats">Editar mis categorías</button></div>';
    if (!gastos.length) return `<div class="cats-view"><p class="empty">Cuando cargues gastos de ${monthName(v)}, acá vas a ver en qué se va la plata.</p>${manage}</div>`;
    const spent = gastos.reduce((s, g) => s + g.amount, 0);
    const rows = catTotals(gastos);
    const max = rows[0].sum;
    return `<div class="cats-view">
      <div class="stack">${rows.map((r) => `<div style="flex:${r.sum};background:${r.color}"></div>`).join('')}</div>
      <div>${rows.map((r) => `<button class="cat-row" data-a="filter" data-id="${r.id}">
        <span class="dot" style="width:10px;height:10px;background:${r.color}"></span>
        <span class="name-wrap"><span>${esc(r.name)}</span><span class="bar" style="width:${Math.max(4, (r.sum / max) * 100)}%;background:${tint(r.color, 55)}"></span></span>
        <span class="pct">${Math.round((r.sum / spent) * 100)}%</span>
        <span class="amt">${fmt(r.sum)}</span>
        <span class="chev">›</span>
      </button>`).join('')}</div>
      ${manage}
    </div>`;
  }

  function summaryHtml(st, items, v, cur) {
    const gastos = items.filter((m) => m.type === 'gasto');
    const name = monthName(v);
    if (!gastos.length) {
      return `<p class="empty">Cuando cargues gastos de ${name}, acá te armo el resumen: en qué se te fue más, cómo venís contra el mes pasado y a qué ritmo gastás.</p>`;
    }
    const n = daysIn(v);
    const isCur = v === cur;
    const today = new Date().getDate();
    const elapsed = isCur ? today : v < cur ? n : 0;
    const spent = st.spent;
    const totals = catTotals(gastos);
    const top = totals[0];
    const topPct = Math.round((top.sum / spent) * 100);
    const biggest = gastos.reduce((a, b) => (b.amount > a.amount ? b : a));
    const avg = elapsed ? spent / elapsed : 0;
    const entered = (st.budget || 0) + st.income;

    // Comparación justa: si es el mes en curso, contra el mes pasado hasta el mismo día.
    const prev = addMonths(v, -1);
    const cutDay = isCur ? today : 31;
    const prevGastos = S.movs.filter((m) => m.type === 'gasto' && m.date.startsWith(prev) && Number(m.date.slice(8)) <= cutDay);
    const prevSpent = prevGastos.reduce((s, g) => s + g.amount, 0);

    let html = `<p class="insight full">En ${name} lo que más se te fue es <em>${esc(top.name)}</em>: ${fmt(top.sum)}, el ${topPct}% de lo que gastaste.</p>`;

    html += `<div class="kpis full">
      <div class="kpi"><span>Gastaste</span><b>${fmt(spent)}</b><small>${gastos.length} ${gastos.length === 1 ? 'gasto' : 'gastos'}</small></div>
      <div class="kpi"><span>Entró</span><b>${fmt(entered)}</b><small>${st.carry ? `+ ${fmt(st.carry)} del mes pasado` : 'sueldo + ingresos'}</small></div>
      <div class="kpi"><span>Por día</span><b>${fmt(avg)}</b><small>${elapsed ? `en ${elapsed} ${elapsed === 1 ? 'día' : 'días'}` : 'todavía no empezó'}</small></div>
      <div class="kpi"><span>El más grande</span><b>${fmt(biggest.amount)}</b><small>${esc(biggest.desc || catById(biggest.cat)?.name || 'Gasto')}</small></div>
    </div>`;

    if (isCur && st.total > 0 && elapsed > 0) {
      const projected = avg * n;
      const end = st.total - projected;
      const left = daysLeftIn(v);
      const tail = end >= 0
        ? ` y te sobrarían <b>${fmt(end)}</b>. Vas bien 👌`
        : `: te faltarían <b>${fmt(-end)}</b>. Para llegar, tratá de no pasar de <b>${fmt(Math.max(0, st.remaining) / left)}</b> por día.`;
      html += `<div class="card full"><h3>A este ritmo</h3><p class="forecast">Vas a gastar <b>${fmt(projected)}</b> en todo ${name}${tail}</p></div>`;
    }

    // Gasto por día
    const perDay = new Array(n).fill(0);
    for (const g of gastos) perDay[Number(g.date.slice(8)) - 1] += g.amount;
    const maxDay = Math.max(...perDay);
    const maxIdx = perDay.indexOf(maxDay);
    const [vy, vm] = v.split('-').map(Number);
    const maxLabel = new Date(vy, vm - 1, maxIdx + 1).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' });
    html += `<div class="card full">
      <h3>Gasto por día · el que más: ${maxLabel} (${fmt(maxDay)})</h3>
      <div class="bars">${perDay.map((d, i) => `<div class="${i === maxIdx ? 'hi' : ''} ${isCur && i === today - 1 ? 'today' : ''}" style="height:${maxDay ? Math.max(2, (d / maxDay) * 100) : 2}%" title="${i + 1}: ${fmt(d)}"></div>`).join('')}</div>
      <div class="bars-axis"><span>1</span><span>10</span><span>20</span><span>${n}</span></div>
    </div>`;

    // Contra el mes anterior
    if (prevSpent > 0) {
      const diff = spent - prevSpent;
      const pct = Math.round((Math.abs(diff) / prevSpent) * 100);
      const more = diff > 0;
      const when = isCur ? `que a esta altura de ${monthName(prev)}` : `que en ${monthName(prev)}`;
      const prevTotals = Object.fromEntries(catTotals(prevGastos).map((r) => [r.id, r.sum]));
      const ids = new Set([...totals.map((r) => r.id), ...Object.keys(prevTotals).map((k) => (k === 'none' ? 'none' : Number(k)))]);
      const deltas = [...ids].map((id) => {
        const now = totals.find((r) => r.id === id)?.sum || 0;
        const before = prevTotals[id] || 0;
        const c = id === 'none' ? null : catById(id);
        return { name: c ? c.name : 'Sin categoría', color: c ? catColor(c) : 'var(--muted)', d: now - before };
      }).filter((x) => x.d !== 0).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 4);
      html += `<div class="card">
        <h3>${pct === 0 ? `Casi lo mismo ${when}` : `Gastaste ${pct}% ${more ? 'más' : 'menos'} ${when}`}</h3>
        ${deltas.map((x) => `<div class="delta-row"><span class="dot" style="background:${x.color}"></span><span class="name">${esc(x.name)}</span><span class="d ${x.d > 0 ? 'up' : 'down'}">${x.d > 0 ? '↑ ' : '↓ '}${fmt(Math.abs(x.d))}</span></div>`).join('')}
      </div>`;
    }

    // Últimos 6 meses
    const cols = [];
    for (let i = 5; i >= 0; i--) {
      const k = addMonths(v, -i);
      const s = S.movs.filter((m) => m.type === 'gasto' && m.date.startsWith(k)).reduce((a, g) => a + g.amount, 0);
      cols.push({ k, s });
    }
    const maxM = Math.max(...cols.map((c) => c.s), 1);
    html += `<div class="card ${prevSpent > 0 ? '' : 'full'}">
      <h3>Últimos 6 meses</h3>
      <div class="months-chart">${cols.map((c) => `<div class="col ${c.k === v ? 'cur' : ''}">
        <span class="v">${c.s ? fmtShort(c.s) : ''}</span>
        <div class="bar" style="height:${Math.max(2, (c.s / maxM) * 100)}%"></div>
        <small>${monthName(c.k).slice(0, 3)}</small>
      </div>`).join('')}</div>
    </div>`;

    return `<div class="summary">${html}</div>`;
  }

  /* ---------- Formularios ---------- */

  function formFields(F, key, amountHtml) {
    const isG = F.type === 'gasto';
    let cats = '';
    if (isG) {
      if (F.newCat) {
        cats = `<div class="newcat">
          <input id="${key}-newcat" class="field center" data-in="newcat" data-f="${key}" placeholder="Nombre (ej: Gimnasio)" maxlength="24" value="${esc(F.newCat.name)}" enterkeyhint="done" autocomplete="off">
          ${swatchesHtml(F.newCat.color, `data-a="newcat-color" data-f="${key}"`)}
          <div class="row-actions">
            <button class="btn soft" data-a="newcat-cancel" data-f="${key}">Cancelar</button>
            <button class="btn" data-a="newcat-save" data-f="${key}">Crear</button>
          </div>
        </div>`;
      } else {
        cats = `<div class="${key === 'inline' ? 'chips-wrap' : 'chips-row'}" data-scroll="${key}-chips">
          ${catsByUse().map((c) => `<button class="chip ${F.cat === c.id ? 'on' : ''}" data-a="cat" data-f="${key}" data-id="${c.id}"><span class="dot" style="background:${catColor(c)}"></span>${esc(c.name)}</button>`).join('')}
          <button class="chip add" data-a="newcat" data-f="${key}">+ Nueva</button>
        </div>`;
      }
    }
    const t = todayIso();
    const y = new Date(); y.setDate(y.getDate() - 1);
    const quick = [['Hoy', t], ['Ayer', iso(y)]];
    const isQuick = quick.some((q) => q[1] === F.date);
    return `
      <div class="seg">
        ${segBtn('Gasto', isG, `data-a="ftype" data-f="${key}" data-v="gasto"`)}
        ${segBtn('Ingreso', !isG, `data-a="ftype" data-f="${key}" data-v="ingreso"`)}
      </div>
      ${amountHtml}
      <input id="${key}-desc" class="field center" data-in="desc" data-f="${key}" placeholder="${isG ? '¿En qué?' : '¿De dónde vino?'}" maxlength="80" value="${esc(F.desc)}" enterkeyhint="done" autocomplete="off">
      ${cats}
      <div class="date-row">
        ${quick.map((q) => `<button class="dchip ${F.date === q[1] ? 'on' : ''}" data-a="date" data-f="${key}" data-v="${q[1]}">${q[0]}</button>`).join('')}
        <input id="${key}-date" type="date" class="dchip ${isQuick ? '' : 'on'}" data-in="date" data-f="${key}" value="${F.date}" aria-label="Otra fecha">
      </div>`;
  }

  function swatchesHtml(selected, attrs) {
    return `<div class="swatches">${PALETTES[palette()].cats.map((c, i) => `<button class="swatch ${i === selected ? 'on' : ''}" style="background:${c}" ${attrs} data-v="${i}" aria-label="Color ${i + 1}"></button>`).join('')}</div>`;
  }

  function nextColor() {
    const used = new Set(S.cats.map((c) => c.color));
    for (let i = 0; i < 10; i++) if (!used.has(i)) return i;
    return S.cats.length % 10;
  }

  function inlineFormHtml() {
    const F = S.inline;
    const amount = `<input id="inline-amount" class="amount-in" data-in="amount" data-f="inline" inputmode="numeric" placeholder="$ 0" value="${F.amount ? draftText(F.amount) : ''}" autocomplete="off" aria-label="Monto">`;
    return `<section class="card inline-form desktop-only">
      ${formFields(F, 'inline', amount)}
      <button id="inline-submit" class="btn block" data-a="mov-save" data-f="inline" ${Number(F.amount) ? '' : 'disabled'}>${F.type === 'gasto' ? 'Agregar gasto' : 'Agregar ingreso'}</button>
    </section>`;
  }

  const keypadHtml = () => `<div class="keypad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫'].map((k) => `<button data-a="key" data-v="${k}" aria-label="${k === '⌫' ? 'Borrar' : k}">${k}</button>`).join('')}</div>`;

  /* ---------- Sheets ---------- */

  function renderSheet() {
    const root = $('#sheet');
    if (!S.sheet || S.screen !== 'app') {
      root.innerHTML = '';
      document.body.classList.remove('locked');
      return;
    }
    root.innerHTML = `<div class="sheet-wrap ${S.sheetFresh ? 'anim' : ''}">
      <div class="dim" data-a="close"></div>
      <div class="sheet" role="dialog" aria-modal="true" data-scroll="sheet">${sheetHtml()}</div>
    </div>`;
    S.sheetFresh = false;
    document.body.classList.add('locked');
    attachSwipe(root.querySelector('.sheet'));
  }

  function sheetHtml() {
    const k = S.sheet.kind;
    if (k === 'mov') return sheetMov();
    if (k === 'budget') return sheetBudget();
    if (k === 'settings') return sheetSettings();
    if (k === 'cats') return sheetCats();
    return '';
  }

  function sheetMov() {
    const F = S.form;
    const editing = F.id != null;
    const draft = `<div id="draft" class="draft ${F.amount ? 'has' : ''}">${draftText(F.amount)}</div>`;
    const dis = Number(F.amount) ? '' : 'disabled';
    const submit = editing
      ? `<div class="row-actions"><button class="btn danger" data-a="mov-del">Borrar</button><button id="submit" class="btn" data-a="mov-save" data-f="form" ${dis}>Guardar cambios</button></div>`
      : `<button id="submit" class="btn block" data-a="mov-save" data-f="form" ${dis}>${F.type === 'gasto' ? 'Agregar gasto' : 'Agregar ingreso'}</button>`;
    return `<div class="grab"></div>
      ${editing ? '<div class="sheet-title">Editar movimiento</div>' : ''}
      ${formFields(F, 'form', draft)}
      ${keypadHtml()}
      ${submit}`;
  }

  function sheetBudget() {
    const ym = S.sheet.ym;
    const st = statsOf(ym);
    const prevName = monthName(addMonths(ym, -1));
    let sub = 'Tu sueldo o la plata con la que arrancás el mes.';
    if (st.carry > 0) sub += `<br>Más <b>${fmt(st.carry)}</b> que te sobraron de ${prevName}: se suman solos.`;
    if (st.carry < 0) sub += `<br>Ojo: venís <b>${fmt(-st.carry)}</b> abajo de ${prevName}.`;
    return `<div class="grab"></div>
      <div class="sheet-title lg">Plata para ${monthName(ym)}</div>
      <p class="sheet-sub">${sub}</p>
      <div id="draft" class="draft ${S.bdraft ? 'has' : ''}">${draftText(S.bdraft)}</div>
      ${keypadHtml()}
      <button id="submit" class="btn block" data-a="budget-save" ${Number(S.bdraft) ? '' : 'disabled'}>Guardar</button>
      ${S.months[ym] != null ? '<button class="link" data-a="budget-clear" style="align-self:center">Quitar el monto de este mes</button>' : ''}`;
  }

  function pushRows() {
    switch (S.push) {
      case 'on':
        return `<button class="set-row" data-a="push-off"><span class="grow">Aviso de fin de mes<small>Activado en este dispositivo. Te llega el último día de cada mes.</small></span><span class="toggle on"></span></button>
          <button class="set-row" data-a="push-test"><span class="grow">Mandarme uno de prueba</span><span class="chev">›</span></button>`;
      case 'install':
        return '<div class="set-row"><span class="grow">Aviso de fin de mes<small>En iPhone, primero agregá fino a la pantalla de inicio (Compartir → Agregar a inicio) y abrilo desde ahí.</small></span></div>';
      case 'denied':
        return '<div class="set-row"><span class="grow">Aviso de fin de mes<small>Bloqueado en el navegador. Habilitalo desde la configuración del sitio.</small></span></div>';
      case 'unsupported':
        return '<div class="set-row"><span class="grow">Aviso de fin de mes<small>Este navegador no permite avisos (hace falta https y un navegador moderno).</small></span></div>';
      default:
        return '<button class="set-row" data-a="push-on"><span class="grow">Aviso de fin de mes<small>Te recuerdo cargar el sueldo el último día de cada mes.</small></span><span class="toggle"></span></button>';
    }
  }

  function sheetSettings() {
    const u = S.user;
    return `<div class="grab"></div>
      <div class="profile">
        <span class="avatar">${esc(firstName(u).charAt(0).toUpperCase())}</span>
        <div><b>${esc(u.name)}</b><small>@${esc(u.username)}</small></div>
      </div>
      <div class="set-section"><h4>Estilo</h4>${paletteGrid()}${modeSeg()}</div>
      <div class="set-section"><h4>Tu plata</h4><div class="set-group">
        <button class="set-row" data-a="carry"><span class="grow">Pasar lo que sobra al mes siguiente<small>Si te sobran $ 50.000 en un mes, el siguiente arranca con eso más tu sueldo.</small></span><span class="toggle ${u.carry ? 'on' : ''}"></span></button>
        <button class="set-row" data-a="manage-cats"><span class="grow">Categorías<small>${S.cats.length} etiquetas para tus gastos</small></span><span class="chev">›</span></button>
        <button class="set-row" data-a="export"><span class="grow">Descargar mis movimientos<small>Archivo para Excel o Google Sheets</small></span><span class="chev">↓</span></button>
      </div></div>
      <div class="set-section"><h4>Avisos</h4><div class="set-group">${pushRows()}</div></div>
      <button class="btn danger block" data-a="logout">Cerrar sesión</button>`;
  }

  function sheetCats() {
    const header = `<div class="grab"></div>
      <div style="display:flex;align-items:center;flex-shrink:0">
        <button class="icon-btn" data-a="${S.catEdit ? 'catm-cancel' : 'cats-back'}" aria-label="Volver">${I.back}</button>
        <div class="sheet-title" style="flex:1;padding:0">${S.catEdit ? (S.catEdit.id ? 'Editar categoría' : 'Nueva categoría') : 'Tus categorías'}</div>
        <span style="width:42px"></span>
      </div>`;
    if (S.catEdit) {
      const e = S.catEdit;
      return `${header}
        <input id="catm-name" class="field center" data-in="catname" placeholder="Nombre (ej: Gimnasio)" maxlength="24" value="${esc(e.name)}" autocomplete="off">
        ${swatchesHtml(e.color, 'data-a="catm-color"')}
        ${e.id && e.confirm ? '<p class="sheet-sub" style="margin:0">Los gastos de esta categoría van a quedar como <b>Sin categoría</b>.</p>' : ''}
        <div class="row-actions">
          ${e.id ? `<button class="btn danger" data-a="catm-del">${e.confirm ? '¿Seguro? Borrar' : 'Borrar'}</button>` : ''}
          <button class="btn" data-a="catm-save">Guardar</button>
        </div>`;
    }
    const count = {};
    for (const m of S.movs) if (m.cat != null) count[m.cat] = (count[m.cat] || 0) + 1;
    return `${header}
      <p class="sheet-sub" style="margin:0">Son las etiquetas de tus gastos. Tocá una para cambiarle el nombre o el color.</p>
      <div>${S.cats.map((c) => `<button class="catm-row" data-a="catm-edit" data-id="${c.id}">
        <span class="dot" style="width:12px;height:12px;background:${catColor(c)}"></span>
        <span class="grow">${esc(c.name)}</span>
        <small>${count[c.id] ? `${count[c.id]} ${count[c.id] === 1 ? 'movimiento' : 'movimientos'}` : ''}</small>
        <span class="muted">›</span>
      </button>`).join('')}</div>
      <button class="btn soft block" data-a="catm-new">+ Nueva categoría</button>`;
  }

  function openSheet(sheet) {
    S.sheet = sheet;
    S.sheetFresh = true;
    render();
  }

  function closeSheet(rerender = true) {
    S.sheet = null;
    S.catEdit = null;
    if (rerender) render();
  }

  // Deslizar hacia abajo para cerrar, como una app nativa.
  function attachSwipe(el) {
    let y0 = null;
    let dy = 0;
    el.addEventListener('touchstart', (e) => {
      if (el.scrollTop > 0 || e.target.closest('input, .chips-row')) { y0 = null; return; }
      y0 = e.touches[0].clientY; dy = 0;
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      if (y0 == null) return;
      dy = e.touches[0].clientY - y0;
      if (dy > 8) { el.style.transition = 'none'; el.style.transform = `translateY(${dy}px)`; }
    }, { passive: true });
    el.addEventListener('touchend', () => {
      if (y0 == null) return;
      el.style.transition = '';
      if (dy > 110) closeSheet(); else el.style.transform = '';
      y0 = null;
    });
  }

  /* ---------- Toast ---------- */

  let toastTimer = null;
  function toast(msg, action) {
    const el = $('#toast');
    el.innerHTML = `<div class="t" role="status"><span>${esc(msg)}</span>${action ? `<button data-a="toast-action">${esc(action.label)}</button>` : ''}</div>`;
    S.toastAction = action ? action.fn : null;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.innerHTML = ''; S.toastAction = null; }, action ? 5000 : 2600);
  }

  /* =========================================================
   *  Acciones
   * ========================================================= */

  function press(k) {
    const kind = S.sheet?.kind;
    if (kind !== 'mov' && kind !== 'budget') return;
    let v = kind === 'mov' ? S.form.amount : S.bdraft;
    v = k === '⌫' ? v.slice(0, -1) : (v + k).replace(/^0+/, '').slice(0, 11);
    if (kind === 'mov') S.form.amount = v; else S.bdraft = v;
    const d = $('#draft');
    if (d) { d.textContent = draftText(v); d.classList.toggle('has', !!v); }
    const s = $('#submit');
    if (s) s.disabled = !Number(v);
    if (navigator.vibrate) navigator.vibrate(5);
  }

  const toClient = (body, id) => ({ id, type: body.type, amount: body.amount, desc: body.description, cat: body.categoryId, date: body.date });

  async function submitMov(key) {
    const F = S[key];
    const amount = Number(F.amount);
    if (!amount) return;
    const body = { type: F.type, amount, description: F.desc.trim(), categoryId: F.type === 'gasto' ? F.cat : null, date: F.date };
    const ym = F.date.slice(0, 7);
    if (key === 'form') closeSheet(false);
    S[key] = blankForm(F.type, key === 'inline' ? F.date : todayIso());
    if (ym !== S.view) { S.view = ym; S.filter = null; }

    if (F.id != null) {
      const prev = S.movs.find((m) => m.id === F.id);
      S.movs = S.movs.map((m) => (m.id === F.id ? toClient(body, F.id) : m));
      render();
      try {
        const saved = await api('PATCH', `/api/movements/${F.id}`, body);
        S.movs = S.movs.map((m) => (m.id === F.id ? saved : m));
        saveCache();
        toast('Cambios guardados');
      } catch (e) {
        S.movs = S.movs.map((m) => (m.id === F.id ? prev : m));
        render();
        toast(`No se pudo guardar: ${e.message}`);
      }
      return;
    }
    await createMov(body, `${F.type === 'gasto' ? 'Gasto' : 'Ingreso'} de ${fmt(amount)} agregado`);
    if (key === 'inline') S.focusNext = 'inline-amount';
  }

  async function createMov(body, okMsg) {
    const temp = toClient(body, `tmp-${Date.now()}`);
    S.movs.unshift(temp);
    render();
    if (okMsg) toast(okMsg);
    try {
      const saved = await api('POST', '/api/movements', body);
      S.movs = S.movs.map((m) => (m.id === temp.id ? saved : m));
      saveCache();
      render();
    } catch (e) {
      S.movs = S.movs.filter((m) => m.id !== temp.id);
      render();
      toast(`No se pudo guardar: ${e.message}`);
    }
  }

  async function deleteMov(id) {
    const m = S.movs.find((x) => x.id === id);
    if (!m) return;
    S.movs = S.movs.filter((x) => x.id !== id);
    closeSheet(false);
    render();
    const body = { type: m.type, amount: m.amount, description: m.desc, categoryId: m.cat, date: m.date };
    toast('Movimiento borrado', { label: 'Deshacer', fn: () => createMov(body, 'Listo, lo recuperé') });
    try {
      await api('DELETE', `/api/movements/${id}`);
      saveCache();
    } catch (e) {
      S.movs.unshift(m);
      render();
      toast('No se pudo borrar');
    }
  }

  async function saveBudget(ym, value) {
    const prev = S.months[ym];
    if (value == null) delete S.months[ym]; else S.months[ym] = value;
    closeSheet(false);
    render();
    try {
      await api('PUT', `/api/months/${ym}`, { budget: value });
      saveCache();
      if (value != null) toast(`Listo: ${fmt(value)} para ${monthName(ym)}`);
    } catch (e) {
      if (prev == null) delete S.months[ym]; else S.months[ym] = prev;
      render();
      toast(`No se pudo guardar: ${e.message}`);
    }
  }

  async function updateMe(patch) {
    const prev = { ...S.user };
    Object.assign(S.user, patch);
    applyTheme();
    render();
    saveCache();
    try {
      const { user } = await api('PATCH', '/api/me', patch);
      S.user = user;
      saveCache();
    } catch (e) {
      S.user = prev;
      applyTheme();
      render();
      toast('No se pudo guardar el cambio');
    }
  }

  async function createCategory(name, color) {
    const existing = S.cats.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const c = await api('POST', '/api/categories', { name, color });
    S.cats.push(c);
    saveCache();
    return c;
  }

  /* ---------- Push ---------- */

  let swReg = null;
  function registerSW() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    swReg = navigator.serviceWorker.register('/sw.js').catch(() => null);
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.type === 'open' && e.data.url) handleDeepLink(new URL(e.data.url, location.origin));
    });
  }

  async function checkPush() {
    const supported = window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported) {
      S.push = isIOS() && !isStandalone() ? 'install' : 'unsupported';
    } else if (Notification.permission === 'denied') {
      S.push = 'denied';
    } else {
      const reg = await swReg;
      const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
      S.push = sub ? 'on' : 'off';
      // Re-sincroniza la suscripción por si el servidor la perdió o cambió de usuario en este equipo.
      if (sub && S.user) api('POST', '/api/push/subscribe', sub.toJSON()).catch(() => {});
    }
    render();
  }

  function b64ToBytes(b64) {
    const pad64 = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad64).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }

  async function enablePush() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        S.push = perm === 'denied' ? 'denied' : 'off';
        render();
        toast('No se activaron los avisos');
        return false;
      }
      const reg = await swReg;
      if (!reg || !S.pushKey) throw new Error('sin service worker');
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(S.pushKey) });
      await api('POST', '/api/push/subscribe', sub.toJSON());
      S.push = 'on';
      render();
      toast('Avisos activados 🔔');
      return true;
    } catch (e) {
      toast('No pude activar los avisos');
      return false;
    }
  }

  async function disablePush() {
    try {
      const reg = await swReg;
      const sub = reg && await reg.pushManager.getSubscription();
      if (sub) {
        await api('POST', '/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
    } catch (e) { /* nada */ }
    S.push = 'off';
    render();
  }

  async function logout() {
    await disablePush();
    try { await api('POST', '/api/auth/logout', {}); } catch (e) { /* igual cerramos local */ }
    signedOut();
  }

  /* ---------- Mapa de acciones (data-a) ---------- */

  const A = {
    prev() { S.view = addMonths(S.view, -1); afterMonthChange(); },
    next() { S.view = addMonths(S.view, 1); afterMonthChange(); },
    'toggle-mode'() { updateMe({ mode: S.dark ? 'light' : 'dark' }); },
    settings() { openSheet({ kind: 'settings' }); },
    'open-add'() { S.form = blankForm(S.form.type, defaultDate()); openSheet({ kind: 'mov' }); },
    edit(d) {
      const m = S.movs.find((x) => String(x.id) === d.id);
      if (!m || typeof m.id !== 'number') return;
      S.form = { id: m.id, type: m.type, amount: String(m.amount), desc: m.desc, cat: m.cat, catManual: true, date: m.date, newCat: null };
      openSheet({ kind: 'mov' });
    },
    'open-budget'() { S.bdraft = String(S.months[S.view] ?? ''); openSheet({ kind: 'budget', ym: S.view }); },
    'goto-budget'(d) { S.view = d.ym; S.filter = null; A['open-budget'](); },
    close() { closeSheet(); },
    tab(d) { S.tab = d.v; S.confirmReset = false; render(); },
    filter(d) { S.filter = d.id === 'none' ? 'none' : Number(d.id); S.tab = 'movs'; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
    'clear-filter'() { S.filter = null; render(); },
    'ask-reset'() { S.confirmReset = true; render(); },
    'cancel-reset'() { S.confirmReset = false; render(); },
    async 'do-reset'() {
      const ym = S.view;
      const before = { movs: S.movs, budget: S.months[ym] };
      S.movs = S.movs.filter((m) => !m.date.startsWith(ym));
      delete S.months[ym];
      S.confirmReset = false; S.filter = null;
      render();
      try {
        await api('DELETE', `/api/months/${ym}`);
        saveCache();
        toast(`${cap(monthName(ym))} quedó en cero`);
      } catch (e) {
        S.movs = before.movs;
        if (before.budget != null) S.months[ym] = before.budget;
        render();
        toast('No se pudo reiniciar el mes');
      }
    },
    ftype(d) { S[d.f].type = d.v; render(); },
    cat(d) {
      const F = S[d.f];
      const id = Number(d.id);
      F.cat = F.cat === id ? null : id;
      F.catManual = true;
      render();
    },
    newcat(d) { S[d.f].newCat = { name: '', color: nextColor() }; S.focusNext = `${d.f}-newcat`; render(); },
    'newcat-color'(d) { S[d.f].newCat.color = Number(d.v); render(); },
    'newcat-cancel'(d) { S[d.f].newCat = null; render(); },
    async 'newcat-save'(d) {
      const F = S[d.f];
      const name = F.newCat.name.trim();
      if (!name) { toast('Ponele un nombre'); return; }
      try {
        const c = await createCategory(name, F.newCat.color);
        F.cat = c.id; F.catManual = true; F.newCat = null;
        render();
        document.querySelector(`[data-scroll="${d.f}-chips"] .chip.on`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
        toast(`Categoría "${c.name}" creada`);
      } catch (e) {
        toast(`No se pudo crear: ${e.message}`);
      }
    },
    date(d) { S[d.f].date = d.v; render(); },
    key(d) { press(d.v); },
    'mov-save'(d) { submitMov(d.f || 'form'); },
    'mov-del'() { deleteMov(S.form.id); },
    'budget-save'() { const v = Number(S.bdraft); if (v) saveBudget(S.sheet.ym, v); },
    'budget-clear'() { saveBudget(S.sheet.ym, null); },
    palette(d) { if (S.user) updateMe({ palette: d.v }); },
    mode(d) { if (S.user) updateMe({ mode: d.v }); },
    carry() { updateMe({ carry: !S.user.carry }); },
    async 'push-on'() {
      if (S.push === 'install') return;
      await enablePush();
    },
    'push-off'() { disablePush(); toast('Avisos desactivados'); },
    async 'push-test'() {
      try {
        const { sent } = await api('POST', '/api/push/test', {});
        toast(sent ? 'Te mandé uno de prueba' : 'No encontré este dispositivo, activá los avisos de nuevo');
      } catch (e) { toast('No se pudo mandar'); }
    },
    'manage-cats'() { S.catEdit = null; S.sheet = { kind: 'cats' }; S.sheetFresh = !document.querySelector('.sheet'); render(); },
    'cats-back'() { S.sheet = { kind: 'settings' }; render(); },
    'catm-edit'(d) {
      const c = catById(Number(d.id));
      if (c) { S.catEdit = { id: c.id, name: c.name, color: c.color, confirm: false }; render(); }
    },
    'catm-new'() { S.catEdit = { id: null, name: '', color: nextColor(), confirm: false }; S.focusNext = 'catm-name'; render(); },
    'catm-color'(d) { S.catEdit.color = Number(d.v); render(); },
    'catm-cancel'() { S.catEdit = null; render(); },
    async 'catm-save'() {
      const e = S.catEdit;
      const name = e.name.trim();
      if (!name) { toast('Ponele un nombre'); return; }
      try {
        if (e.id) {
          const c = await api('PATCH', `/api/categories/${e.id}`, { name, color: e.color });
          S.cats = S.cats.map((x) => (x.id === c.id ? c : x));
        } else {
          await createCategory(name, e.color);
        }
        saveCache();
        S.catEdit = null;
        render();
      } catch (err) { toast(`No se pudo guardar: ${err.message}`); }
    },
    async 'catm-del'() {
      const e = S.catEdit;
      if (!e.confirm) { e.confirm = true; render(); return; }
      try {
        await api('DELETE', `/api/categories/${e.id}`);
        S.cats = S.cats.filter((c) => c.id !== e.id);
        S.movs = S.movs.map((m) => (m.cat === e.id ? { ...m, cat: null } : m));
        if (S.filter === e.id) S.filter = null;
        saveCache();
        S.catEdit = null;
        render();
        toast('Categoría borrada');
      } catch (err) { toast('No se pudo borrar'); }
    },
    export() { location.href = '/api/export.csv'; },
    logout() { logout(); },
    'auth-mode'(d) { S.auth.mode = d.v; S.auth.err = ''; render(); },
    'onb-next'() { S.screen = 'notif'; render(); },
    async 'onb-push'() { await enablePush(); A['onb-finish'](); },
    'onb-finish'() {
      S.screen = 'app';
      updateMe({ onboarded: true });
    },
    'toast-action'() {
      const fn = S.toastAction;
      $('#toast').innerHTML = '';
      S.toastAction = null;
      if (fn) fn();
    },
  };

  function afterMonthChange() {
    S.filter = null;
    S.confirmReset = false;
    if (!S.inline.amount) S.inline.date = defaultDate();
    render();
  }

  function handleDeepLink(url) {
    const mes = url.searchParams.get('mes');
    if (mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) S.view = mes;
    if (url.searchParams.has('cargar') && S.user && S.screen === 'app') {
      S.bdraft = String(S.months[S.view] ?? '');
      openSheet({ kind: 'budget', ym: S.view });
    } else {
      render();
    }
  }

  /* =========================================================
   *  Eventos
   * ========================================================= */

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-a]');
    if (!t) return;
    const fn = A[t.dataset.a];
    if (!fn) return;
    e.preventDefault();
    fn(t.dataset, t);
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    const kind = t.dataset.in;
    if (!kind) return;
    const F = t.dataset.f ? S[t.dataset.f] : null;
    if (kind === 'auth') { S.auth.v[t.name] = t.value; return; }
    if (kind === 'catname') { S.catEdit.name = t.value; return; }
    if (kind === 'newcat') { F.newCat.name = t.value; return; }
    if (kind === 'desc') {
      F.desc = t.value;
      if (F.type === 'gasto' && !F.catManual) {
        const sug = suggestCat(t.value);
        if (sug != null && sug !== F.cat) { F.cat = sug; render(); }
      }
      return;
    }
    if (kind === 'amount') {
      const digits = t.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 11);
      F.amount = digits;
      t.value = digits ? draftText(digits) : '';
      const btn = $('#inline-submit');
      if (btn) btn.disabled = !Number(digits);
    }
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.in === 'date' && t.value) { S[t.dataset.f].date = t.value; render(); }
  });

  document.addEventListener('submit', (e) => {
    if (e.target.id === 'auth-form') { e.preventDefault(); doAuth(e.target); }
  });

  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const inField = t.tagName === 'INPUT';
    if (e.key === 'Escape' && S.sheet) { closeSheet(); return; }
    if (e.key === 'Enter' && inField && t.dataset.f === 'inline' && (t.dataset.in === 'desc' || t.dataset.in === 'amount')) {
      e.preventDefault(); submitMov('inline'); return;
    }
    if (e.key === 'Enter' && inField && t.dataset.in === 'newcat') { e.preventDefault(); A['newcat-save']({ f: t.dataset.f }); return; }
    if (e.key === 'Enter' && inField && t.dataset.in === 'catname') { e.preventDefault(); A['catm-save'](); return; }
    if (e.key === 'Enter' && inField && t.dataset.in === 'desc') { e.preventDefault(); t.blur(); return; }
    // En compu, el teclado numérico también funciona dentro del sheet.
    const kind = S.sheet?.kind;
    if ((kind === 'mov' || kind === 'budget') && !inField && !e.metaKey && !e.ctrlKey) {
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); press('⌫'); }
      else if (e.key === 'Enter') { e.preventDefault(); kind === 'mov' ? submitMov('form') : A['budget-save'](); }
    }
  });

  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((S.user?.mode || 'auto') === 'auto') { applyTheme(); render(); }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !S.user) return;
    const cur = curYm();
    if (cur !== S.lastCur) {
      if (S.view === S.lastCur) S.view = cur;
      S.lastCur = cur;
    }
    if (Date.now() - S.lastSync > 30 * 1000) refresh().catch(() => {});
    else render();
  });

  /* =========================================================
   *  Arranque
   * ========================================================= */

  async function boot() {
    const url = new URL(location.href);
    const deepLink = url.searchParams.has('mes') || url.searchParams.has('cargar');
    if (deepLink) history.replaceState(null, '', '/');

    const cached = loadCache();
    if (cached?.user) {
      Object.assign(S, { user: cached.user, cats: cached.cats || [], months: cached.months || {}, movs: cached.movs || [], pushKey: cached.pushKey });
      S.screen = S.user.onboarded ? 'app' : 'style';
    }
    applyTheme();
    render();
    registerSW();

    try {
      await refresh();
    } catch (e) {
      if (e.status === 401 || !cached?.user) {
        if (e.status !== 401) S.auth.err = 'No hay conexión con el servidor.';
        S.screen = 'auth';
        render();
      } else {
        toast('Sin conexión: mostrando lo último guardado');
      }
    }
    if (S.user) {
      checkPush();
      if (deepLink) handleDeepLink(url);
    } else {
      api('GET', '/api/config').then((c) => { S.cfg = c; if (S.screen === 'auth') render(); }).catch(() => {});
    }
  }

  boot();
})();
