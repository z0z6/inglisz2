'use strict';
/* ====================== Nawigacja ====================== */
let CURRENT_VIEW = 'home';
function go(view) {
  if (CURRENT_VIEW === 'hf' && view !== 'hf' && HF.on) stopHandsFree();
  CURRENT_VIEW = view;
  const v = $('#view');
  v.classList.remove('view-enter'); void v.offsetWidth; v.classList.add('view-enter');
  v.classList.toggle('no-dock', view === 'study' || view === 'hf');
  v.scrollTop = 0;
  render();
}
function render() {
  renderTitle(); renderDock();
  switch (CURRENT_VIEW) {
    case 'home': renderHome(); break;
    case 'study': if (Session.active) renderStudy(true); else go('home'); break;
    case 'hf': renderHF(); break;
    case 'library': renderLibrary(); break;
    case 'stats': renderStats(); break;
    case 'settings': renderSettings(); break;
  }
}
function lightsHtml(active, acts = ['', '', '']) {
  return `<div class="lights ${active ? '' : 'inactive'}">
    <button class="light r" ${acts[0] ? `data-act="${acts[0]}"` : ''} aria-label="Zamknij">${ic('x', 'stroke-width="3.4" stroke="#4d0000"')}</button>
    <button class="light y" ${acts[1] ? `data-act="${acts[1]}"` : ''} aria-label="Minimalizuj">${ic('minus', 'stroke-width="3.4" stroke="#5c3d00"')}</button>
    <button class="light g" ${acts[2] ? `data-act="${acts[2]}"` : ''} aria-label="Pełny ekran">${ic('expand', 'stroke-width="3" stroke="#00440c"')}</button></div>`;
}
function renderTitle() {
  const tb = $('#titlebar'); const v = CURRENT_VIEW;
  let title = '', sub = '', right = '', lights = lightsHtml(true, ['goHome', 'goHome', 'goHome']), prog = '';
  if (v === 'home') { title = 'Dziś'; sub = deck().name; lights = lightsHtml(true, ['lightsHint', 'lightsHint', 'lightsHint']); right = `<button class="tb-btn" data-act="openAdd" aria-label="Dodaj">${ic('plus')}</button>`; }
  if (v === 'study') {
    const remaining = Session.queue.length + deckCards().filter(c => (c.s === 1 || c.s === 3) && !c.sus && c.due <= Date.now() + 2 * MIN && c.id !== Session.cur).length;
    title = 'Nauka'; sub = `${Session.done} zrobione · ${remaining + (Session.fb ? 0 : 1)} w kolejce`;
    lights = lightsHtml(true, ['endSession', 'pauseSession', 'focusMode']);
    right = `<button class="tb-btn" data-act="undo" aria-label="Cofnij">${ic('undo')}</button>`;
    const p = Session.done / Math.max(1, Session.done + remaining + 1) * 100;
    prog = `<div class="progress"><i style="width:${p}%"></i></div>`;
    if (Session.focus) { title = ''; sub = ''; }
  }
  if (v === 'hf') { title = 'Bez rąk'; sub = 'mów i słuchaj'; lights = lightsHtml(true, ['hfStop', 'hfStop', '']); }
  if (v === 'library') { title = 'Słówka'; sub = `${deck().name} · ${deckCards().length}`; right = `<button class="tb-btn" data-act="openAdd" aria-label="Dodaj">${ic('plus')}</button>`; }
  if (v === 'stats') { title = 'Statystyki'; sub = deck().name; }
  if (v === 'settings') { title = 'Ustawienia'; sub = 'Mnemo ' + Native.version(); }
  tb.innerHTML = `${lights}<div class="tb-title">${esc(title)}${sub ? `<span class="tb-sub">${esc(sub)}</span>` : ''}</div><div class="tb-actions">${right}</div>${prog}`;
}
function renderDock() {
  const d = $('#dock');
  if (CURRENT_VIEW === 'study' || CURRENT_VIEW === 'hf') { d.classList.add('hidden'); return; }
  d.classList.remove('hidden');
  const cnt = sessionCounts();
  const items = [['home', 'sun', 'orange', 'Dziś'], ['study', 'cards', 'blue', 'Nauka'], ['library', 'book', 'purple', 'Słówka'], ['stats', 'chart', 'green', 'Statystyki']];
  d.innerHTML = items.map(([id, icn, col, lbl]) => `<button class="dock-item ${CURRENT_VIEW === id ? 'active' : ''}" data-act="dock" data-v="${id}" aria-label="${lbl}">${appIc(icn, col)}${id === 'study' && (cnt.due + cnt.learn) ? `<span class="badge">${cnt.due + cnt.learn}</span>` : ''}</button>`).join('') +
    `<span class="dock-sep"></span><button class="dock-item ${CURRENT_VIEW === 'settings' ? 'active' : ''}" data-act="dock" data-v="settings" aria-label="Ustawienia">${appIc('gear', 'gray')}</button>`;
}
Object.assign(ACT, {
  dock(el) {
    const v = el.dataset.v; el.classList.add('bounce'); haptic('tick');
    setTimeout(() => { if (v === 'study') startSession(); else go(v); }, v === 'study' ? 380 : 120);
  },
  goHome() { if (CURRENT_VIEW !== 'home') go('home'); },
  lightsHint() { const l = $('.lights'); l.classList.add('hint'); setTimeout(() => l.classList.remove('hint'), 900); toast('Światła okna', 'W trakcie nauki: czerwone kończy, żółte wstrzymuje, zielone włącza tryb skupienia.', 'info', 'gray', 3200); },
  closeSheet() { closeSheet(); },
  startStudy() { startSession(); },
  quick() { startSession({ limit: 8, fresh: true }); },
  hf() { startHandsFree(); },
  resume() { startSession(); },
  revealWotd(el) { el.style.filter = 'none'; haptic('tick'); },
  sayText(el) { say(el.dataset.t, el.dataset.l || deckLang()); },
});

/* ====================== DZIŚ ====================== */
function ringsData() {
  const tl = todayLog(); const cnt = sessionCounts();
  const mins = tl.ms / MIN, goalM = S.settings.dailyMinutes;
  const rv = tl.rv || 0, remain = cnt.due + cnt.learn;
  return [
    { label: 'Minuty', v: Math.floor(mins), goal: goalM, p: goalM ? mins / goalM : 1, color: '#FF2D55', txt: `${Math.floor(mins)}/${goalM}` },
    { label: 'Powtórki', v: rv, goal: rv + remain, p: (rv + remain) ? rv / (rv + remain) : 1, color: '#30D158', txt: `${rv}/${rv + remain}` },
    { label: 'Nowe', v: tl.n, goal: S.settings.dailyNew, p: S.settings.dailyNew ? tl.n / S.settings.dailyNew : 1, color: '#0A84FF', txt: `${tl.n}/${S.settings.dailyNew}` },
  ];
}
function ringsSvg(data) {
  const R = [56, 41, 26];
  return `<svg class="rings" viewBox="0 0 132 132">${data.map((d, i) => {
    const r = R[i], C = 2 * Math.PI * r, off = C * (1 - clamp(d.p, 0, 1));
    return `<circle cx="66" cy="66" r="${r}" stroke="${d.color}" stroke-opacity=".18" stroke-width="12.5"/><circle cx="66" cy="66" r="${r}" stroke="${d.color}" stroke-width="12.5" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${off}"/>`;
  }).join('')}</svg>`;
}
const TIPS = [
  ['brain', 'purple', 'Próba przypomnienia wzmacnia pamięć bardziej niż ponowne czytanie (efekt testowania).'],
  ['moon', 'indigo', 'Krótka powtórka wieczorem + rano po przebudzeniu wykorzystuje konsolidację pamięci we śnie.'],
  ['mic', 'red', 'Mów słowa na głos – wypowiadanie tworzy dodatkowy, ruchowo-słuchowy ślad pamięciowy (efekt produkcji).'],
  ['edit', 'orange', 'Ułóż zdanie o sobie z nowym słowem. Informacje związane z „ja” zapamiętujemy lepiej.'],
  ['target', 'green', 'Trafność ok. 85–90% to strefa optymalnej trudności. Gdy masz >95%, dodaj więcej nowych słów.'],
  ['clock', 'blue', 'Kilka krótkich sesji w ciągu dnia daje więcej niż jedna długa – pamięć lubi odstępy.'],
  ['sparkles', 'pink', 'Pomyłki, w których byłeś pewny, poprawiają się najskuteczniej – nie zniechęcaj się nimi.'],
  ['layers', 'teal', 'Mieszanie typów zadań (pisanie, słuchanie, mówienie) jest trudniejsze, ale daje trwalszą wiedzę.'],
  ['hand', 'yellow', 'Zaznacz słowo w przeglądarce lub czytniku → „Dodaj do Mnemo”. Słowa z własnej lektury mają kontekst.'],
  ['headphones', 'pink', 'Tryb „Bez rąk” pozwala powtarzać na spacerze lub w drodze – sama mowa, bez patrzenia w ekran.'],
  ['camera', 'gray', 'Masz listę słówek na papierze? Zeskanuj ją aparatem w „Dodaj → Skanuj”.'],
];
function wordOfDay() {
  const cs = deckCards().filter(c => c.t && !c.sus); if (!cs.length) return null;
  const learned = cs.filter(c => c.s === 2);
  const pool = learned.length >= 5 ? learned : cs;
  const k = dayKey(Date.now()); let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}
function greeting() { const h = new Date().getHours(); return h < 5 ? 'Dobranoc' : h < 12 ? 'Dzień dobry' : h < 18 ? 'Cześć' : 'Dobry wieczór'; }
function renderHome() {
  const cnt = sessionCounts(); const st = streakInfo(); const rings = ringsData();
  const est = Math.max(1, Math.round((cnt.due * 9 + cnt.learn * 7 + cnt.newLeft * 28) / 60));
  const cs = deckCards();
  const mature = cs.filter(c => c.s === 2 && c.S >= 21).length;
  const learned = cs.filter(c => c.s >= 1).length;
  const wotd = wordOfDay(); const tip = TIPS[Math.floor(Date.now() / DAY) % TIPS.length];
  const date = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
  const rt = trueRetention(30);
  let h = `<div class="hello"><div class="date">${esc(date)}</div><div class="h1">${greeting()}</div></div>`;
  if (Session.active && Session.paused) h += `<button class="panel row-flex" style="width:100%;border:0;text-align:left" data-act="resume">${appIc('pause', 'yellow')}<div class="grow"><b>Sesja wstrzymana</b><div class="small muted">${Session.done} odpowiedzi – dokończ, gdzie skończyłeś</div></div>${chev}</button>`;
  h += `<div class="panel"><div class="rings-wrap">${ringsSvg(rings)}<div class="legend">${rings.map(r => `<div><small style="color:${r.color}">${r.label}</small><b>${r.txt}</b></div>`).join('')}</div></div></div>`;
  const label = cnt.total ? 'Rozpocznij naukę' : 'Na dziś zrobione ✓';
  const subTxt = cnt.total ? [cnt.due + cnt.learn ? P(cnt.due + cnt.learn, 'powtórka', 'powtórki', 'powtórek') : '', cnt.newLeft ? P(cnt.newLeft, 'nowe', 'nowe', 'nowych') : '', `~${est} min`].filter(Boolean).join(' · ') : (cnt.learnLater ? `${cnt.learnLater} wróci za kilka minut` : 'Możesz dodać kilka nowych słów');
  h += `<button class="btn primary lg block" data-act="startStudy" style="flex-direction:column;gap:0;min-height:66px">${label}<span class="cta-sub">${esc(subTxt)}</span></button>
    <div class="btn-row mt mb"><button class="btn" data-act="hf">${ic('headphones')} Bez rąk</button><button class="btn" data-act="quick">${ic('bolt')} 2 minuty</button></div>`;
  h += `<div class="tiles">
    <div class="tile"><div class="k">${ic('flame', 'width="14" height="14" style="color:var(--orange)"')} Seria</div><div class="v">${st.count}</div><div class="s">${st.doneToday ? 'dziś zaliczone' : plural(st.count, 'dzień', 'dni', 'dni') + ' z rzędu'}</div></div>
    <div class="tile"><div class="k">${ic('brain', 'width="14" height="14" style="color:var(--purple)"')} Opanowane</div><div class="v">${mature}</div><div class="s">z ${learned} poznanych</div></div>
    <div class="tile"><div class="k">${ic('target', 'width="14" height="14" style="color:var(--green)"')} Trafność</div><div class="v">${rt.n ? Math.round(rt.p * 100) + '%' : '–'}</div><div class="s">ostatnie 30 dni</div></div>
    <div class="tile"><div class="k">${ic('layers', 'width="14" height="14" style="color:var(--accent)"')} Talia</div><div class="v">${cs.length}</div><div class="s">${esc(langName(deckLang()))}</div></div>
  </div>`;
  if (wotd) {
    const en = Enrich.get(wotd); const ex = en && en.m && en.m.find(d => d.e);
    h += `<div class="window"><div class="window-bar">${lightsHtml(false)}<div class="wt">Słowo dnia</div></div><div class="window-body">
      <div class="row-flex"><div class="grow"><div class="wotd-word">${esc(wotd.w)}</div><div class="ipa">${esc(en && en.ph || '')}</div></div><button class="icon-btn" data-act="sayText" data-t="${esc(wotd.w)}" data-l="${esc(deckLang())}">${ic('speaker')}</button></div>
      <div class="mt" style="filter:blur(7px);transition:filter .3s;cursor:pointer" data-act="revealWotd"><b>${esc(wotd.t)}</b>${ex ? `<div class="small muted" style="font-style:italic;margin-top:4px">„${esc(ex.e)}”</div>` : ''}</div>
      <div class="tiny muted mt">Najpierw spróbuj przypomnieć sobie znaczenie, potem dotknij, aby odsłonić.</div></div></div>`;
    Enrich.fetch(wotd);
  }
  h += `<div class="panel row-flex" style="align-items:flex-start">${appIc(tip[0], tip[1])}<div class="grow small"><b>Wskazówka</b><div class="muted">${esc(tip[2])}</div></div></div>`;
  h += `<button class="group item tap" style="width:100%" data-act="science">${appIc('info', 'indigo')}<div class="label"><b>Jak działa Mnemo?</b><small>Nauka o pamięci w skrócie</small></div>${chev}</button>`;
  $('#view').innerHTML = h;
  requestAnimationFrame(() => setTimeout(() => $$('.rings circle[data-off]').forEach(c => c.style.strokeDashoffset = c.dataset.off), 60));
}
function trueRetention(days) {
  const since = Date.now() - days * DAY; let n = 0, ok = 0;
  for (const c of S.cards) for (const [t, g, , m] of c.h || []) if (t >= since && g > 0 && m !== 'intro') { n++; if (g > 1) ok++; }
  return { n, ok, p: n ? ok / n : 0 };
}

/* ====================== SŁÓWKA ====================== */
const LIB = { q: '', f: 'all' };
function renderLibrary() {
  $('#view').innerHTML = `<div class="search">${ic('search')}<input class="field" type="search" placeholder="Szukaj słowa lub tłumaczenia" value="${esc(LIB.q)}" data-input="libSearch" ${inputAttrs()}></div>
    <div class="seg scroll mb">${[['all', 'Wszystkie'], ['new', 'Nowe'], ['learn', 'Nauka'], ['known', 'Znane'], ['hard', 'Trudne']].map(([k, l]) => `<button class="${LIB.f === k ? 'on' : ''}" data-act="libFilter" data-v="${k}">${l}</button>`).join('')}</div>
    <div id="lib-list"></div>`;
  renderLibList();
}
function renderLibList() {
  const now = Date.now(); const q = norm(LIB.q);
  let cs = deckCards();
  if (q) cs = cs.filter(c => norm(c.w).includes(q) || norm(c.t).includes(q));
  if (LIB.f === 'new') cs = cs.filter(c => c.s === 0);
  if (LIB.f === 'learn') cs = cs.filter(c => c.s === 1 || c.s === 3 || (c.s === 2 && c.S < 21));
  if (LIB.f === 'known') cs = cs.filter(c => c.s === 2 && c.S >= 21);
  if (LIB.f === 'hard') cs = cs.filter(c => c.leech || c.lap >= 2 || c.D >= 8).sort((a, b) => b.lap - a.lap || b.D - a.D);
  const total = cs.length; cs = cs.slice(0, 400);
  const row = c => {
    let right;
    if (c.sus) right = '<span class="pill sus">wstrzymane</span>';
    else if (c.s === 0) right = '<span class="pill new">nowe</span>';
    else if (c.s === 1 || c.s === 3) right = '<span class="pill" style="color:var(--orange)">nauka</span>';
    else { const r = FSRS.cardR(c, now); const col = r >= .85 ? 'var(--green)' : r >= .7 ? 'var(--orange)' : 'var(--red)'; right = `${c.leech ? '<span class="pill leech">trudne</span>' : ''}<div class="meter"><i style="width:${Math.round(r * 100)}%;background:${col}"></i></div>`; }
    return `<button class="word-row" data-act="openCard" data-id="${c.id}"><div class="grow"><div class="w">${esc(c.w)}</div><div class="t">${esc(c.t || '— brak tłumaczenia —')}</div></div>${right}${chev}</button>`;
  };
  $('#lib-list').innerHTML = total ? `<div class="group">${cs.map(row).join('')}</div>${total > 400 ? `<p class="foot">Pokazano 400 z ${total}. Zawęź wyszukiwanie.</p>` : `<p class="foot">${P(total, 'słowo', 'słowa', 'słów')}</p>`}`
    : `<div class="empty">${appIc('search', 'gray')}Brak słów dla tego filtra.</div>`;
}
Object.assign(ACT, {
  libFilter(el) { LIB.f = el.dataset.v; haptic('tick'); renderLibrary(); },
  openCard(el) { openCard(+el.dataset.id); },
  detailCur() { if (Session.cur) openCard(Session.cur); },
});
const INPUT = { libSearch(el) { LIB.q = el.value; renderLibList(); } };

/* ====================== Karta słowa (szczegóły) ====================== */
function curveSvg(c) {
  if (!c.s || !c.S) return '';
  const now = Date.now(); const ret = S.settings.retention;
  const span = Math.max(14, Math.min(365, Math.round(FSRS.intervalDays(c.S, ret) * 2.2)));
  const W = 320, H = 110, pad = 6;
  const x = d => pad + d / span * (W - 2 * pad), y = r => pad + (1 - r) * (H - 2 * pad);
  let d = ''; for (let i = 0; i <= 60; i++) { const t = span * i / 60; d += (i ? 'L' : 'M') + x(t).toFixed(1) + ',' + y(FSRS.retrievability(t, c.S)).toFixed(1); }
  const nowD = (now - c.last) / DAY; const dueD = (c.due - c.last) / DAY;
  return `<svg class="curve" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <line x1="${pad}" x2="${W - pad}" y1="${y(ret)}" y2="${y(ret)}" stroke="var(--text-3)" stroke-dasharray="4 4" stroke-width="1"/>
    <path d="${d} L${x(span)},${y(0)} L${x(0)},${y(0)} Z" fill="var(--accent-soft)"/>
    <path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
    ${dueD <= span ? `<line x1="${x(dueD)}" x2="${x(dueD)}" y1="${pad}" y2="${H - pad}" stroke="var(--green)" stroke-width="1.5" stroke-dasharray="3 3"/>` : ''}
    ${nowD <= span ? `<circle cx="${x(nowD)}" cy="${y(FSRS.retrievability(nowD, c.S))}" r="5" fill="var(--accent)" stroke="#fff" stroke-width="2"/>` : ''}
  </svg><div class="row-flex tiny muted" style="justify-content:space-between"><span>ostatnia powtórka</span><span>krzywa zapominania · ${span} dni</span></div>`;
}
function openCard(id) {
  const c = CardIndex.get(id); if (!c) return;
  ACT._detailCard = c;
  const now = Date.now(); const en = Enrich.get(c);
  const state = c.sus ? 'wstrzymane' : ['nowe', 'w nauce', c.S >= 21 ? 'opanowane' : 'młode', 'ponowna nauka'][c.s];
  const body = `<div class="center"><div class="prompt-word" style="margin-top:0">${esc(c.w)}</div><div class="ipa" id="ipa">${esc(en && en.ph || '')}</div><div id="audio-slot">${audioButtons(c)}</div></div>
    <div class="h3">Słowo i tłumaczenie</div>
    <input class="field mb" id="d-w" value="${esc(c.w)}" ${inputAttrs()}>
    <div class="row-flex mb"><input class="field" id="d-t" value="${esc(c.t)}" placeholder="Tłumaczenie"><button class="icon-btn" data-act="trDetail" aria-label="Przetłumacz">${ic('wand')}</button></div>
    <div class="h3">Skojarzenie (mnemotechnika)</div>
    <textarea class="field" id="d-n" rows="2" placeholder="np. obraz, podobnie brzmiące polskie słowo…">${esc(c.n)}</textarea>
    <div class="h3">Twoje zdanie z tym słowem</div>
    <textarea class="field" id="d-x" rows="2" placeholder="Zdanie o Tobie – najlepiej prawdziwe i z emocją">${esc(c.x)}</textarea>
    <div class="enrich" id="enrich">${enrichHtml(c, 4)}</div>
    <div class="h3">Pamięć</div>
    ${curveSvg(c)}
    <div class="kv mt">
      <div><small>Stan</small><b>${state}</b></div>
      <div><small>Szansa przypomnienia teraz</small><b>${c.s ? Math.round(FSRS.cardR(c, now) * 100) + '%' : '–'}</b></div>
      <div><small>Stabilność</small><b>${c.s ? (c.S < 1 ? Math.round(c.S * 24) + ' h' : c.S.toFixed(c.S < 10 ? 1 : 0) + ' d') : '–'}</b></div>
      <div><small>Trudność</small><b>${c.s ? c.D.toFixed(1) + '/10' : '–'}</b></div>
      <div><small>Następna powtórka</small><b>${c.s ? (c.due <= now ? 'teraz' : 'za ' + fmtIvl(c.due - now)) : '–'}</b></div>
      <div><small>Powtórki / pomyłki</small><b>${c.reps} / ${c.lap}</b></div>
    </div>
    <div class="btn-row mt"><button class="btn sm" data-act="cardSus">${c.sus ? 'Przywróć' : 'Wstrzymaj'}</button><button class="btn sm" data-act="cardReset">Od nowa</button><button class="btn sm red" data-act="cardDel">Usuń</button></div>`;
  openSheet({ title: c.w, body, foot: `<button class="btn primary block" data-act="cardSave">Zapisz</button>`, onClose: () => { ACT._detailCard = null; if (CURRENT_VIEW === 'study') renderStudy(); } });
  Enrich.fetch(c).then(e => { if (e && ACT._detailCard === c) updateEnrichUI(c); });
}
Object.assign(ACT, {
  cardSave() {
    const c = ACT._detailCard; if (!c) return;
    c.w = $('#d-w').value.trim() || c.w; c.t = $('#d-t').value.trim(); c.n = $('#d-n').value.trim(); c.x = $('#d-x').value.trim();
    save(); closeSheet(); haptic('success'); toast('Zapisano', c.w, 'check', 'green', 1400);
    if (CURRENT_VIEW === 'library') renderLibList();
  },
  async trDetail() {
    const w = $('#d-w').value.trim(); if (!w) return;
    toast('Tłumaczę…', 'Za pierwszym razem pobieram model językowy (~30 MB).', 'globe', 'blue', 2000);
    const r = await Native.translate(w, S.decks[ACT._detailCard.d].lang, S.settings.native);
    if (r && r.ok) $('#d-t').value = r.text; else toast('Nie udało się przetłumaczyć', r && r.error || '', 'x', 'red');
  },
  cardSus() { const c = ACT._detailCard; c.sus = !c.sus; save(); closeSheet(); render(); },
  async cardReset() {
    const c = ACT._detailCard;
    const r = await alertBox({ icon: 'undo', color: 'orange', title: 'Zacząć od nowa?', text: 'Postęp tego słowa zostanie wyzerowany.', buttons: [{ label: 'Anuluj', value: 0 }, { label: 'Resetuj', cls: 'orange', value: 1 }] });
    if (r === 1) { Object.assign(c, { s: 0, st: 0, due: 0, S: 0, D: 0, last: 0, reps: 0, lap: 0, leech: false, known: false, h: [] }); save(); closeSheet(); render(); }
  },
  async cardDel() {
    const c = ACT._detailCard;
    const r = await alertBox({ icon: 'trash', color: 'red', title: `Usunąć „${c.w}”?`, text: 'Tej operacji nie można cofnąć.', buttons: [{ label: 'Anuluj', value: 0 }, { label: 'Usuń', cls: 'red', value: 1 }] });
    if (r === 1) { S.cards = S.cards.filter(x => x.id !== c.id); CardIndex.rebuild(); save(); closeSheet(); render(); }
  },
});

/* ====================== STATYSTYKI ====================== */
function renderStats() {
  const now = Date.now(); const cs = deckCards();
  const st = streakInfo(); const rt = trueRetention(30);
  const totalMs = Object.values(S.log).reduce((a, l) => a + (l.ms || 0), 0);
  // heatmapa 18 tygodni
  const today = keyToDate(dayKey(now)); const start = new Date(today); start.setDate(start.getDate() - (7 * 17 + ((today.getDay() + 6) % 7)));
  let heat = ''; const d = new Date(start);
  while (d <= today) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const l = S.log[k]; const n = l ? l.n + l.r : 0;
    const lv = n === 0 ? '' : n < 10 ? 'l1' : n < 30 ? 'l2' : n < 60 ? 'l3' : 'l4';
    heat += `<i class="${lv} ${k === dayKey(now) ? 'today' : ''}" title="${k}: ${n}"></i>`;
    d.setDate(d.getDate() + 1);
  }
  // prognoza 14 dni
  const eod = endOfDay(now); const fc = new Array(14).fill(0);
  cs.forEach(c => { if (c.sus || c.s === 0) return; const i = c.due <= eod ? 0 : Math.ceil((c.due - eod) / DAY); if (i < 14) fc[i]++; });
  const maxF = Math.max(1, ...fc);
  const days = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
  const bars = fc.map((n, i) => { const dd = new Date(now + i * DAY); return `<div><em>${n || ''}</em><span style="height:${n / maxF * 100}%"></span><small>${i === 0 ? 'dziś' : days[dd.getDay()]}</small></div>`; }).join('');
  // stany
  const nNew = cs.filter(c => c.s === 0).length, nLearn = cs.filter(c => c.s === 1 || c.s === 3).length;
  const nYoung = cs.filter(c => c.s === 2 && c.S < 21).length, nMature = cs.filter(c => c.s === 2 && c.S >= 21).length;
  const tot = Math.max(1, cs.length);
  const seg = (n, c) => `<i style="width:${n / tot * 100}%;background:${c}"></i>`;
  // kalibracja
  const cal = S.calib; const pct = a => a[0] ? Math.round(a[1] / a[0] * 100) : null;
  const sureP = pct(cal.sure), maybeP = pct(cal.maybe);
  let calTxt = 'Odpowiadaj w trybie „Przypomnij sobie”, aby zobaczyć, jak trafnie oceniasz własną wiedzę.';
  if (sureP != null && cal.sure[0] >= 10) calTxt = sureP >= 90 ? 'Świetna kalibracja – gdy jesteś pewny, zwykle masz rację.' : sureP >= 75 ? 'Dobra kalibracja. Czasem przeceniasz swoją pewność.' : 'Często mylisz się mimo pewności – to dobra okazja do nauki (efekt hiperkorekty).';
  const hard = cs.filter(c => c.lap > 0).sort((a, b) => b.lap - a.lap || b.D - a.D).slice(0, 6);
  const avgMs = (() => { let n = 0, s = 0; cs.forEach(c => (c.h || []).forEach(([t, g, ms, m]) => { if (m !== 'intro' && ms > 0 && ms < 60000) { n++; s += ms; } })); return n ? s / n : 0; })();

  $('#view').innerHTML = `
    <div class="tiles">
      <div class="tile"><div class="k">${ic('flame', 'width="14" height="14" style="color:var(--orange)"')} Seria</div><div class="v">${st.count}</div><div class="s">${st.freezesUsed ? `w tym ${st.freezesUsed} dzień przerwy „zamrożony”` : 'dni z rzędu'}</div></div>
      <div class="tile"><div class="k">${ic('target', 'width="14" height="14" style="color:var(--green)"')} Retencja 30 d</div><div class="v">${rt.n ? Math.round(rt.p * 100) + '%' : '–'}</div><div class="s">cel: ${Math.round(S.settings.retention * 100)}% · ${rt.n} odp.</div></div>
      <div class="tile"><div class="k">${ic('clock', 'width="14" height="14" style="color:var(--accent)"')} Czas nauki</div><div class="v">${totalMs >= HOUR ? (totalMs / HOUR).toFixed(1) + ' h' : Math.round(totalMs / MIN) + ' min'}</div><div class="s">łącznie</div></div>
      <div class="tile"><div class="k">${ic('bolt', 'width="14" height="14" style="color:var(--yellow)"')} Tempo</div><div class="v">${avgMs ? (avgMs / 1000).toFixed(1) + ' s' : '–'}</div><div class="s">średnio na odpowiedź</div></div>
    </div>
    <div class="panel"><div class="h2">Aktywność</div><div class="heat">${heat}</div><div class="legend-row"><span style="--c:var(--field)">brak</span><span style="--c:color-mix(in srgb,var(--green) 35%,transparent)">&lt;10</span><span style="--c:color-mix(in srgb,var(--green) 60%,transparent)">&lt;30</span><span style="--c:var(--green)">60+</span></div></div>
    <div class="panel"><div class="h2">Prognoza powtórek</div><p class="small muted" style="margin:0 0 10px">Ile kart przypadnie na kolejne dni – algorytm planuje je tuż przed zapomnieniem.</p><div class="bars">${bars}</div></div>
    <div class="panel"><div class="h2">Talia: ${esc(deck().name)}</div><div class="stack">${seg(nMature, 'var(--green)')}${seg(nYoung, '#7bd88f')}${seg(nLearn, 'var(--orange)')}${seg(nNew, 'var(--accent)')}</div>
      <div class="legend-row"><span style="--c:var(--green)">opanowane ${nMature}</span><span style="--c:#7bd88f">młode ${nYoung}</span><span style="--c:var(--orange)">w nauce ${nLearn}</span><span style="--c:var(--accent)">nowe ${nNew}</span></div></div>
    <div class="panel"><div class="h2">Kalibracja metapoznawcza</div><p class="small muted" style="margin:0 0 12px">Jak często masz rację, gdy deklarujesz pewność.</p>
      <div class="calib">
        <div class="row-flex"><b>💡 Na pewno</b><div class="hbar"><i style="width:${sureP || 0}%;background:var(--green)"></i></div><span class="small" style="width:70px;text-align:right">${sureP != null ? sureP + '% (' + cal.sure[0] + ')' : '–'}</span></div>
        <div class="row-flex"><b>🤔 Chyba</b><div class="hbar"><i style="width:${maybeP || 0}%;background:var(--orange)"></i></div><span class="small" style="width:70px;text-align:right">${maybeP != null ? maybeP + '% (' + cal.maybe[0] + ')' : '–'}</span></div>
      </div><p class="small mt" style="margin-bottom:0">${esc(calTxt)}</p></div>
    ${hard.length ? `<div class="h3">Najtrudniejsze słowa</div><div class="group">${hard.map(c => `<button class="word-row" data-act="openCard" data-id="${c.id}"><div class="grow"><div class="w">${esc(c.w)}</div><div class="t">${esc(c.t)}</div></div><span class="pill leech">${c.lap}× zapomniane</span>${chev}</button>`).join('')}</div>` : ''}`;
}

/* ====================== USTAWIENIA ====================== */
const gs = p => getPath(S.settings, p);
function toggleRow(icon, color, label, sub, path) {
  return `<div class="item">${appIc(icon, color)}<div class="label"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div><label class="switch"><input type="checkbox" data-set="${path}" ${gs(path) ? 'checked' : ''}><i></i></label></div>`;
}
function stepRow(icon, color, label, sub, path, min, max, step = 1) {
  return `<div class="item">${appIc(icon, color)}<div class="label"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div><div class="stepper"><button data-act="step" data-path="${path}" data-d="${-step}" data-min="${min}" data-max="${max}">−</button><span>${gs(path)}</span><button data-act="step" data-path="${path}" data-d="${step}" data-min="${min}" data-max="${max}">+</button></div></div>`;
}
function segHtml(path, opts) { return `<div class="seg">${opts.map(([v, l]) => `<button class="${String(gs(path)) === String(v) ? 'on' : ''}" data-act="setv" data-path="${path}" data-v="${v}">${l}</button>`).join('')}</div>`; }
function workloadFactor(r) { const f = x => Math.pow(x, -2) - 1; return f(.9) / f(r); }
function renderSettings() {
  const s = S.settings; const d = deck();
  const r = Math.round(s.retention * 100);
  $('#view').innerHTML = `
    <div class="h3">Nauka</div>
    <div class="group">
      <button class="item tap" data-act="decks">${appIc('layers', 'blue')}<div class="label"><b>Talia i język</b><small>${esc(d.name)} · ${esc(langName(d.lang))}</small></div>${chev}</button>
      ${stepRow('sparkles', 'indigo', 'Nowe słowa dziennie', 'Więcej = więcej powtórek w kolejnych dniach', 'dailyNew', 0, 60, 1)}
      ${stepRow('clock', 'pink', 'Cel minut dziennie', 'Czerwony pierścień na ekranie „Dziś”', 'dailyMinutes', 5, 90, 5)}
      ${stepRow('cards', 'teal', 'Karty w sesji', 'Krótkie sesje sprzyjają rozłożeniu nauki', 'sessionSize', 5, 100, 5)}
      <div class="item">${appIc('target', 'green')}<div class="label"><b>Docelowa retencja: <span id="ret-v">${r}%</span></b><small id="ret-s">Obciążenie powtórkami ≈ ×${workloadFactor(s.retention).toFixed(1)} względem 90%</small><input type="range" min="80" max="95" step="1" value="${r}" data-range="retention" style="--p:${(r - 80) / 15 * 100}%"></div></div>
    </div>
    <p class="foot">FSRS planuje powtórkę w chwili, gdy szansa przypomnienia spada do tej wartości. 85–92% to rozsądny kompromis między trwałością a czasem.</p>

    <div class="h3">Techniki</div>
    <div class="group">
      ${toggleRow('sparkles', 'purple', 'Zgadywanie przed nauką', 'Pretest – błędny strzał też pomaga (Richland i in., 2009)', 'pretest')}
      ${toggleRow('brain', 'indigo', 'Pytanie o pewność', 'Kalibracja + efekt hiperkorekty', 'confidence')}
      ${toggleRow('bolt', 'yellow', 'Automatyczne przejście', 'Po dobrej odpowiedzi następna karta sama', 'autoAdvance')}
      ${stepRow('moon', 'indigo', 'Przypomnienie o przerwie', 'Minuty (0 = wyłączone)', 'breakMin', 0, 60, 5)}
    </div>
    <div class="h3">Rodzaje ćwiczeń (przeplatane)</div>
    <div class="group">
      ${toggleRow('list', 'blue', 'Wybór z 4', 'Na początku nauki – rozpoznawanie', 'modes.mc')}
      ${toggleRow('keyboard', 'orange', 'Pisanie', 'Przypominanie i pisownia', 'modes.type')}
      ${toggleRow('ear', 'pink', 'Dyktando', 'Słuch → pisownia', 'modes.listen')}
      ${toggleRow('mic', 'red', 'Mówienie', 'Rozpoznawanie mowy – wymowa i produkcja', 'modes.speak')}
      ${toggleRow('edit', 'green', 'Zdania z luką', 'Kontekst z przykładów słownikowych', 'modes.cloze')}
    </div>

    <div class="h3">Dźwięk i mowa</div>
    <div class="group">
      ${toggleRow('speaker', 'blue', 'Automatyczna wymowa', 'Słowo czytane przy pokazaniu', 'autoSpeak')}
      ${d.lang === 'en' ? `<div class="item noic" style="flex-direction:column;align-items:stretch;gap:8px"><b style="font-weight:500">Akcent angielski</b>${segHtml('accent', [['en-GB', '🇬🇧 Brytyjski'], ['en-US', '🇺🇸 Amerykański']])}</div>` : ''}
      <div class="item">${appIc('turtle', 'green')}<div class="label"><b>Tempo mowy: <span id="rate-v">${Math.round(s.rate * 100)}%</span></b><input type="range" min="50" max="130" step="5" value="${Math.round(s.rate * 100)}" data-range="rate" style="--p:${(s.rate * 100 - 50) / 80 * 100}%"></div><button class="btn sm soft" data-act="testVoice">Test</button></div>
      ${toggleRow('wave', 'teal', 'Nagrania lektora', 'Prawdziwa wymowa z internetu (gdy dostępna)', 'onlineAudio')}
      ${toggleRow('book', 'purple', 'Definicje i przykłady', 'Pobierane z darmowego słownika (angielski)', 'enrich')}
      ${toggleRow('headphones', 'pink', 'Bez rąk: odpowiadanie głosem', 'Wyłącz, by tylko słuchać', 'handsfreeListen')}
      ${toggleRow('hand', 'gray', 'Wibracje', 'Natychmiastowa informacja zwrotna dotykiem', 'haptics')}
    </div>

    <div class="h3">Przypomnienia</div>
    <div class="group">
      ${toggleRow('bell', 'red', 'Codzienne przypomnienia', 'Pora + „kotwica” (intencja implementacyjna)', 'reminders.on')}
      ${[0, 1].map(i => `<div class="item">${appIc(i ? 'moon' : 'sun', i ? 'indigo' : 'orange')}<div class="label"><b>${i ? 'Wieczorem' : 'Rano'}</b><input class="field" style="min-height:36px;margin-top:6px;font-size:14px" data-set="reminders.anchors.${i}" value="${esc(s.reminders.anchors[i] || '')}" placeholder="kotwica, np. po kawie"></div><input type="time" class="field" style="width:118px;min-height:38px;font-size:15px" data-set="reminders.times.${i}" value="${esc(s.reminders.times[i] || '')}"></div>`).join('')}
      ${toggleRow('clock', 'teal', 'Przypomnienie o krótkiej powtórce', 'Gdy nowe słowa czekają na drugi krok (po ~10 min)', 'reminders.stepNudge')}
    </div>
    <p class="foot">Powtórka wieczorem i rano wykorzystuje konsolidację pamięci we śnie (Mazza i in., 2016).</p>

    <div class="h3">Wygląd</div>
    <div class="group">
      <div class="item noic" style="flex-direction:column;align-items:stretch;gap:8px"><b style="font-weight:500">Motyw</b>${segHtml('theme', [['auto', 'Automatyczny'], ['light', 'Jasny'], ['dark', 'Ciemny']])}</div>
      <div class="item noic" style="flex-direction:column;align-items:stretch;gap:8px"><b style="font-weight:500">Tapeta</b>${segHtml('wall', [['sonoma', 'Sonoma'], ['sunset', 'Zachód'], ['graphite', 'Grafit']])}</div>
      <div class="item noic"><div class="label"><b>Kolor akcentu</b></div><div class="accent-dots">${Object.entries(ACCENTS).map(([k, v]) => `<button class="${s.accentColor === k ? 'on' : ''}" style="background:${v[0]}" data-act="accentColor" data-v="${k}" aria-label="${k}"></button>`).join('')}</div></div>
    </div>

    <div class="h3">Dane</div>
    <div class="group">
      <button class="item tap" data-act="exportData">${appIc('upload', 'blue')}<div class="label"><b>Eksportuj kopię zapasową</b><small>Plik JSON z całym postępem</small></div>${chev}</button>
      <button class="item tap" data-act="importData">${appIc('download', 'green')}<div class="label"><b>Importuj</b><small>Kopia Mnemo lub lista słów (CSV/TXT)</small></div>${chev}</button>
      <button class="item tap" data-act="resetProgress">${appIc('undo', 'orange')}<div class="label"><b>Wyzeruj postęp talii</b></div>${chev}</button>
    </div>
    <div class="h3">O aplikacji</div>
    <div class="group">
      <button class="item tap" data-act="science">${appIc('info', 'indigo')}<div class="label"><b>Jak działa Mnemo</b><small>Techniki i badania</small></div>${chev}</button>
      <button class="item tap" data-act="onboarding">${appIc('sparkles', 'pink')}<div class="label"><b>Pokaż wprowadzenie</b></div>${chev}</button>
    </div>
    <p class="foot center">Mnemo ${esc(Native.version())} · definicje: dictionaryapi.dev (Wiktionary, CC BY-SA) · czcionka Inter (OFL)</p>`;
}
function afterSetting(path) {
  if (/^(theme|accentColor|wall)$/.test(path)) applyTheme();
  if (path.startsWith('reminders')) { pushReminders(); if (path === 'reminders.on' && S.settings.reminders.on) Native.requestNotifications(); }
  save();
}
Object.assign(ACT, {
  setv(el) {
    let v = el.dataset.v; if (v === 'true' || v === 'false') v = v === 'true'; else if (v !== '' && !isNaN(+v) && !/^en-/.test(v)) v = +v;
    setPath(S.settings, el.dataset.path, v); haptic('tick'); afterSetting(el.dataset.path); renderSettings();
  },
  step(el) {
    const p = el.dataset.path; const v = clamp(gs(p) + +el.dataset.d, +el.dataset.min, +el.dataset.max);
    setPath(S.settings, p, v); haptic('tick'); afterSetting(p);
    el.parentElement.querySelector('span').textContent = v;
  },
  accentColor(el) { S.settings.accentColor = el.dataset.v; haptic('tick'); afterSetting('accentColor'); renderSettings(); },
  testVoice() { say(deckLang() === 'en' ? 'Memory is the residue of thought.' : (deckCards()[0] || { w: '' }).w); },
  science() { openScience(); },
  onboarding() { openOnboarding(); },
  async exportData() {
    const name = `mnemo-kopia-${dayKey(Date.now())}.json`;
    const r = await Native.exportFile(name, JSON.stringify({ app: 'mnemo', v: 1, exported: Date.now(), state: S, enrich: Enrich.cache }));
    if (r && r.ok) toast('Kopia zapisana', name, 'check', 'green');
  },
  async importData() {
    const r = await Native.importFile(); if (!r || !r.ok) return;
    let data = null; try { data = JSON.parse(r.text); } catch (e) { }
    if (data && data.app === 'mnemo' && data.state) {
      const ok = await alertBox({ icon: 'download', color: 'green', title: 'Przywrócić kopię?', text: 'Obecne dane zostaną zastąpione danymi z pliku.', buttons: [{ label: 'Anuluj', value: 0 }, { label: 'Przywróć', cls: 'primary', value: 1 }] });
      if (ok !== 1) return;
      S = deepMerge(defaultState(), data.state); S.settings = deepMerge(DEFAULT_SETTINGS, S.settings); CardIndex.rebuild();
      if (data.enrich) { Enrich.cache = data.enrich; Enrich.save(); }
      saveNow(); applyTheme(); pushReminders(); go('home'); toast('Przywrócono', `${S.cards.length} słów`, 'check', 'green');
    } else openAdd({ tab: 'list', text: r.text });
  },
  async resetProgress() {
    const ok = await alertBox({ icon: 'undo', color: 'orange', title: 'Wyzerować postęp?', text: `Wszystkie słowa w talii „${esc(deck().name)}” wrócą do stanu „nowe”. Słowa i skojarzenia zostaną.`, buttons: [{ label: 'Anuluj', value: 0 }, { label: 'Wyzeruj', cls: 'red', value: 1 }] });
    if (ok !== 1) return;
    deckCards().forEach(c => Object.assign(c, { s: 0, st: 0, due: 0, S: 0, D: 0, last: 0, reps: 0, lap: 0, leech: false, known: false, h: [] }));
    saveNow(); render(); toast('Postęp wyzerowany', '', 'undo', 'orange');
  },
});
const RANGE = {
  retention(el) { const v = +el.value; S.settings.retention = v / 100; $('#ret-v').textContent = v + '%'; $('#ret-s').textContent = `Obciążenie powtórkami ≈ ×${workloadFactor(v / 100).toFixed(1)} względem 90%`; el.style.setProperty('--p', (v - 80) / 15 * 100 + '%'); save(); },
  rate(el) { const v = +el.value; S.settings.rate = v / 100; $('#rate-v').textContent = v + '%'; el.style.setProperty('--p', (v - 50) / 80 * 100 + '%'); save(); },
};

/* ====================== Talie ====================== */
function openDecks() {
  const rows = Object.values(S.decks).map(d => {
    const n = S.cards.filter(c => c.d === d.id).length;
    return `<div class="item">${appIc('layers', d.id === S.settings.deck ? 'blue' : 'gray')}<button class="label" style="border:0;background:none;text-align:left;padding:0" data-act="pickDeck" data-v="${esc(d.id)}"><b>${esc(d.name)}</b><small>${esc(langName(d.lang))} · ${P(n, 'słowo', 'słowa', 'słów')}</small></button>${d.id === S.settings.deck ? `<span style="color:var(--accent)">${ic('check', 'width="20" height="20"')}</span>` : `<button class="tb-btn" data-act="delDeck" data-v="${esc(d.id)}">${ic('trash', 'width="18" height="18"')}</button>`}</div>`;
  }).join('');
  openSheet({
    title: 'Talie i języki',
    body: `<div class="group">${rows}</div>
      <div class="h3">Nowa talia</div>
      <input class="field mb" id="nd-name" placeholder="Nazwa, np. Niemiecki – podróże">
      <select class="field mb" id="nd-lang">${LANGS.filter(l => l[0] !== 'pl').map(l => `<option value="${l[0]}">${l[1]}</option>`).join('')}</select>
      <p class="foot" style="margin:0 2px 10px">Język talii ustawia głos lektora, rozpoznawanie mowy i tłumaczenie na urządzeniu. Słowa dodasz ręcznie, z listy, pliku lub skanując kartkę aparatem.</p>
      ${!S.decks.en600 ? `<button class="btn block mb" data-act="restoreSeed">Przywróć talię „600 słówek (EN)”</button>` : ''}`,
    foot: `<button class="btn primary block" data-act="createDeck">Utwórz talię</button>`
  });
}
Object.assign(ACT, {
  decks() { openDecks(); },
  pickDeck(el) { S.settings.deck = el.dataset.v; save(); closeSheet(); haptic('success'); render(); },
  createDeck() {
    const name = $('#nd-name').value.trim(); const lang = $('#nd-lang').value;
    const id = 'd' + Date.now().toString(36);
    S.decks[id] = { id, name: name || langName(lang), lang, created: Date.now() };
    S.settings.deck = id; save(); closeSheet(); render();
    setTimeout(() => openAdd({ tab: 'list' }), 400);
  },
  async delDeck(el) {
    const id = el.dataset.v; const d = S.decks[id];
    const ok = await alertBox({ icon: 'trash', color: 'red', title: `Usunąć talię „${esc(d.name)}”?`, text: 'Wszystkie jej słowa i postęp zostaną usunięte.', buttons: [{ label: 'Anuluj', value: 0 }, { label: 'Usuń', cls: 'red', value: 1 }] });
    if (ok !== 1) return;
    delete S.decks[id]; S.cards = S.cards.filter(c => c.d !== id); CardIndex.rebuild(); save(); closeSheet(); openDecks();
  },
  restoreSeed() { seedDeck('en600'); CardIndex.rebuild(); save(); closeSheet(); openDecks(); },
});

/* ====================== Dodawanie słów ====================== */
const ADD = { tab: 'one', tokens: [], sel: new Set(), busy: false };
const STOP_EN = new Set('the and for with that this from are was were have has had you your our not but all any can will would there their they them then than into onto over under about also been being its it’s it\'s his her she him who what when where which while why how out off our ours very just more most some such only own same too etc'.split(' '));
function openAdd({ tab = 'one', word = '', text = '' } = {}) {
  ADD.tab = tab; ADD.tokens = []; ADD.sel = new Set();
  closeAllSheets();
  ADD.sh = openSheet({ title: 'Dodaj słowa', body: '<div id="add-body"></div>' });
  renderAdd({ word, text });
  if (tab === 'one' && word) setTimeout(() => ACT.trWord(), 200);
}
function renderAdd({ word = '', text = '' } = {}) {
  const box = $('#add-body'); if (!box) return;
  const d = deck();
  let h = `<div class="seg mb">${[['one', 'Słowo'], ['list', 'Lista / plik'], ['scan', 'Skanuj']].map(([k, l]) => `<button class="${ADD.tab === k ? 'on' : ''}" data-act="addTab" data-v="${k}">${l}</button>`).join('')}</div>
    <p class="small muted" style="margin:0 2px 12px">Talia: <b>${esc(d.name)}</b> · ${esc(langName(d.lang))} → ${esc(langName(S.settings.native))}</p>`;
  if (ADD.tab === 'one') {
    h += `<input class="field mb" id="a-w" placeholder="Słowo (${esc(langName(d.lang).toLowerCase())})" value="${esc(word)}" ${inputAttrs()}>
      <div class="row-flex mb"><input class="field" id="a-t" placeholder="Tłumaczenie"><button class="icon-btn" data-act="trWord" aria-label="Przetłumacz">${ic('wand')}</button></div>
      <textarea class="field mb" id="a-n" rows="2" placeholder="Skojarzenie / zdanie (opcjonalnie)"></textarea>
      <button class="btn primary block" data-act="addOne">${ic('plus')} Dodaj</button>
      <p class="foot" style="margin-top:10px">Wskazówka: zaznacz słowo w dowolnej aplikacji i wybierz „Dodaj do Mnemo”.</p>`;
  } else if (ADD.tab === 'list') {
    h += `<textarea class="field" id="a-list" rows="8" placeholder="regularly - regularnie&#10;measurement; pomiar&#10;sustainable&#9;zrównoważony&#10;same słowo (przetłumaczę automatycznie)">${esc(text)}</textarea>
      <label class="row-flex mt small"><label class="switch"><input type="checkbox" id="a-auto" checked><i></i></label> Przetłumacz brakujące automatycznie</label>
      <div class="btn-row mt"><button class="btn" data-act="addFile">${ic('download')} Z pliku</button><button class="btn primary" data-act="addList" id="a-list-btn">Dodaj</button></div>
      <p class="foot" style="margin-top:10px">Separatory: tabulator, „ - ”, „;”, „=”, „:”. Numeracja na początku wiersza jest pomijana.</p>`;
  } else {
    h += `<div class="btn-row"><button class="btn" data-act="scan" data-v="camera">${ic('camera')} Aparat</button><button class="btn" data-act="scan" data-v="gallery">${ic('image')} Galeria</button></div>
      <p class="foot" style="margin-top:10px">Zrób zdjęcie listy słówek, strony książki lub notatek. Rozpoznawanie tekstu działa na telefonie, bez internetu. Potem wybierz słowa do nauki.</p>
      <div id="scan-res">${scanResHtml()}</div>`;
  }
  box.innerHTML = h;
}
function scanResHtml() {
  if (!ADD.tokens.length) return '';
  return `<div class="row-flex mt mb"><b class="grow">Znalezione: ${ADD.tokens.length}</b><button class="btn sm ghost" data-act="scanAll">Wszystkie</button><button class="btn sm ghost" data-act="scanNone">Żadne</button></div>
    <div class="group scan-list">${ADD.tokens.map((t, i) => `<button class="check-row" data-act="scanToggle" data-i="${i}"><span class="check ${ADD.sel.has(i) ? 'on' : ''}"></span><span class="grow">${esc(t)}</span></button>`).join('')}</div>
    <button class="btn primary block mt" data-act="scanAdd" id="scan-add">Dodaj zaznaczone (${ADD.sel.size})</button>`;
}
function addWord(w, t, extra = {}) {
  w = String(w || '').trim(); if (!w) return false;
  const k = w.toLowerCase();
  if (deckCards().some(c => c.w.toLowerCase() === k)) return false;
  const c = newCard(S.settings.deck, w, t, 'user', extra);
  S.cards.push(c); CardIndex.map.set(c.id, c);
  return true;
}
function parseList(text) {
  const out = [];
  for (let line of String(text).split(/\r?\n/)) {
    line = line.replace(/^\s*\d+\s*[.)\]:-]?\s+/, '').trim(); if (!line) continue;
    let w = line, t = '';
    const seps = ['\t', ' - ', ' – ', ' — ', ';', '=', ':', ','];
    for (const s of seps) { const i = line.indexOf(s); if (i > 0) { w = line.slice(0, i); t = line.slice(i + s.length); break; } }
    w = w.trim().replace(/^["']|["']$/g, ''); t = t.trim().replace(/^["']|["']$/g, '');
    if (w) out.push({ w, t });
  }
  return out;
}
function extractTokens(text) {
  const lang = deckLang(); const keepCase = lang === 'de';
  const have = new Set(deckCards().map(c => c.w.toLowerCase()));
  const seen = new Set(); const out = [];
  for (let t of String(text).split(/[^\p{L}'’-]+/u)) {
    t = t.replace(/^['’-]+|['’-]+$/g, '');
    if (t.length < 3 || /\d/.test(t)) continue;
    const k = t.toLowerCase();
    if (seen.has(k) || have.has(k) || (lang === 'en' && STOP_EN.has(k))) continue;
    seen.add(k); out.push(keepCase ? t : k);
    if (out.length >= 400) break;
  }
  return out;
}
async function translateMany(words, btn) {
  const res = {}; let i = 0;
  for (const w of words) {
    i++; if (btn) btn.textContent = `Tłumaczę ${i}/${words.length}…`;
    const r = await Native.translate(w, deckLang(), S.settings.native);
    if (r && r.ok) res[w] = r.text; else if (i === 1) { toast('Tłumaczenie niedostępne', r && r.error || '', 'globe', 'red'); break; }
  }
  return res;
}
Object.assign(ACT, {
  openAdd() { openAdd(); },
  addTab(el) { ADD.tab = el.dataset.v; haptic('tick'); renderAdd(); },
  async trWord() {
    const w = $('#a-w') && $('#a-w').value.trim(); if (!w) return;
    const t = $('#a-t'); t.placeholder = 'Tłumaczę… (za 1. razem pobieram model ~30 MB)';
    const r = await Native.translate(w, deckLang(), S.settings.native);
    t.placeholder = 'Tłumaczenie';
    if (r && r.ok) { t.value = r.text; haptic('tick'); } else toast('Nie udało się przetłumaczyć', r && r.error || '', 'globe', 'red');
  },
  addOne() {
    const w = $('#a-w').value.trim(), t = $('#a-t').value.trim(), n = $('#a-n').value.trim();
    if (!w) return; if (!t) { toast('Brak tłumaczenia', 'Wpisz je lub użyj różdżki', 'wand', 'orange'); return; }
    if (addWord(w, t, { n })) { save(); haptic('success'); toast('Dodano', `${w} – ${t}`, 'plus', 'green', 1600); $('#a-w').value = ''; $('#a-t').value = ''; $('#a-n').value = ''; $('#a-w').focus(); render(); }
    else toast('To słowo już jest w talii', w, 'info', 'orange');
  },
  async addList() {
    if (ADD.busy) return; const btn = $('#a-list-btn');
    const items = parseList($('#a-list').value); if (!items.length) return;
    ADD.busy = true;
    const missing = items.filter(x => !x.t).map(x => x.w);
    let tr = {};
    if (missing.length && $('#a-auto').checked) tr = await translateMany(missing, btn);
    let added = 0, skipped = 0;
    for (const it of items) { const t = it.t || tr[it.w] || ''; if (addWord(it.w, t)) added++; else skipped++; }
    ADD.busy = false; save(); haptic('success'); closeSheet(); render();
    toast(`Dodano ${P(added, 'słowo', 'słowa', 'słów')}`, skipped ? `${skipped} pominięto (duplikaty)` : 'Pojawią się jako nowe w sesji', 'plus', 'green');
  },
  async addFile() {
    const r = await Native.importFile(); if (!r || !r.ok) return;
    const ta = $('#a-list'); if (ta) ta.value = r.text;
  },
  async scan(el) {
    toast('Rozpoznaję tekst…', '', 'camera', 'gray', 1500);
    const r = await Native.scan(el.dataset.v);
    if (!r || !r.ok) { if (r && r.error && r.error !== 'cancelled') toast('Skanowanie nieudane', r.error, 'camera', 'red'); return; }
    ADD.tokens = extractTokens(r.text); ADD.sel = new Set(ADD.tokens.map((_, i) => i));
    if (!ADD.tokens.length) toast('Nie znaleziono nowych słów', '', 'search', 'orange');
    $('#scan-res').innerHTML = scanResHtml(); haptic('success');
  },
  scanToggle(el) { const i = +el.dataset.i; ADD.sel.has(i) ? ADD.sel.delete(i) : ADD.sel.add(i); el.querySelector('.check').classList.toggle('on'); $('#scan-add').textContent = `Dodaj zaznaczone (${ADD.sel.size})`; },
  scanAll() { ADD.sel = new Set(ADD.tokens.map((_, i) => i)); $('#scan-res').innerHTML = scanResHtml(); },
  scanNone() { ADD.sel = new Set(); $('#scan-res').innerHTML = scanResHtml(); },
  async scanAdd() {
    if (ADD.busy || !ADD.sel.size) return; ADD.busy = true;
    const words = [...ADD.sel].sort((a, b) => a - b).map(i => ADD.tokens[i]);
    const tr = await translateMany(words, $('#scan-add'));
    let added = 0; for (const w of words) if (addWord(w, tr[w] || '')) added++;
    ADD.busy = false; save(); closeSheet(); render();
    const noTr = words.filter(w => !tr[w]).length;
    toast(`Dodano ${P(added, 'słowo', 'słowa', 'słów')}`, noTr ? `${noTr} bez tłumaczenia – uzupełnij w „Słówka”` : 'Gotowe do nauki', 'plus', 'green', 3200);
  },
});

/* ====================== Nauka o pamięci ====================== */
function openScience() {
  const items = [
    ['clock', 'blue', 'Powtórki w odstępach (FSRS)', 'Każde słowo ma własny model pamięci: trudność, stabilność i szansę przypomnienia. Powtórka wypada tuż przed zapomnieniem – odstępy rosną: minuty → dni → miesiące.', 'Ebbinghaus 1885; Cepeda i in. 2006; Ye 2022–2024 (FSRS)'],
    ['brain', 'purple', 'Aktywne przypominanie', 'Zamiast pokazywać odpowiedź, Mnemo każe ją wydobyć z pamięci. Testowanie utrwala lepiej niż ponowne czytanie.', 'Roediger i Karpicke 2006'],
    ['sparkles', 'indigo', 'Zgadywanie przed nauką', 'Przy nowym słowie najpierw zgadujesz. Nawet błędna próba zwiększa zapamiętanie poprawnej odpowiedzi.', 'Richland, Kornell i Kao 2009'],
    ['target', 'pink', 'Pewność i hiperkorekta', 'Deklarujesz pewność przed odsłonięciem. Błędy popełnione z wysoką pewnością są szczególnie dobrze poprawiane, a statystyki kalibracji uczą trafnej samooceny.', 'Butterfield i Metcalfe 2001'],
    ['layers', 'teal', 'Pożądane trudności i przeplatanie', 'Typ zadania rośnie z siłą pamięci: rozpoznanie → pisanie → mówienie → kontekst. Rodzaje ćwiczeń są mieszane, a dystraktory dobrane z tą samą końcówką.', 'Bjork 1994; Rohrer i Taylor 2007'],
    ['ear', 'orange', 'Wielozmysłowość', 'Tekst + wymowa lektora + własne skojarzenie tworzą kilka niezależnych dróg dostępu do słowa.', 'Paivio 1971 (podwójne kodowanie)'],
    ['mic', 'red', 'Efekt produkcji', 'Mówienie na głos (z rozpoznawaniem mowy) zapamiętuje się lepiej niż czytanie w myślach.', 'MacLeod i in. 2010'],
    ['edit', 'yellow', 'Generowanie i odniesienie do siebie', 'Własne skojarzenia (metoda słów-kluczy) i zdania o sobie są trwalsze niż gotowe definicje.', 'Slamecka i Graf 1978; Rogers i in. 1977; Atkinson i Raugh 1975'],
    ['check', 'green', 'Natychmiastowa informacja zwrotna', 'Od razu widzisz, słyszysz i czujesz (wibracja) wynik – z porównaniem liter przy literówkach.', 'Metcalfe 2017'],
    ['moon', 'indigo', 'Sen i rozłożenie w ciągu dnia', 'Przypomnienia rano i wieczorem, krótkie kroki po 1 i 10 minutach, przypomnienie o przerwie po 20 minutach.', 'Mazza i in. 2016; Cepeda i in. 2006'],
    ['flame', 'orange', 'Nawyk', 'Plan „kiedy X, to Y” (pora + kotwica), pierścienie celu i seria z jednym dniem „zamrożenia” na tydzień – by jedno potknięcie nie przerywało nawyku.', 'Gollwitzer 1999; Lally i in. 2010; Kivetz i in. 2006'],
    ['hand', 'gray', 'Telefon jako narzędzie', 'Lektor (TTS), rozpoznawanie mowy, wibracje, powiadomienia, widżet z ekspozycją słów, skaner aparatem (OCR), tłumacz offline, dodawanie z dowolnej aplikacji i tryb „bez rąk”.', ''],
  ];
  openSheet({
    title: 'Jak działa Mnemo',
    body: `<div class="group">${items.map(([i, c, t, d, r]) => `<div class="item" style="align-items:flex-start">${appIc(i, c)}<div class="label"><b>${t}</b><small style="font-size:13.5px;color:var(--text)">${d}</small>${r ? `<small>${r}</small>` : ''}</div></div>`).join('')}</div>`
  });
}

/* ====================== Wprowadzenie (onboarding) ====================== */
const ONB = { step: 0 };
function openOnboarding() {
  ONB.step = 0;
  let el = $('.onb'); if (!el) { el = document.createElement('div'); el.className = 'onb'; document.body.appendChild(el); }
  renderOnb();
}
function renderOnb() {
  const el = $('.onb'); if (!el) return;
  const s = S.settings; const st = ONB.step;
  let body = '', foot = '';
  if (st === 0) {
    body = `<div class="center"><div class="app-ic ic-indigo hero-ic" style="background:linear-gradient(135deg,#BF5AF2,#5E5CE6 50%,#0A84FF)"><svg viewBox="0 0 24 24" style="width:56%;height:56%" fill="#fff"><path d="M3 19V5h3.2l5.8 9 5.8-9H21v14h-3.2v-8.6L12 19l-5.8-8.6V19z"/></svg></div>
      <div class="h1" style="font-size:28px">Witaj w Mnemo</div><p class="muted" style="margin:6px 8px 16px">Słówka, które zostają w głowie – dzięki temu, co wiemy o pamięci.</p></div>
      <div class="group">
        <div class="item">${appIc('clock', 'blue')}<div class="label"><b>Powtórka w idealnym momencie</b><small>Algorytm FSRS przewiduje, kiedy zaczniesz zapominać</small></div></div>
        <div class="item">${appIc('mic', 'red')}<div class="label"><b>Słuchaj, pisz, mów</b><small>Lektor, dyktando, rozpoznawanie mowy, tryb bez rąk</small></div></div>
        <div class="item">${appIc('camera', 'gray')}<div class="label"><b>Twoje słowa</b><small>600 słów na start + skaner, tłumacz offline, dowolne języki</small></div></div>
      </div>`;
    foot = `<button class="btn primary lg block" data-act="onbNext">Dalej</button>`;
  } else if (st === 1) {
    body = `<div class="h2">Twój dzienny cel</div><p class="small muted">Ile nowych słów dziennie? Każde nowe słowo to w kolejnych dniach kilka krótkich powtórek.</p>
      ${segHtml('dailyNew', [[5, '5'], [10, '10'], [15, '15'], [20, '20']])}
      <p class="small mt">${{ 5: 'Spokojnie – ok. 5 min dziennie.', 10: 'Zalecane – ok. 10 min dziennie. ~300 słów w 1–2 miesiące.', 15: 'Ambitnie – ok. 15 min dziennie.', 20: 'Intensywnie – 20+ min dziennie.' }[s.dailyNew] || ''}</p>
      ${deckLang() === 'en' ? `<div class="h3">Akcent lektora</div>${segHtml('accent', [['en-GB', '🇬🇧 Brytyjski'], ['en-US', '🇺🇸 Amerykański']])}<p class="foot">Lista używa brytyjskiej pisowni (np. „generalisation”), ale akceptuję obie.</p>` : ''}`;
    foot = `<div class="btn-row"><button class="btn" data-act="onbBack">Wstecz</button><button class="btn primary" data-act="onbNext">Dalej</button></div>`;
  } else if (st === 2) {
    body = `<div class="h2">Kiedy będziesz się uczyć?</div><p class="small muted">Plan „<b>kiedy X, wtedy Mnemo</b>” znacząco zwiększa szansę wytrwania. Wybierz porę i stałą czynność, po której zaczniesz.</p>
      ${[0, 1].map(i => `<div class="panel" style="padding:12px;margin-bottom:10px"><div class="row-flex mb">${appIc(i ? 'moon' : 'sun', i ? 'indigo' : 'orange')}<b class="grow">${i ? 'Wieczorem' : 'Rano'}</b><input type="time" class="field" style="width:118px;min-height:38px" data-set="reminders.times.${i}" value="${esc(s.reminders.times[i])}"></div>
        <div class="chips">${(i ? ['przed snem', 'po kolacji', 'po treningu', 'w drodze do domu'] : ['po porannej kawie', 'w drodze do pracy', 'po śniadaniu', 'po umyciu zębów']).map(a => `<button class="chip ${s.reminders.anchors[i] === a ? 'on' : ''}" data-act="onbAnchor" data-i="${i}" data-v="${esc(a)}">${esc(a)}</button>`).join('')}</div></div>`).join('')}
      <p class="foot">Wieczorna powtórka + poranne odświeżenie to duet, który wykorzystuje sen do utrwalania.</p>`;
    foot = `<div class="btn-row"><button class="btn" data-act="onbBack">Wstecz</button><button class="btn primary" data-act="onbRemind">${ic('bell')} Włącz</button></div><button class="btn ghost block" data-act="onbNext" style="margin-top:6px">Bez przypomnień</button>`;
  } else {
    body = `<div class="center">${appIc('check', 'green', 'hero-ic')}<div class="h2">Wszystko gotowe!</div><p class="muted">Pierwsza sesja to ${s.dailyNew} nowych słów – zajmie kilka minut. Po ok. 10 minutach przypomnę o krótkiej powtórce.</p></div>
      <div class="group"><div class="item">${appIc('plus', 'blue')}<div class="label"><b>Dodawaj własne słowa</b><small>Przycisk + u góry lub „Dodaj do Mnemo” po zaznaczeniu tekstu</small></div></div>
      <div class="item">${appIc('layers', 'purple')}<div class="label"><b>Widżet na ekranie głównym</b><small>Przytrzymaj ekran główny → Widżety → Mnemo</small></div></div></div>`;
    foot = `<button class="btn primary lg block" data-act="onbDone">Zacznij pierwszą sesję</button>`;
  }
  el.innerHTML = `<div class="window"><div class="window-bar">${lightsHtml(false)}<div class="wt">Mnemo</div></div><div class="window-body">${body}<div class="dots">${[0, 1, 2, 3].map(i => `<i class="${i === st ? 'on' : ''}"></i>`).join('')}</div></div><div class="sheet-foot">${foot}</div></div>`;
}
Object.assign(ACT, {
  onbNext() { ONB.step = Math.min(3, ONB.step + 1); haptic('tick'); renderOnb(); },
  onbBack() { ONB.step = Math.max(0, ONB.step - 1); renderOnb(); },
  onbAnchor(el) { S.settings.reminders.anchors[+el.dataset.i] = el.dataset.v; haptic('tick'); renderOnb(); },
  onbRemind() { S.settings.reminders.on = true; Native.requestNotifications(); pushReminders(); save(); ONB.step = 3; renderOnb(); },
  onbDone() { S.settings.onboarded = true; saveNow(); const el = $('.onb'); if (el) el.remove(); go('home'); setTimeout(() => startSession(), 300); },
});
// ustawienia zmieniane w onboardingu przez segHtml/setv → odśwież ekran wprowadzenia zamiast ustawień
const _setv = ACT.setv;
ACT.setv = el => { if ($('.onb')) { let v = el.dataset.v; if (!isNaN(+v) && !/^en-/.test(v)) v = +v; setPath(S.settings, el.dataset.path, v); haptic('tick'); afterSetting(el.dataset.path); renderOnb(); } else _setv(el); };
