'use strict';
/* ====================== Delegacja zdarzeń ====================== */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (fn) { e.preventDefault(); try { fn(el, e); } catch (err) { console.error(err); toast('Ups, coś poszło nie tak', String(err.message || err), 'info', 'red'); } }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-set]'); if (!el) return;
  const p = el.dataset.set;
  const v = el.type === 'checkbox' ? el.checked : el.value;
  setPath(S.settings, p, v); haptic('tick'); afterSetting(p);
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.input && INPUT[el.dataset.input]) INPUT[el.dataset.input](el);
  if (el.dataset.range && RANGE[el.dataset.range]) RANGE[el.dataset.range](el);
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const el = e.target.closest('[data-enter]');
  if (el && ACT[el.dataset.enter]) { e.preventDefault(); ACT[el.dataset.enter](el); }
  // klawiatura w sesji: 1–4 dla opcji
});
document.addEventListener('keydown', e => {
  if (CURRENT_VIEW !== 'study' || !Session.active || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const n = '1234'.indexOf(e.key);
  if (n >= 0) { const b = $$(`#flash [data-act="opt"], #flash [data-act="pre"], #flash [data-act="grade"]`)[n]; if (b) b.click(); }
  if (e.key === ' ' || e.key === 'Enter') { const b = $('#flash [data-act="next"]') || $('#flash [data-act="reveal"]'); if (b) { e.preventDefault(); b.click(); } }
});

/* ====================== Zdarzenia z Androida ====================== */
// Przycisk „wstecz”: zwraca true, jeśli obsłużony
window.App = {
  onBack() {
    if (sheetStack.length) { closeSheet(); return true; }
    if ($('.onb')) { if (ONB.step > 0) { ACT.onbBack(); return true; } return false; }
    if (CURRENT_VIEW === 'study') { ACT.pauseSession(); return true; }
    if (CURRENT_VIEW === 'hf') { ACT.hfStop(); return true; }
    if (CURRENT_VIEW !== 'home') { go('home'); return true; }
    return false;
  },
};
Native.on('insets', d => {
  const r = document.documentElement.style;
  r.setProperty('--sat', (d.top || 0) + 'px'); r.setProperty('--sab', (d.bottom || 0) + 'px');
});
Native.on('resume', () => {
  applyTheme();
  if (CURRENT_VIEW === 'home' || CURRENT_VIEW === 'stats') render(); else renderDock();
  handleShared();
});
Native.on('pause', () => saveNow());
Native.on('sharedText', () => handleShared());
Native.on('openStudy', () => { if (!Session.active) startSession(); });

function handleShared() {
  const t = (Native.takeSharedText() || '').trim();
  if (!t) return;
  const lines = t.split(/\r?\n/).filter(x => x.trim());
  if (lines.length > 1 || t.split(/\s+/).length > 4) openAdd({ tab: 'list', text: lines.join('\n') });
  else openAdd({ tab: 'one', word: t.replace(/^[^\p{L}]+|[^\p{L}'’ -]+$/gu, '') });
}

/* ====================== Start ====================== */
function boot() {
  loadState();
  Enrich.load();
  applyTheme();
  go('home');
  pushReminders();
  pushSummary();
  if (!S.settings.onboarded) openOnboarding();
  else handleShared();
  // odświeżanie liczników co minutę (karty stają się „do powtórki” z czasem)
  setInterval(() => { if (CURRENT_VIEW === 'home') { renderDock(); } }, 60000);
  setInterval(() => {
    if (CURRENT_VIEW === 'study' && Session.active) {
      const sp = $('.study-foot span'); if (!sp) return;
      const dur = Math.floor((Date.now() - Session.started) / 1000);
      sp.innerHTML = `<span class="timer-dot"></span>${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}`;
    }
  }, 1000);
  window.addEventListener('beforeunload', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
}
boot();
