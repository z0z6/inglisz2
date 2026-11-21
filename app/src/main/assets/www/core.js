'use strict';
/* ====================== Narzędzia ====================== */
const DAY = 864e5, MIN = 6e4, HOUR = 36e5;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const rnd = a => a[Math.floor(Math.random() * a.length)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function norm(s) {
  return String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[’`´]/g, "'").replace(/[^\p{L}\p{N}' -]/gu, ' ').replace(/\s+/g, ' ').trim();
}
function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i), cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}
function diffHtml(typed, target) {
  // prosta wizualizacja: wspólny prefiks/sufiks + różnica
  let i = 0; while (i < typed.length && i < target.length && typed[i].toLowerCase() === target[i].toLowerCase()) i++;
  let j = 0; while (j < typed.length - i && j < target.length - i && typed[typed.length - 1 - j].toLowerCase() === target[target.length - 1 - j].toLowerCase()) j++;
  const pre = target.slice(0, i), suf = target.slice(target.length - j);
  const tMid = target.slice(i, target.length - j), yMid = typed.slice(i, typed.length - j);
  return `<span class="diff">${esc(pre)}${yMid ? `<del>${esc(yMid)}</del>` : ''}${tMid ? `<ins>${esc(tMid)}</ins>` : ''}${esc(suf)}</span>`;
}
function fmtIvl(ms) {
  const m = ms / MIN;
  if (m < 60) return Math.max(1, Math.round(m)) + ' min';
  const h = m / 60; if (h < 24) return Math.round(h) + ' h';
  const d = h / 24; if (d < 30) return Math.round(d) + ' d';
  const mo = d / 30.4; if (mo < 12) return (mo < 10 ? mo.toFixed(1).replace('.0', '') : Math.round(mo)) + ' mies.';
  return (d / 365).toFixed(1).replace('.0', '') + ' l.';
}
function plural(n, one, few, many) {
  const n10 = n % 10, n100 = n % 100;
  if (n === 1) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}
const P = (n, a, b, c) => `${n} ${plural(n, a, b, c)}`;
function dayKey(ts) { const d = new Date(ts - 4 * HOUR); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function endOfDay(ts) { const d = new Date(ts); d.setHours(4, 0, 0, 0); if (d.getTime() <= ts) d.setDate(d.getDate() + 1); return d.getTime(); }
function keyToDate(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); }

/* ====================== Ikony (SF Symbols-like) ====================== */
const IC = {
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>',
  cards: '<rect x="7" y="4" width="13" height="16" rx="2.5" transform="rotate(8 13.5 12)"/><rect x="4" y="4" width="13" height="16" rx="2.5"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M8.5 8h7M8.5 11.5h5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  minus: '<path d="M5 12h14"/>',
  expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/>',
  speaker: '<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" fill="currentColor" stroke="none"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  turtle: '<path d="M4 15c0-4 3.6-7 8-7s8 3 8 7z"/><path d="M8 15v3M16 15v3M20 13.5h1.5a1.5 1.5 0 0 0 0-3H20"/><path d="M9 8.5l1.5 3.5h3L15 8.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  wave: '<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0"/>',
  chev: '<path d="M1.5 1.5l5 5-5 5" />',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  flame: '<path d="M12 22c4.4 0 7-2.9 7-6.6 0-3.4-2.3-5.6-4-7.4-.4 2-1.4 3-2.6 3.6.3-3.3-1-6.6-4.4-9.1.2 3.4-1.4 5.5-3 7.6C3.7 11.7 5 22 12 22z"/>',
  brain: '<path d="M9.5 3.5a3 3 0 0 0-3 3 3 3 0 0 0-2.5 4.4A3.3 3.3 0 0 0 5.5 17a3 3 0 0 0 4 2.9V3.5z"/><path d="M14.5 3.5a3 3 0 0 1 3 3 3 3 0 0 1 2.5 4.4 3.3 3.3 0 0 1-1.5 6.1 3 3 0 0 1-4 2.9V3.5z"/>',
  headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="7" rx="2"/><rect x="16.5" y="14" width="4.5" height="7" rx="2"/>',
  camera: '<path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.8L9 3.5h6L16.7 6h1.8A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="3.8"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5.5-5.5L5 20"/>',
  wand: '<path d="M4 20L16 8M14 6l4 4"/><path d="M19 2.5v3M17.5 4h3M6 3v2M5 4h2M20 14v2M19 15h2" />',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/>',
  sparkles: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M4.5 20h15"/>',
  upload: '<path d="M12 20V9M7 13.5l5-5 5 5M4.5 4h15"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  bolt: '<path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12z"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7 14h10"/>',
  ear: '<path d="M7 9a5 5 0 0 1 10 0c0 3-2.5 4-3 6.5S12 21 9.5 21 7 19 7 19"/><path d="M10 9.5a2 2 0 0 1 4 0"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.1-1.6-1.1-2.8 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10.5" cy="7" r="1.2" fill="currentColor"/><circle cx="15" cy="7.5" r="1.2" fill="currentColor"/>',
  hand: '<path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V13c0 4.5-2.5 8-7 8-3 0-4.5-2-6-5l-1.2-2.4a1.5 1.5 0 0 1 2.6-1.4L8 14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  share: '<path d="M12 3v12M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7.5h14V12"/>',
  moonzz: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/><path d="M15 3h4l-4 4h4"/>',
};
function ic(name, extra = '') {
  return `<svg ${extra} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[name] || ''}</svg>`;
}
const chev = `<svg class="chev" viewBox="0 0 8 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC.chev}</svg>`;
const appIc = (name, color, cls = '') => `<span class="app-ic ic-${color} ${cls}">${ic(name)}</span>`;

/* ====================== Języki ====================== */
const LANGS = [
  ['en', 'Angielski', 'en-GB'], ['de', 'Niemiecki', 'de-DE'], ['es', 'Hiszpański', 'es-ES'], ['fr', 'Francuski', 'fr-FR'],
  ['it', 'Włoski', 'it-IT'], ['pt', 'Portugalski', 'pt-PT'], ['nl', 'Niderlandzki', 'nl-NL'], ['sv', 'Szwedzki', 'sv-SE'],
  ['no', 'Norweski', 'nb-NO'], ['da', 'Duński', 'da-DK'], ['fi', 'Fiński', 'fi-FI'], ['cs', 'Czeski', 'cs-CZ'],
  ['sk', 'Słowacki', 'sk-SK'], ['uk', 'Ukraiński', 'uk-UA'], ['ru', 'Rosyjski', 'ru-RU'], ['hr', 'Chorwacki', 'hr-HR'],
  ['lt', 'Litewski', 'lt-LT'], ['hu', 'Węgierski', 'hu-HU'], ['ro', 'Rumuński', 'ro-RO'], ['el', 'Grecki', 'el-GR'],
  ['tr', 'Turecki', 'tr-TR'], ['ja', 'Japoński', 'ja-JP'], ['ko', 'Koreański', 'ko-KR'], ['zh', 'Chiński', 'zh-CN'],
  ['ar', 'Arabski', 'ar-SA'], ['he', 'Hebrajski', 'he-IL'], ['pl', 'Polski', 'pl-PL'],
];
const langName = code => (LANGS.find(l => l[0] === code) || [code, code.toUpperCase()])[1];
function langTag(code) {
  if (code === 'en') return S.settings.accent || 'en-GB';
  return (LANGS.find(l => l[0] === code) || [code, code, code])[2];
}

/* ====================== Most do warstwy natywnej (Android) ====================== */
const Native = (() => {
  const A = window.Android;
  const has = !!A;
  const cbs = new Map(); let seq = 0;
  const listeners = {};
  window.NativeCB = {
    resolve(id, payload) {
      const cb = cbs.get(id); if (!cb) return; cbs.delete(id);
      let data = payload; try { data = JSON.parse(payload); } catch (e) { /* tekst */ }
      cb(data);
    },
    event(name, payload) {
      let data = payload; try { data = JSON.parse(payload); } catch (e) { }
      (listeners[name] || []).forEach(f => { try { f(data); } catch (e) { console.error(e); } });
    }
  };
  function call(method, ...args) {
    return new Promise(res => {
      const id = 'c' + (++seq); cbs.set(id, res);
      try { A[method](...args.map(a => a == null ? '' : String(a)), id); }
      catch (e) { cbs.delete(id); res({ ok: false, error: String(e) }); }
    });
  }
  const safe = (fn, fb) => { try { return fn(); } catch (e) { console.warn(e); return fb; } };

  // --- wersje zastępcze dla przeglądarki (podgląd/testy) ---
  let webVoices = [];
  if (!has && window.speechSynthesis) {
    const lv = () => webVoices = speechSynthesis.getVoices();
    lv(); speechSynthesis.onvoiceschanged = lv;
  }
  const ttsWaiters = new Map();

  return {
    has,
    on(name, fn) { (listeners[name] = listeners[name] || []).push(fn); },
    loadFile(name) { return has ? safe(() => A.loadFile(name), null) : localStorage.getItem('mnemo_' + name); },
    saveFile(name, content) { if (has) safe(() => A.saveFile(name, content)); else try { localStorage.setItem('mnemo_' + name, content); } catch (e) { } },
    speak(text, tag, rate = 1) {
      const id = 'u' + (++seq);
      return new Promise(res => {
        const done = () => { if (ttsWaiters.has(id)) { ttsWaiters.delete(id); res(); } };
        ttsWaiters.set(id, done);
        setTimeout(done, 1500 + String(text).length * 140 / rate); // bezpiecznik
        if (has) { safe(() => A.speak(String(text), tag, String(rate), id)); return; }
        if (!window.speechSynthesis) return done();
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text); u.lang = tag; u.rate = rate;
        const v = webVoices.find(v => v.lang === tag) || webVoices.find(v => v.lang.startsWith(tag.slice(0, 2)));
        if (v) u.voice = v;
        u.onend = done; u.onerror = done;
        speechSynthesis.speak(u);
      });
    },
    _ttsDone(id) { const f = ttsWaiters.get(id); if (f) f(); },
    stopSpeak() { if (has) safe(() => A.stopSpeak()); else window.speechSynthesis && speechSynthesis.cancel(); },
    canSpeak() { return has ? true : !!window.speechSynthesis; },
    canListen() { return has ? safe(() => A.canListen(), false) : !!(window.SpeechRecognition || window.webkitSpeechRecognition); },
    listen(tag) {
      if (has) return call('listen', tag);
      const R = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!R) return Promise.resolve({ ok: false, error: 'unsupported' });
      return new Promise(res => {
        const r = new R(); r.lang = tag; r.maxAlternatives = 5; r.interimResults = false;
        let got = false;
        r.onresult = e => { got = true; res({ ok: true, results: Array.from(e.results[0]).map(a => a.transcript) }); };
        r.onerror = e => { if (!got) { got = true; res({ ok: false, error: e.error }); } };
        r.onend = () => { if (!got) res({ ok: false, error: 'no-match' }); };
        r.start();
      });
    },
    stopListen() { if (has) safe(() => A.stopListen()); },
    vibrate(kind) {
      if (has) return safe(() => A.vibrate(kind));
      const p = { tick: 8, light: 12, success: [12, 60, 18], error: [40, 50, 40], heavy: 30, celebrate: [15, 40, 15, 40, 30] }[kind] || 10;
      navigator.vibrate && navigator.vibrate(p);
    },
    httpGet(url) {
      if (has) return call('httpGet', url);
      return fetch(url).then(async r => ({ status: r.status, body: await r.text() })).catch(e => ({ status: 0, error: String(e) }));
    },
    translate(text, from, to) { return has ? call('translate', text, from, to) : Promise.resolve({ ok: false, error: 'Tłumaczenie offline działa w aplikacji na Androidzie.' }); },
    scan(source) { return has ? call('scanText', source) : Promise.resolve({ ok: false, error: 'Skanowanie działa w aplikacji na Androidzie.' }); },
    exportFile(name, content) {
      if (has) return call('exportFile', name, content);
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type: 'application/json' })); a.download = name; a.click();
      return Promise.resolve({ ok: true });
    },
    importFile() {
      if (has) return call('importFile');
      return new Promise(res => {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,.csv,.txt,.tsv,text/*';
        inp.onchange = () => { const f = inp.files[0]; if (!f) return res({ ok: false }); f.text().then(t => res({ ok: true, text: t, name: f.name })); };
        inp.click();
      });
    },
    setReminders(json) { if (has) safe(() => A.setReminders(json)); },
    scheduleOnce(ts, title, body) { if (has) safe(() => A.scheduleOnce(String(ts), title, body)); },
    updateSummary(json) { if (has) safe(() => A.updateSummary(json)); },
    requestNotifications() { if (has) safe(() => A.requestNotifications()); else if (window.Notification) Notification.requestPermission(); },
    keepAwake(on) { if (has) safe(() => A.keepAwake(on ? 'true' : 'false')); },
    setBars(dark) { if (has) safe(() => A.setBars(dark ? 'true' : 'false')); },
    takeSharedText() { return has ? safe(() => A.takeSharedText(), '') : ''; },
    share(text) { if (has) safe(() => A.share(text)); else if (navigator.share) navigator.share({ text }); },
    openUrl(url) { if (has) safe(() => A.openUrl(url)); else window.open(url, '_blank'); },
    version() { return has ? safe(() => A.version(), '1.0') : 'web'; },
    exit() { if (has) safe(() => A.exit()); },
  };
})();
Native.on('ttsDone', id => Native._ttsDone(id));

/* ====================== Stan ====================== */
const DEFAULT_SETTINGS = {
  deck: 'en600', native: 'pl', dailyNew: 10, dailyMinutes: 10, sessionSize: 20, retention: 0.9,
  pretest: true, confidence: true, autoAdvance: true, breakMin: 20,
  modes: { mc: true, type: true, listen: true, speak: true, cloze: true },
  autoSpeak: true, accent: 'en-GB', rate: 0.95, onlineAudio: true, enrich: true,
  haptics: true, theme: 'auto', accentColor: 'blue', wall: 'sonoma',
  reminders: { on: true, times: ['08:00', '21:00'], anchors: ['po porannej kawie', 'przed snem'], stepNudge: true },
  handsfreeListen: true, onboarded: false,
};
let S = null;

function defaultState() {
  return { v: 1, created: Date.now(), settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), decks: {}, cards: [], nextId: 1, log: {}, calib: { sure: [0, 0], maybe: [0, 0] }, hyper: 0 };
}
function deepMerge(base, add) {
  for (const k in base) {
    if (add[k] === undefined) add[k] = JSON.parse(JSON.stringify(base[k]));
    else if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) deepMerge(base[k], add[k]);
  }
  return add;
}
function seedDeck(id) {
  const seed = window.SEED_DECKS && window.SEED_DECKS[id]; if (!seed) return;
  if (!S.decks[id]) S.decks[id] = { id, name: seed.name, lang: seed.lang, created: Date.now() };
  const have = new Set(S.cards.filter(c => c.d === id).map(c => c.w.toLowerCase()));
  seed.words.forEach(([w, t]) => {
    const k = w.toLowerCase(); if (have.has(k)) return; have.add(k);
    S.cards.push(newCard(id, w, t, 'seed'));
  });
}
function newCard(deck, w, t, src = 'user', extra = {}) {
  return Object.assign({ id: S.nextId++, d: deck, w: String(w).trim(), t: String(t || '').trim(), n: '', x: '', src, s: 0, st: 0, due: 0, S: 0, D: 0, last: 0, reps: 0, lap: 0, add: Date.now(), sus: false, h: [] }, extra);
}
function loadState() {
  try {
    const raw = Native.loadFile('state.json');
    if (raw) { S = JSON.parse(raw); S = deepMerge(defaultState(), S); S.settings = deepMerge(DEFAULT_SETTINGS, S.settings); }
  } catch (e) { console.error('state load', e); S = null; }
  if (!S) { S = defaultState(); seedDeck('en600'); }
  if (!S.decks[S.settings.deck]) S.settings.deck = Object.keys(S.decks)[0] || 'en600';
  CardIndex.rebuild();
}
const CardIndex = { map: new Map(), rebuild() { this.map = new Map(S.cards.map(c => [c.id, c])); }, get(id) { return this.map.get(id); } };
let saveTimer = null;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 400); }
function saveNow() {
  clearTimeout(saveTimer);
  Native.saveFile('state.json', JSON.stringify(S));
  pushSummary();
}
const deck = () => S.decks[S.settings.deck] || { id: S.settings.deck, name: '?', lang: 'en' };
const deckLang = () => deck().lang || 'en';
const deckCards = (id = S.settings.deck) => S.cards.filter(c => c.d === id);
function todayLog() { const k = dayKey(Date.now()); return S.log[k] || (S.log[k] = { n: 0, r: 0, ok: 0, ms: 0 }); }

/* ====================== Seria (z "zamrożeniem" – bez efektu "a co mi tam") ====================== */
function streakInfo() {
  const active = k => { const l = S.log[k]; return l && (l.n + l.r) >= 5; };
  let count = 0, freezesUsed = 0, lastFreezeAt = -99;
  const d = new Date(Date.now() - 4 * HOUR); d.setHours(12, 0, 0, 0);
  const todayK = dayKey(Date.now());
  const doneToday = active(todayK);
  for (let i = 0; i < 2000; i++) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (active(k)) count++;
    else if (i === 0) { /* dziś jeszcze nie – nie zrywa */ }
    else {
      const prev = new Date(d); prev.setDate(prev.getDate() - 1);
      const pk = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
      if (count > 0 && i - lastFreezeAt >= 7 && active(pk)) { freezesUsed++; lastFreezeAt = i; }
      else break;
    }
    d.setDate(d.getDate() - 1);
  }
  return { count, doneToday, freezesUsed };
}

/* ====================== Wygląd ====================== */
const ACCENTS = {
  blue: ['#007AFF', '#0A84FF'], purple: ['#9F4FD8', '#BF5AF2'], pink: ['#F7468A', '#FF5C9E'], red: ['#FF3B30', '#FF453A'],
  orange: ['#F7821B', '#FF9F0A'], yellow: ['#E8B400', '#FFD60A'], green: ['#34A853', '#32D74B'], graphite: ['#8C8C8C', '#98989D'],
};
const mqDark = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : { matches: false, addEventListener() { } };
function applyTheme() {
  const t = S.settings.theme;
  const dark = t === 'dark' || (t === 'auto' && mqDark.matches);
  const h = document.documentElement;
  h.classList.toggle('dark', dark);
  h.dataset.wall = S.settings.wall || 'sonoma';
  const [l, d] = ACCENTS[S.settings.accentColor] || ACCENTS.blue;
  const a = dark ? d : l;
  h.style.setProperty('--accent', a);
  h.style.setProperty('--accent-2', shade(a, 18));
  h.style.setProperty('--accent-soft', hexA(a, dark ? .22 : .12));
  Native.setBars(dark);
}
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function shade(hex, p) { const n = parseInt(hex.slice(1), 16); const f = c => clamp(Math.round(c + (255 - c) * p / 100), 0, 255); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
mqDark.addEventListener && mqDark.addEventListener('change', () => S && applyTheme());

/* ====================== Haptyka / mowa ====================== */
function haptic(kind) { if (S.settings.haptics) Native.vibrate(kind); }
function say(text, lang = deckLang(), rate) {
  if (!text) return Promise.resolve();
  return Native.speak(text, langTag(lang), rate || S.settings.rate);
}
const SPEECH_ERR = { 'no-match': 'nic nie usłyszałem', permission: 'brak zgody na mikrofon', network: 'brak sieci dla rozpoznawania mowy', language: 'ten język nie jest obsługiwany', unsupported: 'rozpoznawanie mowy niedostępne', busy: 'mikrofon zajęty', audio: 'problem z mikrofonem', cancelled: 'przerwano', 'not-allowed': 'brak zgody na mikrofon' };
const speechErr = e => SPEECH_ERR[e] || e || 'błąd';
function firstMeaning(t) { return String(t).split(/[;,(]/)[0].trim(); }
let currentAudio = null;
function playRecording(url) {
  try { if (currentAudio) currentAudio.pause(); currentAudio = new Audio(url); return currentAudio.play().catch(() => say(firstWordOfUrl(url))); }
  catch (e) { return Promise.resolve(); }
}
function firstWordOfUrl(u) { return decodeURIComponent(String(u).split('/').pop() || '').replace(/-(uk|us|au|ca).*$/, '').replace('.mp3', ''); }

/* ====================== Wzbogacanie (wymowa IPA, definicje, przykłady) ====================== */
const Enrich = {
  cache: {}, pending: {}, timer: null,
  load() { try { this.cache = JSON.parse(Native.loadFile('enrich.json') || '{}') || {}; } catch (e) { this.cache = {}; } },
  save() { clearTimeout(this.timer); this.timer = setTimeout(() => Native.saveFile('enrich.json', JSON.stringify(this.cache)), 800); },
  key(card) { return card.w.toLowerCase().trim(); },
  available(card) { return S.settings.enrich && (S.decks[card.d] || {}).lang === 'en' && /^[a-z][a-z' -]*$/i.test(card.w); },
  get(card) { return this.available(card) ? this.cache[this.key(card)] || null : null; },
  fetch(card) {
    if (!this.available(card)) return Promise.resolve(null);
    const k = this.key(card);
    if (this.cache[k] !== undefined) return Promise.resolve(this.cache[k]);
    if (this.pending[k]) return this.pending[k];
    const p = Native.httpGet('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(k)).then(res => {
      delete this.pending[k];
      if (!res) return null;
      if (res.status === 404) { this.cache[k] = null; this.save(); return null; }
      if (res.status !== 200) return null;
      try {
        const data = JSON.parse(res.body);
        const out = this.parse(data, k);
        this.cache[k] = out; this.save();
        return out;
      } catch (e) { return null; }
    });
    this.pending[k] = p;
    return p;
  },
  parse(data, word) {
    const entries = Array.isArray(data) ? data : [];
    let ph = '', au = '', auUS = '', auUK = '';
    const defs = [], syn = new Set();
    for (const e of entries) {
      if (!ph && e.phonetic) ph = e.phonetic;
      for (const p of e.phonetics || []) {
        if (!ph && p.text) ph = p.text;
        if (p.audio) { if (/-uk\./.test(p.audio)) auUK = auUK || p.audio; else if (/-us\./.test(p.audio)) auUS = auUS || p.audio; else au = au || p.audio; }
      }
      for (const m of e.meanings || []) {
        (m.synonyms || []).forEach(s => syn.size < 6 && s.toLowerCase() !== word && syn.add(s));
        const ds = (m.definitions || []).slice().sort((a, b) => (b.example ? 1 : 0) - (a.example ? 1 : 0));
        for (const d of ds.slice(0, 2)) {
          if (defs.length >= 4) break;
          defs.push({ p: m.partOfSpeech || '', d: d.definition || '', e: d.example || '' });
          (d.synonyms || []).forEach(s => syn.size < 6 && syn.add(s));
        }
      }
    }
    return { ph, uk: auUK, us: auUS, au, m: defs, syn: Array.from(syn) };
  },
  audioUrl(en) { if (!en || !S.settings.onlineAudio) return ''; return (S.settings.accent === 'en-US' ? (en.us || en.uk) : (en.uk || en.us)) || en.au || ''; },
  example(card) {
    const en = this.get(card); if (!en) return null;
    const w = card.w.toLowerCase(); const stem = w.length > 5 ? w.slice(0, Math.max(4, w.length - 3)) : w;
    for (const d of en.m) {
      if (!d.e) continue;
      const re = new RegExp(`\\b(${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[a-z]*)\\b`, 'i');
      const m = d.e.match(re);
      if (m) return { text: d.e, token: m[1], idx: m.index };
    }
    return null;
  },
  async prefetch(cards) { for (const c of cards) { if (this.available(c) && this.cache[this.key(c)] === undefined) { await this.fetch(c); await sleep(150); } } },
};

/* ====================== Podsumowanie dla widżetu i powiadomień ====================== */
function pushSummary() {
  if (!Native.has) return;
  const cs = deckCards().filter(c => !c.sus);
  const dueTimes = cs.filter(c => c.s > 0).map(c => c.due).sort((a, b) => a - b).slice(0, 3000);
  let words = cs.filter(c => c.s > 0).sort((a, b) => b.last - a.last).slice(0, 40);
  if (words.length < 8) words = words.concat(cs.filter(c => c.s === 0).slice(0, 8 - words.length));
  const st = streakInfo(); const tl = todayLog();
  Native.updateSummary(JSON.stringify({
    dueTimes, streak: st.count, doneToday: st.doneToday, studiedToday: tl.n + tl.r,
    newAvail: Math.min(cs.filter(c => c.s === 0).length, Math.max(0, S.settings.dailyNew - tl.n)),
    newTotal: Math.min(S.settings.dailyNew, cs.filter(c => c.s === 0 && c.t).length),
    words: words.map(c => ({ w: c.w, t: c.t })), anchors: S.settings.reminders.anchors, deck: deck().name,
  }));
}
function pushReminders() {
  Native.setReminders(JSON.stringify({ on: !!S.settings.reminders.on, times: S.settings.reminders.times, anchors: S.settings.reminders.anchors }));
}

/* ====================== UI: arkusze, toast ====================== */
let sheetStack = [];
function openSheet({ title = '', body = '', foot = '', center = false, onClose = null, cls = '' }) {
  const root = $('#sheet-root');
  const bd = document.createElement('div'); bd.className = 'backdrop';
  const sh = document.createElement('div'); sh.className = `sheet ${center ? 'center' : ''} ${cls}`;
  sh.innerHTML = (center ? '' : `<div class="sheet-bar"><div class="lights"><button class="light r" data-act="closeSheet" aria-label="Zamknij">${ic('x', 'stroke-width="3.2" stroke="#4d0000"')}</button><button class="light y" data-act="closeSheet">${ic('minus', 'stroke-width="3.2" stroke="#5c3d00"')}</button><button class="light g" style="opacity:.35"></button></div><div class="wt">${esc(title)}</div></div>`) +
    `<div class="sheet-body">${body}</div>` + (foot ? `<div class="sheet-foot">${foot}</div>` : '');
  bd.addEventListener('click', () => closeSheet());
  root.append(bd, sh);
  requestAnimationFrame(() => requestAnimationFrame(() => { bd.classList.add('show'); sh.classList.add('show'); }));
  const entry = { bd, sh, onClose };
  sheetStack.push(entry);
  return sh;
}
function closeSheet() {
  const e = sheetStack.pop(); if (!e) return false;
  e.bd.classList.remove('show'); e.sh.classList.remove('show');
  setTimeout(() => { e.bd.remove(); e.sh.remove(); }, 380);
  if (e.onClose) e.onClose();
  return true;
}
function closeAllSheets() { while (sheetStack.length) closeSheet(); }
function alertBox({ icon = 'info', color = 'blue', title, text = '', buttons = [{ label: 'OK', cls: 'primary' }] }) {
  return new Promise(res => {
    const id = 'al' + Date.now();
    const sh = openSheet({
      center: true, onClose: () => res(null),
      body: `<div class="alert">${appIc(icon, color)}<h3>${esc(title)}</h3>${text ? `<p>${text}</p>` : ''}<div class="btn-row" style="flex-direction:${buttons.length > 2 ? 'column' : 'row'}">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-al="${i}">${esc(b.label)}</button>`).join('')}</div></div>`
    });
    sh.querySelectorAll('[data-al]').forEach(b => b.addEventListener('click', ev => {
      ev.stopPropagation();
      const i = +b.dataset.al; const e = sheetStack[sheetStack.length - 1];
      if (e) e.onClose = null;
      closeSheet(); res(buttons[i].value !== undefined ? buttons[i].value : i);
    }));
  });
}
let toastTimer = null;
function toast(title, text = '', icon = 'sparkles', color = 'blue', ms = 2600) {
  const t = $('#toast');
  t.innerHTML = `${appIc(icon, color)}<div class="grow"><b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ''}</div>`;
  t.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
function confetti() {
  const box = document.createElement('div'); box.className = 'confetti';
  const colors = ['#FF3B30', '#FF9500', '#FFCC00', '#28CD41', '#007AFF', '#AF52DE', '#FF2D55'];
  for (let i = 0; i < 70; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + '%'; p.style.background = rnd(colors);
    p.style.animationDuration = (1.6 + Math.random() * 1.8) + 's'; p.style.animationDelay = (Math.random() * .4) + 's';
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.appendChild(p);
  }
  document.body.appendChild(box); setTimeout(() => box.remove(), 4000);
}

/* Rejestr akcji UI (data-act="nazwa") */
const ACT = {};
const getPath = (o, p) => p.split('.').reduce((a, k) => a == null ? a : a[k], o);
function setPath(o, p, v) { const ks = p.split('.'); const last = ks.pop(); const t = ks.reduce((a, k) => a[k], o); t[last] = v; }
