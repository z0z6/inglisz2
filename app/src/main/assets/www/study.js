'use strict';
/* =====================================================================
   SESJA NAUKI
   - kolejka: najpierw karty o najniższej szansie przypomnienia (R), nowe przeplatane
   - kroki nauki 1 min → 10 min (powtórki w krótkich odstępach), potem FSRS
   - tryby rosną w trudności wraz ze stabilnością pamięci (rozpoznanie → produkcja)
   ===================================================================== */
const Session = { active: false, paused: false, queue: [], cur: null };
const cur = () => CardIndex.get(Session.cur);
const MODE_LABEL = {
  intro: ['Nowe słowo', 'sparkles', 'indigo'], mc: ['Rozpoznaj znaczenie', 'list', 'blue'], mcr: ['Wybierz słowo', 'list', 'teal'],
  recall: ['Przypomnij sobie', 'brain', 'purple'], type: ['Napisz', 'keyboard', 'orange'], listen: ['Dyktando', 'ear', 'pink'],
  speak: ['Powiedz na głos', 'mic', 'red'], cloze: ['Uzupełnij zdanie', 'edit', 'green'],
};

function sessionCounts() {
  const now = Date.now(), eod = endOfDay(now);
  const cs = deckCards().filter(c => !c.sus);
  const due = cs.filter(c => c.s === 2 && c.due <= eod).length;
  const learn = cs.filter(c => (c.s === 1 || c.s === 3) && c.due <= now + 2 * MIN).length;
  const learnLater = cs.filter(c => (c.s === 1 || c.s === 3) && c.due > now + 2 * MIN).length;
  const newLeft = Math.min(cs.filter(c => c.s === 0).length, Math.max(0, S.settings.dailyNew - todayLog().n));
  return { due, learn, learnLater, newLeft, total: due + learn + newLeft };
}

function buildQueue(opts = {}) {
  const now = Date.now(), eod = endOfDay(now);
  const cs = deckCards().filter(c => !c.sus && c.t);
  const reviews = cs.filter(c => c.s === 2 && c.due <= eod).sort((a, b) => FSRS.cardR(a, now) - FSRS.cardR(b, now));
  const newLeft = opts.extraNew != null ? opts.extraNew : Math.max(0, S.settings.dailyNew - todayLog().n);
  const news = opts.noNew ? [] : cs.filter(c => c.s === 0)
    .sort((a, b) => (a.src === 'user' ? 0 : 1) - (b.src === 'user' ? 0 : 1) || a.id - b.id).slice(0, newLeft);
  const limit = opts.limit || S.settings.sessionSize;
  const revPick = reviews.slice(0, limit);
  const newPick = news.slice(0, Math.max(0, limit - revPick.length));
  const q = [];
  const step = newPick.length && revPick.length ? Math.max(1, Math.floor(revPick.length / newPick.length)) : 0;
  let ni = 0;
  revPick.forEach((c, i) => { q.push(c.id); if (step && (i + 1) % step === 0 && ni < newPick.length) q.push(newPick[ni++].id); });
  while (ni < newPick.length) q.push(newPick[ni++].id);
  return q;
}

async function startSession(opts = {}) {
  if (Session.active && Session.paused && !opts.fresh) { Session.paused = false; go('study'); renderStudy(true); return; }
  const q = buildQueue(opts);
  const learnDue = deckCards().some(c => (c.s === 1 || c.s === 3) && !c.sus && c.due <= Date.now() + 2 * MIN);
  if (!q.length && !learnDue) {
    const cnt = sessionCounts();
    const anyNew = deckCards().some(c => c.s === 0 && !c.sus);
    const r = await alertBox({
      icon: 'check', color: 'green', title: 'Na dziś wszystko zrobione',
      text: cnt.learnLater ? `${P(cnt.learnLater, 'słowo wróci', 'słowa wrócą', 'słów wróci')} za kilka minut – odstęp jest celowy.` : 'Pamięć najlepiej utrwala się z przerwami. Możesz jednak dołożyć kilka nowych słów.',
      buttons: [anyNew ? { label: '+5 nowych słów', cls: 'primary', value: 'more' } : null, { label: 'Tryb bez rąk', value: 'hf' }, { label: 'Zamknij', value: 'x' }].filter(Boolean)
    });
    if (r === 'more') startSession({ extraNew: 5, limit: 5, fresh: true });
    else if (r === 'hf') startHandsFree();
    return;
  }
  Object.assign(Session, {
    active: true, paused: false, queue: q, started: Date.now(), done: 0, ok: 0, newCount: 0, cur: null, lastId: null, lastMode: null,
    breakShown: false, focus: false, undo: null, renderedId: null, plannedTotal: q.length + deckCards().filter(c => (c.s === 1 || c.s === 3) && !c.sus).length,
  });
  Native.keepAwake(true);
  go('study');
  nextCard();
}

function pickNext() {
  const now = Date.now();
  const learning = deckCards().filter(c => (c.s === 1 || c.s === 3) && !c.sus);
  const dueL = learning.filter(c => c.due <= now).sort((a, b) => a.due - b.due);
  const cand = dueL.find(c => c.id !== Session.lastId);
  if (cand) return cand;
  while (Session.queue.length) {
    const c = CardIndex.get(Session.queue.shift());
    if (c && !c.sus && (c.s === 0 || c.s === 2)) return c;
  }
  if (dueL.length) return dueL[0];
  return learning.filter(c => c.due <= now + 2 * MIN).sort((a, b) => a.due - b.due)[0] || null;
}

function pickMode(c) {
  if (c.s === 0) return 'intro';
  const m = S.settings.modes;
  const many = deckCards().length >= 4;
  const avail = {
    mc: m.mc && many, mcr: m.mc && many, recall: true, type: m.type,
    listen: m.listen && Native.canSpeak(), speak: m.speak && Native.canListen(), cloze: m.cloze && m.type && !!Enrich.example(c),
  };
  let pool;
  if (c.s === 1 || c.s === 3) pool = c.st === 0 ? ['mc', 'mcr', 'mc', 'recall'] : ['type', 'mcr', 'listen', 'recall'];
  else if (c.S < 4) pool = ['mc', 'mcr', 'recall', 'listen', 'type'];
  else if (c.S < 21) pool = ['recall', 'type', 'listen', 'cloze', 'speak', 'mcr'];
  else pool = ['type', 'speak', 'cloze', 'recall', 'listen'];
  let opts = pool.filter(x => avail[x] && x !== Session.lastMode);
  if (!opts.length) opts = pool.filter(x => avail[x]);
  if (!opts.length) opts = ['recall'];
  const mode = rnd(opts); Session.lastMode = mode; return mode;
}

const SUFFIXES = ['ically', 'ly', 'tion', 'sion', 'ment', 'ness', 'ity', 'ive', 'able', 'ible', 'ous', 'ful', 'less', 'ance', 'ence', 'ise', 'ize', 'ate', 'al', 'ant', 'ent', 'er', 'ing', 'ed', 'y'];
const suffix = s => { const w = String(s).toLowerCase(); return SUFFIXES.find(x => w.endsWith(x)) || ''; };
function buildOptions(c, field) {
  // trudniejsze dystraktory: ta sama końcówka (część mowy) i podobna długość
  const pool = deckCards().filter(x => x.id !== c.id && norm(x[field]) !== norm(c[field]) && x.t);
  const cs = suffix(c.w), len = c.w.length;
  const scored = pool.map(x => ({ x, s: (cs && suffix(x.w) === cs ? 3 : 0) - Math.abs(x.w.length - len) * .3 + Math.random() * 2.5 }));
  scored.sort((a, b) => b.s - a.s);
  const picks = [], seen = new Set([norm(c[field])]);
  for (const { x } of scored) { const k = norm(x[field]); if (seen.has(k)) continue; seen.add(k); picks.push(x); if (picks.length === 3) break; }
  return shuffle([c, ...picks]).map(x => ({ id: x.id, text: x[field] }));
}

function nextCard() {
  clearTimeout(Session.advTimer);
  Native.stopListen();
  if (!Session.active) return;
  if (!Session.breakShown && S.settings.breakMin > 0 && Date.now() - Session.started > S.settings.breakMin * MIN) {
    Session.breakShown = true; return showBreak();
  }
  const c = pickNext();
  if (!c) return finishSession();
  Object.assign(Session, { advancing: false, cur: c.id, lastId: c.id, fb: null, hint: 0, conf: null, t0: Date.now(), tReveal: 0, opts: null, chosen: null, heard: null, listening: false, mnemoOpen: false, preChosen: null });
  Session.mode = pickMode(c);
  Session.phase = Session.mode === 'intro' ? (S.settings.pretest && deckCards().length >= 4 ? 'pretest' : 'learn') : 'ask';
  if (Session.mode === 'mc' || Session.phase === 'pretest') Session.opts = buildOptions(c, 't');
  if (Session.mode === 'mcr') Session.opts = buildOptions(c, 'w');
  renderStudy();
  const m = Session.mode;
  if (S.settings.autoSpeak && (m === 'intro' || m === 'mc' || m === 'recall')) setTimeout(() => Session.cur === c.id && say(c.w), 280);
  if (m === 'listen') setTimeout(() => Session.cur === c.id && say(c.w), 350);
  Enrich.fetch(c).then(en => { if (en && Session.cur === c.id) updateEnrichUI(c); });
  Enrich.prefetch(Session.queue.slice(0, 4).map(id => CardIndex.get(id)).filter(Boolean));
}

function takeSnap(c) {
  Session.undo = { card: JSON.parse(JSON.stringify(c)), log: Object.assign({}, todayLog()), done: Session.done, ok: Session.ok, newCount: Session.newCount, mode: Session.mode, calib: JSON.parse(JSON.stringify(S.calib)) };
}
function restoreSnap() {
  const u = Session.undo; if (!u) return null;
  const c = CardIndex.get(u.card.id); if (!c) return null;
  Object.keys(c).forEach(k => delete c[k]); Object.assign(c, JSON.parse(JSON.stringify(u.card)));
  Object.assign(todayLog(), u.log); Session.done = u.done; Session.ok = u.ok; Session.newCount = u.newCount; S.calib = u.calib;
  return c;
}

function applyGrade(c, g, mode, ms) {
  const now = Date.now(); const prevS = c.s;
  const r = FSRS.schedule(c, g, now, S.settings.retention);
  delete r.ivl; Object.assign(c, r);
  c.h = (c.h || []).concat([[now, g, Math.round(ms || 0), mode]]).slice(-30);
  const tl = todayLog(); tl.r++; if (g > 1) tl.ok++; tl.ms += Math.min(ms || 0, 60000);
  if (prevS === 2) tl.rv = (tl.rv || 0) + 1;
  if (prevS === 0) tl.n++;
  let leech = false;
  if (g === 1 && prevS === 2 && c.lap >= 5 && !c.leech) { c.leech = true; leech = true; }
  save();
  return { leech };
}

function finishAnswer(ok, g, extra = {}) {
  const c = cur(); if (!c || Session.advancing || (Session.fb && !extra.override)) return;
  const ms = (Session.tReveal || Date.now()) - Session.t0;
  takeSnap(c);
  const res = applyGrade(c, g, Session.mode, ms);
  Session.done++; if (ok) Session.ok++;
  if (extra.direct) { haptic('tick'); return advance(); }
  Session.fb = Object.assign({ ok, g, leech: res.leech }, extra);
  haptic(ok ? 'success' : 'error');
  renderStudy();
  if (['mcr', 'type', 'speak', 'cloze', 'listen'].includes(Session.mode) && S.settings.autoSpeak) say(c.w);
  if (ok && S.settings.autoAdvance && !extra.noAuto) Session.advTimer = setTimeout(advance, extra.almost ? 2400 : 1400);
}
function advance() {
  clearTimeout(Session.advTimer);
  if (Session.advancing) return;
  Session.advancing = true;
  const el = $('#flash');
  if (el) { el.classList.add('out'); setTimeout(nextCard, 180); } else nextCard();
}

/* ---------- Ocena odpowiedzi ---------- */
function speedGrade(ms, len, c, allowEasy = true) {
  const fast = 3000 + 300 * len, slow = 9000 + 500 * len;
  if (ms <= fast) return allowEasy && c.s === 2 && Session.hint === 0 ? 4 : 3;
  if (ms <= slow) return 3;
  return 2;
}
function evalTyped(typed, target) {
  const a = norm(typed), b = norm(target);
  if (!a) return { ok: false, empty: true };
  if (a === b) return { ok: true };
  const z = s => s.replace(/is(e|es|ed|ing|ation|ations)\b/g, 'iz$1').replace(/our\b/g, 'or').replace(/tre\b/g, 'ter');
  if (z(a) === z(b)) return { ok: true };
  const d = lev(a, b);
  if ((b.length >= 5 && d === 1) || (b.length >= 9 && d === 2)) return { ok: true, almost: true };
  return { ok: false, d };
}
function matchSpeech(results, w) {
  const b = norm(w);
  for (const alt of results || []) {
    const a = norm(alt);
    if (a === b || a.split(' ').includes(b)) return { ok: true, heard: alt };
  }
  for (const alt of results || []) {
    const a = norm(alt); const d = Math.min(lev(a, b), ...a.split(' ').map(t => lev(t, b)));
    if ((b.length >= 5 && d <= 1) || (b.length >= 9 && d <= 2)) return { ok: true, almost: true, heard: alt };
  }
  return { ok: false, heard: (results || [])[0] || '' };
}

/* ---------- Akcje sesji ---------- */
Object.assign(ACT, {
  opt(el) {
    if (Session.fb) return;
    const c = cur(); const i = +el.dataset.i; const o = Session.opts[i]; const ok = o.id === c.id;
    Session.chosen = i;
    const ms = Date.now() - Session.t0;
    finishAnswer(ok, ok ? (ms < 8000 ? 3 : 2) : 1, { noAuto: !ok });
  },
  pre(el) {
    if (Session.preChosen != null) return;
    const c = cur(); Session.preChosen = +el.dataset.i;
    const ok = Session.opts[Session.preChosen].id === c.id;
    haptic(ok ? 'success' : 'light');
    renderStudy();
    setTimeout(() => { if (Session.cur === c.id && Session.phase === 'pretest') { Session.phase = 'learn'; renderStudy(); } }, ok ? 900 : 1400);
  },
  preSkip() { Session.phase = 'learn'; renderStudy(); },
  learned() {
    if (Session.advancing) return;
    const c = cur(); takeSnap(c); saveMnemo(c);
    const now = Date.now();
    Object.assign(c, { s: 1, st: 0, S: FSRS.S0(3), D: FSRS.D0(3), due: now + MIN, last: now, reps: 1 });
    c.h = (c.h || []).concat([[now, 0, now - Session.t0, 'intro']]);
    todayLog().n++; todayLog().ms += Math.min(now - Session.t0, 90000);
    Session.newCount++; Session.done++; Session.ok++;
    save(); haptic('tick'); advance();
  },
  known() {
    if (Session.advancing) return;
    const c = cur(); takeSnap(c); saveMnemo(c);
    applyGrade(c, 4, 'intro', Date.now() - Session.t0); c.known = true;
    Session.newCount++; Session.done++; Session.ok++;
    save(); haptic('success'); toast('Oznaczone jako znane', `Sprawdzę je za ok. ${fmtIvl(c.due - Date.now())}.`, 'check', 'green', 1800); advance();
  },
  mnemo() { Session.mnemoOpen = !Session.mnemoOpen; renderStudy(); if (Session.mnemoOpen) setTimeout(() => $('#mn') && $('#mn').focus(), 50); },
  conf(el) {
    const v = el.dataset.v; Session.conf = v; Session.tReveal = Date.now();
    if (v === 'no') { Session.phase = 'check'; finishAnswer(false, 1, { noAuto: true, msg: 'Próba przypomnienia – nawet nieudana – przygotowuje mózg na zapamiętanie odpowiedzi.' }); return; }
    Session.phase = 'check'; haptic('tick'); renderStudy();
  },
  check(el) {
    const c = cur(); const yes = el.dataset.v === 'yes'; const sure = Session.conf === 'sure';
    const k = sure ? 'sure' : 'maybe'; S.calib[k][0]++; if (yes) S.calib[k][1]++;
    const ms = Session.tReveal - Session.t0;
    let g = yes ? (sure ? (ms < 2500 && c.s === 2 ? 4 : 3) : 2) : 1;
    const hyper = !yes && sure;
    if (hyper) S.hyper = (S.hyper || 0) + 1;
    finishAnswer(yes, g, { noAuto: !yes, hyper, quick: true });
  },
  reveal() { Session.tReveal = Date.now(); Session.phase = 'grade'; haptic('tick'); renderStudy(); },
  grade(el) { const g = +el.dataset.g; finishAnswer(g > 1, g, { direct: true }); },
  hint() {
    const c = cur(); if (Session.fb) return;
    Session.hint = Math.min(Session.hint + 1, Math.max(1, c.w.length - 1));
    const inp = $('#ans'); const v = inp ? inp.value : '';
    renderStudy(); const i2 = $('#ans'); if (i2) { i2.value = v; i2.focus(); }
    haptic('tick');
  },
  checkTyped() {
    if (Session.fb) return advance();
    const c = cur(); const inp = $('#ans'); const typed = inp ? inp.value : '';
    Session.typed = typed; Session.tReveal = Date.now();
    const mode = Session.mode;
    let target = c.w;
    if (mode === 'cloze') { const ex = Enrich.example(c); if (ex && norm(typed) === norm(ex.token)) target = ex.token; }
    const r = evalTyped(typed, target);
    const ms = Session.tReveal - Session.t0;
    let g;
    if (!r.ok) g = 1;
    else if (r.almost) g = 2;
    else g = speedGrade(ms, c.w.length, c, mode !== 'listen');
    if (Session.hint > 0 && g > 2) g = 2;
    finishAnswer(r.ok, g, { almost: r.almost, typed, noAuto: !r.ok, target });
  },
  override() {
    if (!Session.undo) return;
    const c = restoreSnap(); if (!c) return;
    Session.fb = null; Session.tReveal = Session.tReveal || Date.now();
    finishAnswer(true, 3, { override: true });
  },
  next() { advance(); },
  async speakAns() {
    const c = cur(); if (Session.listening || Session.fb) return;
    Session.listening = true; Session.heard = null; renderStudy(); haptic('tick');
    const res = await Native.listen(langTag(deckLang()));
    if (Session.cur !== c.id) return;
    Session.listening = false;
    if (!res || !res.ok) {
      Session.heard = { error: res && res.error || 'błąd' };
      renderStudy(); return;
    }
    Session.tReveal = Date.now();
    const m = matchSpeech(res.results, c.w);
    const ms = Session.tReveal - Session.t0;
    const g = m.ok ? (m.almost ? 3 : speedGrade(ms, 4, c)) : 1;
    finishAnswer(m.ok, g, { heard: m.heard, almost: m.almost, noAuto: !m.ok });
  },
  selfCheck() { Session.mode = 'recall'; Session.conf = 'maybe'; Session.tReveal = Date.now(); Session.phase = 'check'; renderStudy(); },
  async practice() {
    const c = cur(); if (Session.listening) return;
    Session.listening = true; Session.heard = null; renderStudy();
    const res = await Native.listen(langTag(deckLang()));
    if (Session.cur !== c.id) return;
    Session.listening = false;
    Session.heard = res && res.ok ? matchSpeech(res.results, c.w) : { error: res && res.error || 'błąd' };
    if (Session.heard.ok) haptic('success'); else if (!Session.heard.error) haptic('error');
    renderStudy();
  },
  sayWord() { const c = ACT._detailCard || cur(); c && say(c.w, S.decks[c.d] ? S.decks[c.d].lang : deckLang()); },
  sayWordSlow() { const c = ACT._detailCard || cur(); c && say(c.w, S.decks[c.d] ? S.decks[c.d].lang : deckLang(), Math.max(.5, S.settings.rate * .6)); },
  sayRec(el) { playRecording(el.dataset.url); },
  sayPl() { const c = cur(); c && say(firstMeaning(c.t), S.settings.native); },
  endSession() { finishSession(true); },
  pauseSession() { Session.paused = true; Native.keepAwake(false); go('home'); toast('Sesja wstrzymana', 'Wróć do niej z ekranu „Dziś”.', 'pause', 'yellow'); },
  focusMode() { Session.focus = !Session.focus; renderStudy(true); haptic('tick'); },
  undo() {
    const u = Session.undo; if (!u) return toast('Nie ma czego cofnąć', '', 'undo', 'gray', 1500);
    const c = restoreSnap(); if (!c) return;
    Session.undo = null; clearTimeout(Session.advTimer);
    if (Session.cur !== c.id) Session.queue.unshift(Session.cur);
    Object.assign(Session, { advancing: false, cur: c.id, lastId: c.id, fb: null, hint: 0, conf: null, t0: Date.now(), tReveal: 0, chosen: null, heard: null, listening: false, preChosen: null });
    Session.mode = u.mode === 'intro' && c.s === 0 ? 'intro' : u.mode;
    Session.phase = Session.mode === 'intro' ? 'learn' : 'ask';
    if (Session.mode === 'mc') Session.opts = buildOptions(c, 't');
    if (Session.mode === 'mcr') Session.opts = buildOptions(c, 'w');
    save(); renderStudy(); haptic('tick');
  },
});
function saveMnemo(c) { const t = $('#mn'); if (t) { c.n = t.value.trim(); save(); } }

/* ---------- Przerwa i podsumowanie ---------- */
async function showBreak() {
  haptic('light');
  const r = await alertBox({
    icon: 'moon', color: 'indigo', title: 'Czas na krótką przerwę',
    text: `Uczysz się od ${S.settings.breakMin} min. Kilka krótszych sesji w ciągu dnia daje trwalszą pamięć niż jeden długi maraton (efekt rozłożenia w czasie). Odpocznij oczy i wróć później.`,
    buttons: [{ label: 'Zakończ sesję', cls: 'primary', value: 'end' }, { label: 'Jeszcze chwilę', value: 'go' }]
  });
  if (r === 'go') nextCard(); else finishSession(true);
}

function finishSession() {
  if (!Session.active) return;
  Session.active = false; Session.paused = false;
  clearTimeout(Session.advTimer); Native.keepAwake(false); Native.stopListen();
  const now = Date.now(); const dur = now - Session.started;
  const soon = deckCards().filter(c => (c.s === 1 || c.s === 3) && !c.sus && c.due > now).sort((a, b) => a.due - b.due);
  if (soon.length && S.settings.reminders.stepNudge) {
    Native.scheduleOnce(soon[0].due + 30000, 'Szybka powtórka (1 min)', `${P(soon.length, 'słowo czeka', 'słowa czekają', 'słów czeka')} na drugie przypomnienie. Krótki odstęp teraz = dłuższa pamięć potem.`);
  }
  saveNow();
  go('home');
  if (!Session.done) return;
  const acc = Session.done ? Math.round(Session.ok / Session.done * 100) : 0;
  const tomorrow = deckCards().filter(c => c.s === 2 && !c.sus && c.due <= endOfDay(now) + DAY && c.due > endOfDay(now)).length;
  const st = streakInfo();
  const goalsDone = ringsData().every(r => r.p >= 1);
  const title = acc >= 90 ? 'Znakomicie!' : acc >= 75 ? 'Dobra robota!' : 'Solidny trening!';
  const msg = acc >= 95 ? 'Bardzo wysoka trafność – możesz zwiększyć liczbę nowych słów.' : acc < 70 ? 'Trudniej dziś? To normalne – wysiłek przy przypominaniu to właśnie „pożądana trudność”.' : 'Trafność w optymalnej strefie nauki (ok. 80–90%).';
  const sh = openSheet({
    title: 'Podsumowanie sesji',
    body: `<div class="center">${appIc('check', 'green', 'hero-ic')}<div class="h2">${title}</div><p class="muted small" style="margin:0 6px 14px">${esc(msg)}</p></div>
      <div class="kv"><div><small>Odpowiedzi</small><b>${Session.done}</b></div><div><small>Trafność</small><b>${acc}%</b></div>
      <div><small>Nowe słowa</small><b>${Session.newCount}</b></div><div><small>Czas</small><b>${Math.floor(dur / 60000)}:${String(Math.floor(dur / 1000) % 60).padStart(2, '0')}</b></div></div>
      ${soon.length ? `<div class="feedback hyper mt">⏳ <b>${P(soon.length, 'słowo wróci', 'słowa wrócą', 'słów wróci')} za ~${fmtIvl(soon[0].due - now)}</b> na krótkie przypomnienie.${S.settings.reminders.stepNudge ? ' Dam znać powiadomieniem.' : ''}</div>` : ''}
      <div class="group mt">
        <div class="item">${appIc('flame', 'orange')}<div class="label"><b>Seria</b><small>${st.doneToday ? 'Dzisiejszy dzień zaliczony' : 'Jeszcze kilka kart do zaliczenia dnia'}</small></div><div class="value">${P(st.count, 'dzień', 'dni', 'dni')}</div></div>
        <div class="item">${appIc('clock', 'blue')}<div class="label"><b>Jutro do powtórki</b></div><div class="value">${tomorrow}</div></div>
      </div>`,
    foot: `<div class="btn-row"><button class="btn" data-act="moreFive">Jeszcze 5</button><button class="btn primary" data-act="closeSheet">Gotowe</button></div>`
  });
  haptic(goalsDone ? 'celebrate' : 'success');
  if (goalsDone || acc >= 90) setTimeout(confetti, 300);
}
ACT.moreFive = () => { closeSheet(); setTimeout(() => startSession({ limit: 5, fresh: true, extraNew: Math.max(0, S.settings.dailyNew - todayLog().n) || 3 }), 250); };

/* ---------- Render sesji ---------- */
function audioButtons(c, big = false) {
  const en = Enrich.get(c); const url = Enrich.audioUrl(en);
  return `<div class="audio-row">
    <button class="icon-btn" data-act="sayWord" aria-label="Wymowa">${ic('speaker')}</button>
    <button class="icon-btn" data-act="sayWordSlow" aria-label="Wolno">${ic('turtle')}</button>
    ${url ? `<button class="icon-btn" data-act="sayRec" data-url="${esc(url)}" aria-label="Nagranie lektora">${ic('wave')}</button>` : ''}
  </div>`;
}
function enrichHtml(c, max = 3) {
  const en = Enrich.get(c); if (!en || !en.m || !en.m.length) return '';
  const w = c.w.toLowerCase(); const stem = w.length > 5 ? w.slice(0, Math.max(4, w.length - 3)) : w;
  const re = new RegExp(`\\b(${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[a-z]*)\\b`, 'gi');
  const hi = s => esc(s).replace(re, '<mark>$1</mark>');
  return en.m.slice(0, max).map(d => `<div><div class="def"><i>${esc(d.p)}</i>${esc(d.d)}</div>${d.e ? `<div class="ex">„${hi(d.e)}”</div>` : ''}</div>`).join('') +
    (en.syn && en.syn.length ? `<div class="chips">${en.syn.slice(0, 5).map(s => `<span class="chip">≈ ${esc(s)}</span>`).join('')}</div>` : '');
}
function updateEnrichUI(c) {
  const box = $('#enrich'); if (box) box.innerHTML = enrichHtml(c);
  const ipa = $('#ipa'); const en = Enrich.get(c); if (ipa && en && en.ph) ipa.textContent = en.ph;
  const ar = $('#audio-slot'); if (ar) ar.innerHTML = audioButtons(c);
}
function noteHtml(c) {
  return (c.n ? `<div class="note-box"><b>Twoje skojarzenie</b>${esc(c.n)}</div>` : '') + (c.x ? `<div class="note-box"><b>Twoje zdanie</b>${esc(c.x)}</div>` : '');
}
function stateChip(c) {
  if (c.s === 0) return '<span class="chip accent">nowe</span>';
  if (c.s === 1 || c.s === 3) return `<span class="chip orange">${c.s === 3 ? 'ponowna nauka' : 'nauka'}</span>`;
  const r = Math.round(FSRS.cardR(c, Date.now()) * 100);
  return `<span class="chip ${r >= 85 ? 'green' : r >= 70 ? 'orange' : 'red'}">pamięć ${r}%</span>`;
}
function inputAttrs() { return 'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"'; }
function hintLetters(c) {
  return c.w.split('').map((ch, i) => /\s/.test(ch) ? '&nbsp;' : (i < Session.hint ? esc(ch) : '_')).join('');
}

function feedbackHtml(c) {
  const fb = Session.fb; if (!fb) return '';
  const en = Enrich.get(c);
  let h = '';
  if (fb.hyper) h += `<div class="feedback hyper">🎯 <b>Błąd z wysoką pewnością.</b> Takie pomyłki poprawiają się najskuteczniej (efekt hiperkorekty) – przyjrzyj się odpowiedzi chwilę dłużej.</div>`;
  else if (fb.ok) h += `<div class="feedback ok">✓ <b>${fb.override ? 'Uznane za poprawne' : fb.almost ? 'Prawie! Drobna literówka' : rnd(['Dobrze!', 'Świetnie!', 'Tak jest!', 'Brawo!'])}</b>${fb.almost && fb.typed ? ` – ${diffHtml(fb.typed, fb.target || c.w)}` : ''}${fb.heard ? ` · usłyszałem „${esc(fb.heard)}”` : ''}</div>`;
  else h += `<div class="feedback bad">✗ <b>${fb.typed ? 'Poprawnie:' : 'Odpowiedź:'}</b> ${fb.typed && lev(norm(fb.typed), norm(c.w)) <= Math.max(2, Math.floor(c.w.length / 3)) ? diffHtml(fb.typed, c.w) : `<b>${esc(c.w)}</b>${fb.typed ? ` <span class="muted">(Ty: ${esc(fb.typed)})</span>` : ''}`}${fb.heard ? ` · usłyszałem „${esc(fb.heard)}”` : ''}${fb.msg ? `<div class="small muted mt">${esc(fb.msg)}</div>` : ''}</div>`;
  if (fb.leech) h += `<div class="feedback hyper">🧩 <b>To słowo wraca jak bumerang.</b> Dodaj skojarzenie (metoda słów-kluczy: podobnie brzmiące polskie słowo + zabawny obraz).</div>`;
  h += `<div class="answer"><div class="prompt-word" style="font-size:30px;margin:0">${esc(c.w)}</div><div class="ipa" id="ipa">${esc(en && en.ph || '')}</div><div class="tr">${esc(c.t)}</div><div id="audio-slot">${audioButtons(c)}</div>${noteHtml(c)}<div class="enrich" id="enrich">${enrichHtml(c, 2)}</div></div>`;
  const canOverride = !fb.ok && ['type', 'listen', 'speak', 'cloze', 'mc', 'mcr'].includes(Session.mode) && fb.g === 1;
  const extraBtns = (canOverride ? `<button class="btn sm" data-act="override">${ic('check')} Miałem rację</button>` : '') + ((fb.leech || !fb.ok) && !c.n ? `<button class="btn sm" data-act="detailCur">${ic('edit')} Dodaj skojarzenie</button>` : '');
  h += `<button class="btn primary block lg mt" data-act="next">Dalej</button>${extraBtns ? `<div class="fb-actions">${extraBtns}</div>` : ''}`;
  return h;
}

function renderStudy(fullAnim = false) {
  if (CURRENT_VIEW !== 'study') return;
  const c = cur(); if (!c) return;
  const v = $('#view');
  const [label, icon, color] = MODE_LABEL[Session.mode] || MODE_LABEL.recall;
  const same = Session.renderedId === c.id && !fullAnim;
  Session.renderedId = c.id;
  let h = `<div class="study"><div class="flash ${same ? 'noanim' : ''}" id="flash">
    <div class="mode-tag"><span class="chip">${ic(icon, 'width="13" height="13"')} ${label}</span>${stateChip(c)}</div>`;
  const m = Session.mode, ph = Session.phase, fb = Session.fb;

  if (m === 'intro') {
    const en = Enrich.get(c);
    h += `<div class="prompt-word">${esc(c.w)}</div><div class="prompt-sub ipa" id="ipa">${esc(en && en.ph || '')}</div>`;
    if (ph === 'pretest') {
      h += `<div id="audio-slot">${audioButtons(c)}</div><p class="center small muted" style="margin:4px 10px 0">Zgadnij, zanim poznasz odpowiedź – nawet błędny strzał pomaga zapamiętać.</p><div class="opts">` +
        Session.opts.map((o, i) => {
          let cls = '';
          if (Session.preChosen != null) cls = o.id === c.id ? 'right' : (i === Session.preChosen ? 'wrong' : 'dim');
          return `<button class="opt ${cls}" data-act="pre" data-i="${i}"><kbd>${'ABCD'[i]}</kbd>${esc(o.text)}</button>`;
        }).join('') + `</div><button class="btn ghost block mt" data-act="preSkip">Pomiń zgadywanie</button>`;
    } else {
      h += `<div class="answer" style="border:0;margin-top:4px;padding-top:4px"><div class="tr">${esc(c.t)}</div>
        <div id="audio-slot">${audioButtons(c)}</div>
        <div class="row-flex" style="justify-content:center;gap:8px;flex-wrap:wrap">
          ${Native.canListen() ? `<button class="btn sm soft" data-act="practice">${ic('mic')} ${Session.listening ? 'Słucham…' : 'Powiedz na głos'}</button>` : ''}
          <button class="btn sm soft" data-act="mnemo">${ic('edit')} Skojarzenie</button>
        </div>
        ${Session.heard ? `<div class="speech-res">${Session.heard.error ? `<span class="muted">Nie udało się rozpoznać – ${esc(speechErr(Session.heard.error))}</span>` : Session.heard.ok ? `✅ Świetna wymowa: „${esc(Session.heard.heard)}”` : `🤔 Usłyszałem „${esc(Session.heard.heard)}” – spróbuj jeszcze raz`}</div>` : ''}
        ${Session.mnemoOpen ? `<textarea class="field mt" id="mn" rows="3" placeholder="Skojarzenie lub zdanie o Tobie, np. „vague” → „waga” wahająca się niejasno…">${esc(c.n)}</textarea><p class="tiny muted" style="text-align:left;margin:6px 2px 0">Samodzielnie wymyślone skojarzenia i zdania o sobie zapamiętuje się lepiej (efekt generowania i odniesienia do siebie).</p>` : noteHtml(c)}
        <div class="enrich" id="enrich">${enrichHtml(c)}</div></div>
        <div class="btn-row mt"><button class="btn" data-act="known">Już znam</button><button class="btn primary" data-act="learned">Zapamiętam ${ic('chev', 'width="10" height="14" viewBox="0 0 8 13"')}</button></div>`;
    }
  } else if (m === 'mc' || m === 'mcr') {
    h += m === 'mc'
      ? `<div class="prompt-word">${esc(c.w)}</div><div id="audio-slot">${audioButtons(c)}</div>`
      : `<div class="prompt-word pl">${esc(c.t)}</div><div class="prompt-sub">Które słowo to oznacza?</div>`;
    h += `<div class="opts">` + Session.opts.map((o, i) => {
      let cls = '';
      if (fb) cls = o.id === c.id ? 'right' : (i === Session.chosen ? 'wrong' : 'dim');
      return `<button class="opt ${cls}" data-act="opt" data-i="${i}"><kbd>${'ABCD'[i]}</kbd>${esc(o.text)}</button>`;
    }).join('') + `</div>`;
    if (fb) h += feedbackHtml(c).replace('<div class="answer">', '<div class="answer" style="margin-top:10px">');
  } else if (m === 'recall') {
    h += `<div class="prompt-word">${esc(c.w)}</div><div class="prompt-sub ipa" id="ipa">${esc((Enrich.get(c) || {}).ph || '')}</div><div id="audio-slot">${audioButtons(c)}</div>`;
    if (ph === 'ask') {
      h += S.settings.confidence
        ? `<p class="center small muted" style="margin:8px 0 0">Przypomnij sobie znaczenie. Jak bardzo jesteś pewien?</p><div class="conf">
            <button class="btn" data-act="conf" data-v="no">🤷<span>Nie wiem</span></button>
            <button class="btn" data-act="conf" data-v="maybe">🤔<span>Chyba wiem</span></button>
            <button class="btn primary" data-act="conf" data-v="sure">💡<span>Na pewno</span></button></div>`
        : `<button class="btn primary lg block mt" data-act="reveal">Pokaż odpowiedź</button>`;
    } else if (ph === 'check' && !fb) {
      h += `<div class="answer"><div class="tr">${esc(c.t)}</div>${noteHtml(c)}<div class="enrich" id="enrich">${enrichHtml(c, 2)}</div></div>
        <p class="center small muted" style="margin:14px 0 0">Czy Twoja odpowiedź była poprawna?</p>
        <div class="btn-row mt"><button class="btn red lg" data-act="check" data-v="no">${ic('x')} Nie</button><button class="btn green lg" data-act="check" data-v="yes">${ic('check')} Tak</button></div>`;
    } else if (ph === 'grade') {
      const pv = FSRS.preview(c, Date.now(), S.settings.retention);
      h += `<div class="answer"><div class="tr">${esc(c.t)}</div>${noteHtml(c)}<div class="enrich" id="enrich">${enrichHtml(c, 2)}</div></div>
        <div class="grades">${['Znowu', 'Trudne', 'Dobre', 'Łatwe'].map((l, i) => `<button class="grade g${i + 1}" data-act="grade" data-g="${i + 1}">${l}<small>${fmtIvl(pv[i])}</small></button>`).join('')}</div>`;
    }
    if (fb) h += feedbackHtml(c);
  } else if (m === 'type' || m === 'listen' || m === 'cloze') {
    if (m === 'type') h += `<div class="prompt-word pl">${esc(c.t)}</div><div class="prompt-sub">Napisz po ${langName(deckLang()).toLowerCase().replace(/i$/, 'u')}</div>`;
    if (m === 'listen') h += `<div class="center" style="margin:16px 0 4px"><button class="icon-btn" style="width:76px;height:76px" data-act="sayWord">${ic('speaker', 'width="34" height="34"')}</button></div><div class="audio-row"><button class="btn sm soft" data-act="sayWordSlow">${ic('turtle')} Wolniej</button></div><div class="prompt-sub">Wpisz słowo, które słyszysz</div>`;
    if (m === 'cloze') {
      const ex = Enrich.example(c);
      const sent = ex ? esc(ex.text.slice(0, ex.idx)) + `<span class="gap">${fb ? esc(ex.token) : '&nbsp;'.repeat(6)}</span>` + esc(ex.text.slice(ex.idx + ex.token.length)) : '';
      h += `<div class="cloze">${sent}</div><div class="prompt-sub">${esc(c.t)}</div>`;
    }
    if (!fb) {
      h += `${Session.hint ? `<div class="hint-letters">${hintLetters(c)}</div>` : `<div class="hint-letters">${c.w.split('').map(ch => /\s/.test(ch) ? '&nbsp;' : '_').join('')}</div>`}
        <input id="ans" class="field big mt" ${inputAttrs()} data-enter="checkTyped" placeholder="…">
        <div class="btn-row mt"><button class="btn" data-act="hint">${ic('sparkles')} Podpowiedź</button><button class="btn primary" data-act="checkTyped">Sprawdź</button></div>`;
    } else {
      h += `<input class="field big mt ${fb.ok ? 'ok' : 'bad'}" value="${esc(fb.typed || '')}" disabled>` + feedbackHtml(c);
    }
  } else if (m === 'speak') {
    h += `<div class="prompt-word pl">${esc(c.t)}</div><div class="prompt-sub">Powiedz to słowo po ${langName(deckLang()).toLowerCase().replace(/i$/, 'u')}</div>`;
    if (!fb) {
      h += `<div class="center" style="margin:20px 0 6px"><button class="icon-btn ${Session.listening ? 'live' : ''}" style="width:86px;height:86px" data-act="speakAns">${ic('mic', 'width="38" height="38"')}</button></div>
        <div class="speech-res">${Session.listening ? 'Słucham…' : Session.heard && Session.heard.error ? `<span class="muted">${esc(speechErr(Session.heard.error))}</span>` : 'Dotknij i mów'}</div>
        <button class="btn ghost block mt" data-act="selfCheck">Oceń sam (bez mikrofonu)</button>`;
    } else h += feedbackHtml(c);
  }
  h += `</div>`;
  if (!Session.focus) {
    const dur = Math.floor((Date.now() - Session.started) / 1000);
    const acc = Session.done ? Math.round(Session.ok / Session.done * 100) : 100;
    h += `<div class="study-foot"><span><span class="timer-dot"></span>${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}</span><span>${P(Session.done, 'odpowiedź', 'odpowiedzi', 'odpowiedzi')} · ${acc}% trafnych</span></div>`;
  }
  h += `</div>`;
  v.innerHTML = h;
  renderTitle();
  const inp = $('#ans'); if (inp) setTimeout(() => inp.focus({ preventScroll: true }), 60);
}

/* =====================================================================
   TRYB BEZ RĄK (spacer, auto, sprzątanie): mowa ↔ mowa
   ===================================================================== */
const HF = { on: false, token: null, card: null, phase: '', heard: '', seen: new Set(), count: 0, ok: 0 };
function hfPick() {
  const now = Date.now(), eod = endOfDay(now);
  const cs = deckCards().filter(c => !c.sus && !HF.seen.has(c.id));
  let pool = cs.filter(c => ((c.s === 1 || c.s === 3) && c.due <= now) || (c.s === 2 && c.due <= eod));
  HF.passive = false;
  if (!pool.length) { pool = cs.filter(c => c.s > 0); HF.passive = true; }
  if (!pool.length) return null;
  pool.sort((a, b) => FSRS.cardR(a, now) - FSRS.cardR(b, now));
  return rnd(pool.slice(0, 8));
}
function startHandsFree() {
  HF.on = true; HF.seen = new Set(); HF.count = 0; HF.ok = 0; HF.card = null; HF.phase = 'start';
  Native.keepAwake(true); go('hf'); hfLoop();
}
function stopHandsFree() {
  HF.on = false; HF.token = null; Native.stopSpeak(); Native.stopListen(); Native.keepAwake(false); saveNow();
}
async function hfLoop() {
  const token = HF.token = {};
  const alive = () => HF.on && HF.token === token;
  const canListen = Native.canListen() && S.settings.handsfreeListen;
  await sleep(400);
  while (alive()) {
    const c = hfPick();
    if (!c) { HF.phase = 'done'; renderHF(); break; }
    HF.card = c; HF.seen.add(c.id); HF.heard = ''; HF.phase = 'prompt'; renderHF();
    await say(firstMeaning(c.t), S.settings.native);
    if (!alive()) break;
    let g = null; const t0 = Date.now();
    if (canListen && !HF.passive) {
      HF.phase = 'listen'; renderHF();
      const res = await Native.listen(langTag(deckLang()));
      if (!alive()) break;
      const m = res && res.ok ? matchSpeech(res.results, c.w) : { ok: false, heard: '' };
      HF.heard = m.heard || (res && res.error === 'no-match' ? '—' : ''); g = m.ok ? 3 : 1;
      HF.phase = m.ok ? 'ok' : 'bad'; renderHF(); haptic(m.ok ? 'success' : 'error');
      if (!m.ok) { await say('To:', S.settings.native); if (!alive()) break; }
      await say(c.w); if (!alive()) break;
      if (!m.ok) { await sleep(500); await say(c.w); }
    } else {
      HF.phase = 'think'; renderHF(); await sleep(3200); if (!alive()) break;
      HF.phase = 'reveal'; renderHF(); await say(c.w); if (!alive()) break; await sleep(900);
    }
    if (g && !HF.passive) { applyGrade(c, g, 'hf', Date.now() - t0); HF.count++; if (g > 1) HF.ok++; }
    await sleep(800);
  }
}
function renderHF() {
  if (CURRENT_VIEW !== 'hf') return;
  const c = HF.card; const ph = HF.phase;
  const status = {
    start: 'Przygotowuję…', prompt: 'Słuchaj polskiego słowa…', listen: 'Powiedz je po ' + langName(deckLang()).toLowerCase().replace(/i$/, 'u'),
    ok: '✓ Dobrze!', bad: HF.heard && HF.heard !== '—' ? `Usłyszałem „${HF.heard}”` : 'Nie usłyszałem', think: 'Przypomnij sobie…', reveal: 'Odpowiedź', done: 'Wszystko na teraz powtórzone 🎉',
  }[ph] || '';
  const showWord = ['ok', 'bad', 'reveal'].includes(ph);
  $('#view').innerHTML = `<div class="hf">
    <div class="chips" style="justify-content:center">${HF.passive ? '<span class="chip">ekspozycja (bez oceny)</span>' : `<span class="chip accent">${HF.count} powtórzonych</span>`}${HF.count ? `<span class="chip green">${Math.round(HF.ok / HF.count * 100)}% trafnych</span>` : ''}</div>
    <div class="orb ${ph === 'listen' ? 'listening' : ''}">${ic(ph === 'listen' ? 'mic' : 'headphones')}</div>
    <div class="big">${c ? esc(showWord ? c.w : (ph === 'prompt' || ph === 'listen' || ph === 'think' ? firstMeaning(c.t) : '')) : ''}</div>
    <div class="status">${esc(status)}</div>
    ${showWord && c ? `<div class="muted mt">${esc(c.t)}</div>` : ''}
    <div class="btn-row" style="margin-top:34px"><button class="btn red lg" data-act="hfStop">${ic('stop')} Zakończ</button></div>
    <p class="foot center" style="margin-top:18px">Ekran pozostaje włączony. Słuchawki z mikrofonem działają najlepiej. ${Native.canListen() ? '' : 'Rozpoznawanie mowy niedostępne – tryb słuchania.'}</p>
  </div>`;
  renderTitle();
}
ACT.hfStop = () => { stopHandsFree(); go('home'); if (HF.count) toast('Tryb bez rąk zakończony', `${HF.count} powtórek, ${Math.round(HF.ok / HF.count * 100)}% trafnych`, 'headphones', 'pink'); };
