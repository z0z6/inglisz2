// FSRS-5 (Free Spaced Repetition Scheduler, J. Ye i in.) – model pamięci DSR:
// D = trudność (1–10), S = stabilność (dni, po których R spada do 90%), R = szansa przypomnienia.
// Domyślne wagi FSRS-5 (wytrenowane na ~20 tys. użytkowników / setkach mln powtórek).
(function (global) {
  'use strict';
  const W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046,
    1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
  const DECAY = -0.5;
  const FACTOR = 19 / 81; // 0.9^(1/DECAY) - 1
  const DAY = 86400000, MIN = 60000;
  const LEARN_STEPS = [1, 10];   // minuty – krótkie odstępy w obrębie dnia (nowe słowa)
  const RELEARN_STEPS = [10];    // minuty – po zapomnieniu
  const MAX_IVL = 36500;

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  function retrievability(elapsedDays, S) {
    if (!S || S <= 0) return 0;
    return Math.pow(1 + FACTOR * Math.max(0, elapsedDays) / S, DECAY);
  }
  function intervalDays(S, r) {
    return S / FACTOR * (Math.pow(r, 1 / DECAY) - 1);
  }
  function S0(g) { return Math.max(W[g - 1], 0.1); }
  function D0(g) { return clamp(W[4] - Math.exp(W[5] * (g - 1)) + 1, 1, 10); }
  function nextD(D, g) {
    const delta = -W[6] * (g - 3);
    const d1 = D + delta * (10 - D) / 9;               // liniowe tłumienie
    return clamp(W[7] * D0(4) + (1 - W[7]) * d1, 1, 10); // powrót do średniej
  }
  function recallS(D, S, r, g) {
    const hard = g === 2 ? W[15] : 1, easy = g === 4 ? W[16] : 1;
    return S * (1 + Math.exp(W[8]) * (11 - D) * Math.pow(S, -W[9]) *
      (Math.exp(W[10] * (1 - r)) - 1) * hard * easy);
  }
  function forgetS(D, S, r) {
    const sf = W[11] * Math.pow(D, -W[12]) * (Math.pow(S + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
    return Math.min(sf, S);
  }
  function shortS(S, g) { return S * Math.exp(W[17] * (g - 3 + W[18])); }

  function ivlFromS(S, retention, fuzz) {
    let d = intervalDays(S, retention);
    if (fuzz && d >= 2.5) d *= 1 + (Math.random() * 0.1 - 0.05);
    return clamp(Math.round(d), 1, MAX_IVL);
  }

  /**
   * Zwraca nowe pola karty po odpowiedzi z oceną g (1 Again, 2 Hard, 3 Good, 4 Easy).
   * Karta: {s: 0 nowa|1 nauka|2 powtórka|3 ponowna nauka, st: krok, due, S, D, last, reps, lap}
   */
  function schedule(card, g, now, retention, fuzz = true) {
    const c = { s: card.s || 0, st: card.st || 0, due: card.due || 0, S: card.S || 0, D: card.D || 0,
      last: card.last || 0, reps: card.reps || 0, lap: card.lap || 0 };
    const elapsed = c.last ? (now - c.last) / DAY : 0;
    let ivlDays = 0;

    if (c.s === 0) {
      c.S = S0(g); c.D = D0(g);
      if (g === 1) { c.s = 1; c.st = 0; c.due = now + LEARN_STEPS[0] * MIN; }
      else if (g === 2) { c.s = 1; c.st = 0; c.due = now + (LEARN_STEPS[0] + LEARN_STEPS[1]) / 2 * MIN; }
      else if (g === 3) { c.s = 1; c.st = 1; c.due = now + LEARN_STEPS[1] * MIN; }
      else { c.s = 2; ivlDays = ivlFromS(c.S, retention, fuzz); c.due = now + ivlDays * DAY; }
    } else if (c.s === 1 || c.s === 3) {
      const steps = c.s === 1 ? LEARN_STEPS : RELEARN_STEPS;
      if (elapsed < 1) c.S = shortS(c.S, g);
      else c.S = g === 1 ? forgetS(c.D, c.S, retrievability(elapsed, c.S)) : recallS(c.D, c.S, retrievability(elapsed, c.S), g);
      c.D = nextD(c.D, g);
      if (g === 1) { c.st = 0; c.due = now + steps[0] * MIN; }
      else if (g === 2) {
        const m = c.st === 0 && steps.length > 1 ? (steps[0] + steps[1]) / 2 : steps[Math.min(c.st, steps.length - 1)] * 1.5;
        c.due = now + m * MIN;
      } else if (g === 3 && c.st + 1 < steps.length) { c.st += 1; c.due = now + steps[c.st] * MIN; }
      else {
        c.s = 2; c.st = 0;
        ivlDays = ivlFromS(c.S, retention, fuzz);
        if (g === 4) ivlDays = Math.max(ivlDays, 2);
        c.due = now + ivlDays * DAY;
      }
    } else {
      const r = retrievability(elapsed, c.S);
      const oldD = c.D;
      c.D = nextD(oldD, g);
      if (g === 1) {
        c.S = forgetS(oldD, c.S, r); c.lap += 1; c.s = 3; c.st = 0;
        c.due = now + RELEARN_STEPS[0] * MIN;
      } else {
        c.S = elapsed < 1 ? shortS(c.S, g) : recallS(oldD, c.S, r, g);
        ivlDays = ivlFromS(c.S, retention, fuzz);
        c.due = now + ivlDays * DAY;
      }
    }
    c.reps += 1; c.last = now;
    c.ivl = ivlDays;
    return c;
  }

  /** Podgląd odstępów dla 4 przycisków (bez losowości), z zachowaniem kolejności Hard<=Good<=Easy */
  function preview(card, now, retention) {
    const out = [1, 2, 3, 4].map(g => schedule(card, g, now, retention, false).due - now);
    if (out[2] < out[1]) out[2] = out[1];
    if (out[3] <= out[2]) out[3] = out[2] + DAY;
    return out;
  }

  function cardR(card, now) {
    if (!card.s || !card.last) return 0;
    return retrievability((now - card.last) / DAY, card.S);
  }

  global.FSRS = { schedule, preview, retrievability, cardR, intervalDays, S0, D0, W, DAY, MIN };
})(window);
