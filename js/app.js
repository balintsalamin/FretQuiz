(() => {
  'use strict';

  /* =======================================================
     Music data
     ======================================================= */
  const NOTE_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const NOTE_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
  const NATURAL_SET = new Set([0,2,4,5,7,9,11]);

  // Rendered top-to-bottom, the way a player looks down at the neck.
  const STRINGS = [
    { stringNum:1, label:'E', openIndex:4,  kind:'plain', thickness:1.6 },
    { stringNum:2, label:'B', openIndex:11, kind:'plain', thickness:2.1 },
    { stringNum:3, label:'G', openIndex:7,  kind:'plain', thickness:2.6 },
    { stringNum:4, label:'D', openIndex:2,  kind:'wound', thickness:3.2 },
    { stringNum:5, label:'A', openIndex:9,  kind:'wound', thickness:3.8 },
    { stringNum:6, label:'E', openIndex:4,  kind:'wound', thickness:4.4 },
  ];

  /* =======================================================
     Board geometry (matches the SVG viewBox 0 0 1040 340)
     ======================================================= */
  const NUT_X = 70;
  const BOARD_RIGHT = 1020;
  const FRETS = 12;
  const FRET_SPACING = (BOARD_RIGHT - NUT_X) / FRETS;
  const TOP_Y = 50, BOT_Y = 270;
  const STEP_Y = (BOT_Y - TOP_Y) / (STRINGS.length - 1);
  const OPEN_X = 52;
  const LABEL_X = 18;
  const NECK_TOP = 20, NECK_BOTTOM = 300;
  const FRETLINE_TOP = 36, FRETLINE_BOTTOM = 284;

  STRINGS.forEach((s, i) => { s.y = TOP_Y + i * STEP_Y; });

  const fretLineX = k => NUT_X + k * FRET_SPACING;
  const fretCellX = k => NUT_X + (k - 0.5) * FRET_SPACING;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}) => {
    const n = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };

  /* =======================================================
     Persistence
     ======================================================= */
  const STORAGE_KEY = 'fretquiz.state.v1';
  const defaultSettings = () => ({
    strings: [true, true, true, true, true, true],
    rangeMin: 0,
    rangeMax: 12,
    accidental: 'sharp',
    naturalsOnly: false,
    timerEnabled: false,
    timerSeconds: 8,
    sound: true,
  });
  const defaultStats = () => ({ streak: 0, bestStreak: 0, correct: 0, total: 0 });

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          settings: Object.assign(defaultSettings(), parsed.settings || {}),
          stats: Object.assign(defaultStats(), parsed.stats || {}),
        };
      }
    } catch (e) { /* ignore, fall back to defaults */ }
    return { settings: defaultSettings(), stats: defaultStats() };
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, stats })); }
    catch (e) { /* storage unavailable — quiz still works, just won't persist */ }
  }

  const loaded = loadState();
  const settings = loaded.settings;
  const stats = loaded.stats;

  const state = {
    playing: false,
    current: null,      // { stringIndex, fret, noteIndex }
    lastPick: null,
    advanceHandle: null,
    timeoutHandle: null,
    dangerHandle: null,
  };

  /* =======================================================
     DOM refs
     ======================================================= */
  const boardSvg = document.getElementById('board');
  const promptText = document.getElementById('promptText');
  const timerTrack = document.getElementById('timerTrack');
  const timerBar = document.getElementById('timerBar');
  const notePad = document.getElementById('notePad');
  const startBtn = document.getElementById('startBtn');
  const streakValue = document.getElementById('streakValue');
  const accValue = document.getElementById('accValue');
  const lcdEl = document.querySelector('.lcd');
  const soundToggle = document.getElementById('soundToggle');
  const installBtn = document.getElementById('installBtn');
  const iosHint = document.getElementById('iosHint');
  const stringToggles = document.getElementById('stringToggles');
  const naturalsOnlyEl = document.getElementById('naturalsOnly');
  const timerEnabledEl = document.getElementById('timerEnabled');
  const timerSecondsRow = document.getElementById('timerSecondsRow');
  const timerSecondsEl = document.getElementById('timerSeconds');
  const resetStatsBtn = document.getElementById('resetStats');

  let markerEl, dimLeft, dimRight;

  /* =======================================================
     Build the fretboard SVG
     ======================================================= */
  function buildBoard() {
    const defs = el('defs');
    const grad = el('linearGradient', { id: 'woodGrad', x1: '0%', y1: '0%', x2: '0%', y2: '100%' });
    grad.appendChild(el('stop', { offset: '0%', 'stop-color': '#4a2c19' }));
    grad.appendChild(el('stop', { offset: '55%', 'stop-color': '#2f1c11' }));
    grad.appendChild(el('stop', { offset: '100%', 'stop-color': '#20130c' }));
    defs.appendChild(grad);
    boardSvg.appendChild(defs);

    boardSvg.appendChild(el('rect', {
      class: 'fb-body', x: 0, y: NECK_TOP, width: BOARD_RIGHT, height: NECK_BOTTOM - NECK_TOP, rx: 18,
    }));

    // faint wood grain
    for (let i = 0; i < 5; i++) {
      const gy = NECK_TOP + 20 + i * 50 + (i % 2 ? 8 : 0);
      const p = el('path', {
        class: 'fb-grain',
        d: `M0,${gy} C ${BOARD_RIGHT*0.3},${gy-10} ${BOARD_RIGHT*0.7},${gy+10} ${BOARD_RIGHT},${gy}`,
      });
      boardSvg.appendChild(p);
    }

    // frets
    for (let k = 1; k <= FRETS; k++) {
      boardSvg.appendChild(el('line', {
        class: 'fb-fret', x1: fretLineX(k), x2: fretLineX(k), y1: FRETLINE_TOP, y2: FRETLINE_BOTTOM,
      }));
    }
    // nut
    boardSvg.appendChild(el('line', {
      class: 'fb-nut', x1: NUT_X, x2: NUT_X, y1: FRETLINE_TOP, y2: FRETLINE_BOTTOM,
    }));

    // inlay dots
    const midY = (TOP_Y + BOT_Y) / 2;
    [3, 5, 7, 9].forEach(k => {
      boardSvg.appendChild(el('circle', { class: 'fb-inlay', cx: fretCellX(k), cy: midY, r: 7 }));
    });
    [midY - STEP_Y, midY + STEP_Y].forEach(y => {
      boardSvg.appendChild(el('circle', { class: 'fb-inlay', cx: fretCellX(12), cy: y, r: 7 }));
    });

    // fret numbers
    const markerFrets = new Set([3, 5, 7, 9, 12]);
    for (let k = 0; k <= FRETS; k++) {
      const t = el('text', {
        class: 'fb-fretnum' + (markerFrets.has(k) ? ' marker-fret' : ''),
        x: k === 0 ? OPEN_X : fretCellX(k), y: 318,
      });
      t.textContent = String(k);
      boardSvg.appendChild(t);
    }

    // strings + open-string labels
    STRINGS.forEach((s, i) => {
      boardSvg.appendChild(el('line', {
        class: 'fb-string', 'data-string-index': i,
        x1: 34, x2: BOARD_RIGHT, y1: s.y, y2: s.y,
        stroke: s.kind === 'wound' ? 'var(--string-wound)' : 'var(--string-plain)',
        'stroke-width': s.thickness,
      }));
      const lbl = el('text', { class: 'fb-stringlabel', x: LABEL_X, y: s.y });
      lbl.textContent = s.label;
      boardSvg.appendChild(lbl);
    });

    // dim overlays for excluded fret range
    dimLeft = el('rect', { id: 'dimLeftZone', class: 'fb-zone-dim', x: 0, y: NECK_TOP, width: 0, height: NECK_BOTTOM - NECK_TOP });
    dimRight = el('rect', { id: 'dimRightZone', class: 'fb-zone-dim', x: BOARD_RIGHT, y: NECK_TOP, width: 0, height: NECK_BOTTOM - NECK_TOP });
    boardSvg.appendChild(dimLeft);
    boardSvg.appendChild(dimRight);

    // marker (the note to identify)
    markerEl = el('g', { id: 'noteMarker', class: 'fb-marker hidden', transform: `translate(${OPEN_X},${TOP_Y})` });
    markerEl.appendChild(el('circle', { class: 'fb-marker-glow1', r: 26 }));
    markerEl.appendChild(el('circle', { class: 'fb-marker-glow2', r: 19 }));
    markerEl.appendChild(el('circle', { class: 'fb-marker-core', r: 13 }));
    boardSvg.appendChild(markerEl);
  }

  function updateRangeVisual() {
    const leftX = settings.rangeMin > 0 ? fretLineX(settings.rangeMin) : 0;
    dimLeft.setAttribute('width', leftX);
    const rightX = fretLineX(settings.rangeMax);
    dimRight.setAttribute('x', rightX);
    dimRight.setAttribute('width', Math.max(0, BOARD_RIGHT - rightX));
  }

  function positionMarker(stringIndex, fret) {
    const x = fret === 0 ? OPEN_X : fretCellX(fret);
    const y = STRINGS[stringIndex].y;
    markerEl.setAttribute('transform', `translate(${x},${y})`);
  }

  function applyStringVisibility() {
    STRINGS.forEach((s, i) => {
      const lineEl = boardSvg.querySelector(`.fb-string[data-string-index="${i}"]`);
      if (lineEl) lineEl.classList.toggle('disabled', !settings.strings[i]);
    });
  }

  /* =======================================================
     Notation helpers
     ======================================================= */
  const noteLabel = idx => (settings.accidental === 'flat' ? NOTE_FLAT : NOTE_SHARP)[idx];

  /* =======================================================
     Answer pad
     ======================================================= */
  function renderNotePad() {
    notePad.innerHTML = '';
    const indices = settings.naturalsOnly ? [0, 2, 4, 5, 7, 9, 11] : [0,1,2,3,4,5,6,7,8,9,10,11];
    indices.forEach(idx => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'note-btn';
      btn.dataset.noteIndex = idx;
      btn.textContent = noteLabel(idx);
      btn.addEventListener('click', () => handleAnswer(idx, btn, false));
      notePad.appendChild(btn);
    });
    syncPadDisabled();
  }
  function syncPadDisabled() {
    const enabled = state.playing && !!state.current;
    Array.from(notePad.children).forEach(b => { b.disabled = !enabled; });
  }

  /* =======================================================
     Quiz engine
     ======================================================= */
  function getEligiblePairs() {
    const pairs = [];
    for (let si = 0; si < STRINGS.length; si++) {
      if (!settings.strings[si]) continue;
      for (let fret = settings.rangeMin; fret <= settings.rangeMax; fret++) {
        const noteIndex = (STRINGS[si].openIndex + fret) % 12;
        if (settings.naturalsOnly && !NATURAL_SET.has(noteIndex)) continue;
        pairs.push({ stringIndex: si, fret, noteIndex });
      }
    }
    return pairs;
  }

  function nextQuestion() {
    clearTimeout(state.advanceHandle);
    clearTimeout(state.timeoutHandle);
    clearTimeout(state.dangerHandle);
    hideTimerBar();

    const pairs = getEligiblePairs();
    if (pairs.length === 0) {
      promptText.textContent = 'No notes match these settings — enable a string or widen the range.';
      stopSession();
      return;
    }
    let pick;
    do {
      pick = pairs[Math.floor(Math.random() * pairs.length)];
    } while (pairs.length > 1 && state.lastPick &&
             pick.stringIndex === state.lastPick.stringIndex && pick.fret === state.lastPick.fret);
    state.lastPick = pick;
    state.current = pick;

    positionMarker(pick.stringIndex, pick.fret);
    markerEl.classList.remove('hidden', 'correct', 'wrong');

    Array.from(notePad.children).forEach(b => { b.disabled = false; b.classList.remove('is-correct', 'is-wrong'); });
    promptText.classList.remove('correct', 'wrong');
    promptText.textContent = 'Which note is this?';

    if (settings.timerEnabled) {
      showTimerBar(settings.timerSeconds);
      state.timeoutHandle = setTimeout(() => handleAnswer(-1, null, true), settings.timerSeconds * 1000);
    }
  }

  function handleAnswer(selectedIndex, btnEl, isTimeout) {
    if (!state.playing || !state.current) return;
    clearTimeout(state.timeoutHandle);
    clearTimeout(state.dangerHandle);
    hideTimerBar();

    const correctIndex = state.current.noteIndex;
    const isCorrect = !isTimeout && selectedIndex === correctIndex;

    Array.from(notePad.children).forEach(b => { b.disabled = true; });
    const correctBtn = notePad.querySelector(`[data-note-index="${correctIndex}"]`);
    if (correctBtn) correctBtn.classList.add('is-correct');
    if (!isCorrect && btnEl) btnEl.classList.add('is-wrong');

    markerEl.classList.toggle('correct', isCorrect);
    markerEl.classList.toggle('wrong', !isCorrect);

    if (isCorrect) {
      const strEl = boardSvg.querySelector(`.fb-string[data-string-index="${state.current.stringIndex}"]`);
      if (strEl) {
        strEl.classList.remove('fb-string-hit');
        void strEl.getBoundingClientRect();
        strEl.classList.add('fb-string-hit');
      }
    }

    playTone(isCorrect ? 'correct' : 'wrong');

    stats.total++;
    if (isCorrect) {
      stats.correct++;
      stats.streak++;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    } else {
      stats.streak = 0;
    }
    saveState();
    updateLCD();

    const label = noteLabel(correctIndex);
    promptText.classList.remove('correct', 'wrong');
    if (isCorrect) {
      promptText.innerHTML = `Nice — that's <strong>${label}</strong>`;
      promptText.classList.add('correct');
    } else if (isTimeout) {
      promptText.innerHTML = `Too slow — it was <strong>${label}</strong>`;
      promptText.classList.add('wrong');
    } else {
      promptText.innerHTML = `Not quite — it was <strong>${label}</strong>`;
      promptText.classList.add('wrong');
    }

    state.current = null;
    state.advanceHandle = setTimeout(() => { if (state.playing) nextQuestion(); }, isCorrect ? 900 : 1500);
  }

  function showTimerBar(seconds) {
    timerTrack.hidden = false;
    timerBar.classList.remove('danger');
    timerBar.style.transition = 'none';
    timerBar.style.width = '100%';
    void timerBar.getBoundingClientRect();
    timerBar.style.transition = `width ${seconds}s linear`;
    timerBar.style.width = '0%';
    state.dangerHandle = setTimeout(() => timerBar.classList.add('danger'), Math.max(0, seconds - 2) * 1000);
  }
  function hideTimerBar() {
    timerTrack.hidden = true;
    timerBar.style.transition = 'none';
    timerBar.style.width = '100%';
  }

  function startSession() {
    ensureAudio();
    state.playing = true;
    startBtn.textContent = 'Stop';
    startBtn.classList.add('is-playing');
    nextQuestion();
  }
  function stopSession() {
    state.playing = false;
    clearTimeout(state.advanceHandle);
    clearTimeout(state.timeoutHandle);
    clearTimeout(state.dangerHandle);
    hideTimerBar();
    if (markerEl) markerEl.classList.add('hidden');
    state.current = null;
    startBtn.textContent = 'Start';
    startBtn.classList.remove('is-playing');
    promptText.innerHTML = 'Tap <strong>Start</strong> to begin';
    promptText.classList.remove('correct', 'wrong');
    syncPadDisabled();
  }

  function updateLCD() {
    streakValue.textContent = String(stats.streak);
    accValue.textContent = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) + '%' : '—';
    if (lcdEl) lcdEl.title = `Best streak: ${stats.bestStreak}`;
  }

  /* =======================================================
     Sound (WebAudio, no assets — stays offline-safe)
     ======================================================= */
  let audioCtx = null;
  function ensureAudio() {
    if (!settings.sound) return null;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    } catch (e) { return null; }
  }
  function playTone(kind) {
    if (!settings.sound) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      if (kind === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.09);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        osc.start(now); osc.stop(now + 0.24);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(105, now + 0.18);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.16, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
        osc.start(now); osc.stop(now + 0.28);
      }
    } catch (e) { /* ignore audio errors */ }
  }

  /* =======================================================
     Settings panel wiring
     ======================================================= */
  function renderStringToggles() {
    stringToggles.innerHTML = '';
    STRINGS.forEach((s, i) => {
      const row = document.createElement('label');
      row.className = 'str-toggle';
      const tag = i === 0 ? ' (high)' : (i === STRINGS.length - 1 ? ' (low)' : '');
      const span = document.createElement('span');
      span.textContent = `${s.stringNum} · ${s.label}${tag}`;
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = settings.strings[i];
      cb.addEventListener('change', () => {
        settings.strings[i] = cb.checked;
        if (settings.strings.every(v => !v)) {
          cb.checked = true;
          settings.strings[i] = true;
          return;
        }
        applyStringVisibility();
        saveState();
        if (state.playing) nextQuestion();
      });
      row.appendChild(span);
      row.appendChild(cb);
      stringToggles.appendChild(row);
    });
  }

  function syncRangeRadio() {
    const val = `${settings.rangeMin}-${settings.rangeMax}`;
    document.querySelectorAll('#rangeRadios input').forEach(r => { r.checked = (r.value === val); });
  }
  function syncAccidentalRadio() {
    document.querySelectorAll('#accidentalRadios input').forEach(r => { r.checked = (r.value === settings.accidental); });
  }

  function wireSettings() {
    document.querySelectorAll('#rangeRadios input').forEach(r => {
      r.addEventListener('change', () => {
        if (!r.checked) return;
        const [min, max] = r.value.split('-').map(Number);
        settings.rangeMin = min; settings.rangeMax = max;
        saveState();
        updateRangeVisual();
        if (state.playing) nextQuestion();
      });
    });
    document.querySelectorAll('#accidentalRadios input').forEach(r => {
      r.addEventListener('change', () => {
        if (!r.checked) return;
        settings.accidental = r.value;
        saveState();
        renderNotePad();
      });
    });
    naturalsOnlyEl.checked = settings.naturalsOnly;
    naturalsOnlyEl.addEventListener('change', () => {
      settings.naturalsOnly = naturalsOnlyEl.checked;
      saveState();
      renderNotePad();
      if (state.playing) nextQuestion();
    });

    timerEnabledEl.checked = settings.timerEnabled;
    timerSecondsRow.hidden = !settings.timerEnabled;
    timerEnabledEl.addEventListener('change', () => {
      settings.timerEnabled = timerEnabledEl.checked;
      timerSecondsRow.hidden = !settings.timerEnabled;
      saveState();
      if (!settings.timerEnabled) { clearTimeout(state.timeoutHandle); clearTimeout(state.dangerHandle); hideTimerBar(); }
    });
    timerSecondsEl.value = String(settings.timerSeconds);
    timerSecondsEl.addEventListener('change', () => {
      settings.timerSeconds = Number(timerSecondsEl.value);
      saveState();
    });

    resetStatsBtn.addEventListener('click', () => {
      if (!confirm('Reset your streak and accuracy stats?')) return;
      stats.streak = 0; stats.bestStreak = 0; stats.correct = 0; stats.total = 0;
      saveState();
      updateLCD();
    });

    soundToggle.setAttribute('aria-pressed', String(settings.sound));
    soundToggle.addEventListener('click', () => {
      settings.sound = !settings.sound;
      soundToggle.setAttribute('aria-pressed', String(settings.sound));
      saveState();
    });
  }

  /* =======================================================
     Keyboard shortcuts: c d e f g a b select natural notes,
     Shift+ (c d f g a) selects the sharp above it.
     ======================================================= */
  function wireKeyboard() {
    const letterMap = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
    const sharpable = new Set(['c', 'd', 'f', 'g', 'a']);
    document.addEventListener('keydown', (evt) => {
      const tag = evt.target && evt.target.tagName;
      if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!state.playing || !state.current) return;
      const lower = evt.key.toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(letterMap, lower)) return;
      let idx = letterMap[lower];
      if (evt.shiftKey && sharpable.has(lower)) idx = idx + 1;
      const btn = notePad.querySelector(`[data-note-index="${idx}"]`);
      if (btn && !btn.disabled) btn.click();
    });
  }

  /* =======================================================
     Install prompt (Android/desktop Chrome) + iOS hint
     ======================================================= */
  function wireInstall() {
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      installBtn.hidden = false;
    });
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installBtn.hidden = true;
    });
    window.addEventListener('appinstalled', () => { installBtn.hidden = true; });

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    if (isIOS && !isStandalone) iosHint.hidden = false;
  }

  function wireServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      });
    }
  }

  /* =======================================================
     Init
     ======================================================= */
  function init() {
    buildBoard();
    updateRangeVisual();
    applyStringVisibility();
    renderStringToggles();
    syncRangeRadio();
    syncAccidentalRadio();
    renderNotePad();
    wireSettings();
    wireKeyboard();
    updateLCD();

    // Core interaction wired first — must not depend on the optional
    // enhancements below, so a quirky/older browser can't lose Start.
    startBtn.addEventListener('click', () => {
      if (state.playing) stopSession(); else startSession();
    });

    // Progressive enhancements: never let one break the app.
    try { wireInstall(); } catch (e) { /* install prompt/hint is optional */ }
    try { wireServiceWorker(); } catch (e) { /* offline caching is optional */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
