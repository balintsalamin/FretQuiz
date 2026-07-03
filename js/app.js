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
    mode: 'identify',      // 'identify' | 'locate' | 'mic'
    showNotes: false,
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
    current: null,      // { stringIndex, fret, noteIndex } (stringIndex/fret null in mic mode)
    lastPick: null,
    advanceHandle: null,
    timeoutHandle: null,
    dangerHandle: null,
    micStreak: { note: null, count: 0 },
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
  const showNotesEl = document.getElementById('showNotes');
  const modeSwitch = document.getElementById('modeSwitch');
  const micUnsupportedNote = document.getElementById('micUnsupportedNote');
  const targetNoteWrap = document.getElementById('targetNoteWrap');
  const targetNoteLabel = document.getElementById('targetNoteLabel');
  const targetNoteEl = document.getElementById('targetNoteEl');
  const micPanel = document.getElementById('micPanel');
  const micOrb = document.getElementById('micOrb');
  const micHeardNote = document.getElementById('micHeardNote');
  const micCentsNeedle = document.getElementById('micCentsNeedle');

  let markerEl, dimLeft, dimRight, hitGroupEl, noteLabelsGroupEl;
  const noteLabelEls = []; // [{ el, noteIndex }] for relabeling on accidental change

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

    // note-name reference chips (toggled via "Show note names")
    noteLabelsGroupEl = el('g', { id: 'noteLabelsGroup', class: 'fb-notelabels' });
    STRINGS.forEach((s, si) => {
      const strGroup = el('g', { class: 'fb-notelabel-string', 'data-string-index': si });
      for (let fret = 0; fret <= FRETS; fret++) {
        const cx = fret === 0 ? OPEN_X : fretCellX(fret);
        const noteIndex = (s.openIndex + fret) % 12;
        strGroup.appendChild(el('circle', { class: 'fb-notechip', cx, cy: s.y, r: 11 }));
        const t = el('text', { class: 'fb-notechip-label', x: cx, y: s.y });
        t.textContent = noteLabel(noteIndex);
        strGroup.appendChild(t);
        noteLabelEls.push({ el: t, noteIndex });
      }
      noteLabelsGroupEl.appendChild(strGroup);
    });
    boardSvg.appendChild(noteLabelsGroupEl);

    // dim overlays for excluded fret range
    dimLeft = el('rect', { id: 'dimLeftZone', class: 'fb-zone-dim', x: 0, y: NECK_TOP, width: 0, height: NECK_BOTTOM - NECK_TOP });
    dimRight = el('rect', { id: 'dimRightZone', class: 'fb-zone-dim', x: BOARD_RIGHT, y: NECK_TOP, width: 0, height: NECK_BOTTOM - NECK_TOP });
    boardSvg.appendChild(dimLeft);
    boardSvg.appendChild(dimRight);

    // clickable hit-grid for "Find the Note" mode (invisible, one cell per string/fret)
    hitGroupEl = el('g', { id: 'hitGroup', class: 'fb-hitgroup' });
    STRINGS.forEach((s, si) => {
      for (let fret = 0; fret <= FRETS; fret++) {
        const x0 = fret === 0 ? 0 : fretLineX(fret - 1);
        const x1 = fret === 0 ? NUT_X : fretLineX(fret);
        const h = STEP_Y * 0.9;
        hitGroupEl.appendChild(el('rect', {
          class: 'fb-hit', 'data-string-index': si, 'data-fret': fret,
          x: x0, y: s.y - h / 2, width: x1 - x0, height: h,
        }));
      }
    });
    hitGroupEl.addEventListener('click', onBoardClick);
    boardSvg.appendChild(hitGroupEl);

    // marker (the note to identify / the reveal after answering)
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
      const labelGroupEl = boardSvg.querySelector(`.fb-notelabel-string[data-string-index="${i}"]`);
      if (labelGroupEl) labelGroupEl.classList.toggle('disabled', !settings.strings[i]);
    });
  }

  function applyShowNotes() {
    if (noteLabelsGroupEl) noteLabelsGroupEl.classList.toggle('visible', settings.showNotes);
  }

  function updateNoteLabelsText() {
    noteLabelEls.forEach(({ el: t, noteIndex }) => { t.textContent = noteLabel(noteIndex); });
  }

  /* =======================================================
     Notation helpers
     ======================================================= */
  function noteLabel(idx) {
    return (settings.accidental === 'flat' ? NOTE_FLAT : NOTE_SHARP)[idx];
  }

  /* =======================================================
     Answer pad (identify mode)
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
      btn.addEventListener('click', () => handleAnswer(idx, { btnEl: btn }, false));
      notePad.appendChild(btn);
    });
    syncPadDisabled();
  }
  function syncPadDisabled() {
    const enabled = state.playing && !!state.current && settings.mode === 'identify';
    Array.from(notePad.children).forEach(b => { b.disabled = !enabled; });
  }

  /* =======================================================
     Mode switching (Name it / Find it / Play it)
     ======================================================= */
  function applyModeUI() {
    Array.from(modeSwitch.querySelectorAll('.mode-btn')).forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.mode === settings.mode));
    });
    notePad.style.display = settings.mode === 'identify' ? '' : 'none';
    if (hitGroupEl) hitGroupEl.classList.toggle('active', settings.mode === 'locate');
    if (settings.mode !== 'mic') micPanel.hidden = true;
    if (settings.mode === 'identify') targetNoteWrap.hidden = true;
  }

  function wireModeSwitch() {
    Array.from(modeSwitch.querySelectorAll('.mode-btn')).forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled || btn.dataset.mode === settings.mode) return;
        if (state.playing) stopSession();
        settings.mode = btn.dataset.mode;
        saveState();
        applyModeUI();
      });
    });
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
  function getEligibleNoteIndexes() {
    return Array.from(new Set(getEligiblePairs().map(p => p.noteIndex)));
  }

  function nextQuestion() {
    clearTimeout(state.advanceHandle);
    clearTimeout(state.timeoutHandle);
    clearTimeout(state.dangerHandle);
    hideTimerBar();

    const mode = settings.mode;

    if (mode === 'mic') {
      const notes = getEligibleNoteIndexes();
      if (notes.length === 0) {
        promptText.textContent = 'No notes match these settings — enable a string or widen the range.';
        stopSession();
        return;
      }
      let noteIndex;
      do {
        noteIndex = notes[Math.floor(Math.random() * notes.length)];
      } while (notes.length > 1 && state.lastPick && noteIndex === state.lastPick.noteIndex);
      state.lastPick = { noteIndex };
      state.current = { noteIndex, stringIndex: null, fret: null };
      state.micStreak = { note: null, count: 0 };
    } else {
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
    }

    promptText.classList.remove('correct', 'wrong');

    if (mode === 'identify') {
      positionMarker(state.current.stringIndex, state.current.fret);
      markerEl.classList.remove('hidden', 'correct', 'wrong');
      targetNoteWrap.hidden = true;
      micPanel.hidden = true;
      Array.from(notePad.children).forEach(b => { b.disabled = false; b.classList.remove('is-correct', 'is-wrong'); });
      promptText.textContent = 'Which note is this?';
    } else if (mode === 'locate') {
      markerEl.classList.add('hidden');
      markerEl.classList.remove('correct', 'wrong');
      micPanel.hidden = true;
      targetNoteWrap.hidden = false;
      targetNoteLabel.textContent = 'find';
      targetNoteEl.textContent = noteLabel(state.current.noteIndex);
      promptText.textContent = 'Tap the matching note on the fretboard';
    } else { // mic
      markerEl.classList.add('hidden');
      markerEl.classList.remove('correct', 'wrong');
      targetNoteWrap.hidden = false;
      targetNoteLabel.textContent = 'play';
      targetNoteEl.textContent = noteLabel(state.current.noteIndex);
      micPanel.hidden = false;
      micHeardNote.textContent = '—';
      micHeardNote.classList.remove('match');
      updateCentsNeedle(null);
      promptText.textContent = 'Play that note on your guitar';
      startMicLoop();
    }

    if (settings.timerEnabled) {
      showTimerBar(settings.timerSeconds);
      state.timeoutHandle = setTimeout(() => handleAnswer(-1, {}, true), settings.timerSeconds * 1000);
    }
  }

  function handleAnswer(selectedIndex, meta, isTimeout) {
    if (!state.playing || !state.current) return;
    clearTimeout(state.timeoutHandle);
    clearTimeout(state.dangerHandle);
    hideTimerBar();

    meta = meta || {};
    const mode = settings.mode;
    const correctIndex = state.current.noteIndex;
    const isCorrect = !isTimeout && selectedIndex === correctIndex;
    let pluckStringIndex = null;

    if (mode === 'identify') {
      Array.from(notePad.children).forEach(b => { b.disabled = true; });
      const correctBtn = notePad.querySelector(`[data-note-index="${correctIndex}"]`);
      if (correctBtn) correctBtn.classList.add('is-correct');
      if (!isCorrect && meta.btnEl) meta.btnEl.classList.add('is-wrong');
      markerEl.classList.toggle('correct', isCorrect);
      markerEl.classList.toggle('wrong', !isCorrect);
      pluckStringIndex = state.current.stringIndex;
    } else if (mode === 'locate') {
      const posStringIndex = isTimeout ? state.current.stringIndex : meta.stringIndex;
      const posFret = isTimeout ? state.current.fret : meta.fret;
      positionMarker(posStringIndex, posFret);
      markerEl.classList.remove('hidden');
      markerEl.classList.toggle('correct', isCorrect);
      markerEl.classList.toggle('wrong', !isCorrect);
      pluckStringIndex = posStringIndex;
    } else { // mic
      stopMicLoop();
    }

    if (isCorrect && pluckStringIndex !== null) {
      const strEl = boardSvg.querySelector(`.fb-string[data-string-index="${pluckStringIndex}"]`);
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

    const targetLabel = noteLabel(correctIndex);
    promptText.classList.remove('correct', 'wrong');
    if (isCorrect) {
      promptText.innerHTML = `Nice — that's <strong>${targetLabel}</strong>`;
      promptText.classList.add('correct');
    } else if (isTimeout) {
      promptText.innerHTML = `Too slow — it was <strong>${targetLabel}</strong>`;
      promptText.classList.add('wrong');
    } else if (mode === 'identify') {
      promptText.innerHTML = `Not quite — it was <strong>${targetLabel}</strong>`;
      promptText.classList.add('wrong');
    } else if (mode === 'locate') {
      const clickedLabel = noteLabel(selectedIndex);
      promptText.innerHTML = `That's <strong>${clickedLabel}</strong> — looking for <strong>${targetLabel}</strong>`;
      promptText.classList.add('wrong');
    } else { // mic
      const heardLabel = noteLabel(selectedIndex);
      promptText.innerHTML = `Heard <strong>${heardLabel}</strong> — looking for <strong>${targetLabel}</strong>`;
      promptText.classList.add('wrong');
    }

    state.current = null;
    state.advanceHandle = setTimeout(() => { if (state.playing) nextQuestion(); }, isCorrect ? 900 : 1500);
  }

  /* =======================================================
     "Find the Note" mode: clicking the fretboard
     ======================================================= */
  function onBoardClick(e) {
    if (settings.mode !== 'locate' || !state.playing || !state.current) return;
    const rect = e.target && e.target.closest ? e.target.closest('.fb-hit') : null;
    if (!rect) return;
    const si = Number(rect.dataset.stringIndex);
    const fret = Number(rect.dataset.fret);
    if (!settings.strings[si]) return;
    if (fret < settings.rangeMin || fret > settings.rangeMax) return;
    const noteIndex = (STRINGS[si].openIndex + fret) % 12;
    handleAnswer(noteIndex, { stringIndex: si, fret }, false);
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

  /* =======================================================
     "Play the Note" mode: microphone pitch detection
     No external libraries — a small autocorrelation (ACF)
     pitch detector running on live mic input.
     ======================================================= */
  const secureCtx = typeof window.isSecureContext === 'boolean' ? window.isSecureContext : true;
  const micSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && secureCtx;

  let micStream = null, micAudioCtx = null, micAnalyser = null, micDataBuf = null, micRAFId = null;
  const MIC_CLARITY_THRESHOLD = 0.90;
  const MIC_STABLE_FRAMES = 10;

  async function ensureMicAccess() {
    if (micAnalyser) return;
    if (!micSupported) throw new Error('this browser has no microphone support.');
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    micAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = micAudioCtx.createMediaStreamSource(micStream);
    micAnalyser = micAudioCtx.createAnalyser();
    micAnalyser.fftSize = 2048;
    micDataBuf = new Float32Array(micAnalyser.fftSize);
    src.connect(micAnalyser);
  }

  function teardownMic() {
    if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
    if (micAudioCtx) { micAudioCtx.close().catch(() => {}); micAudioCtx = null; }
    micAnalyser = null;
    micDataBuf = null;
  }

  // Autocorrelation pitch detector (ACF-style): trims near-silence,
  // finds the lag of strongest self-similarity beyond the first
  // downward slope, then refines it with parabolic interpolation.
  function autoCorrelate(buf, sampleRate) {
    let rms = 0;
    for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / buf.length);
    if (rms < 0.01) return { frequency: -1, clarity: 0, rms };

    let start = 0, end = buf.length - 1;
    const thresh = rms * 0.5;
    while (start < buf.length && Math.abs(buf[start]) < thresh) start++;
    while (end > 0 && Math.abs(buf[end]) < thresh) end--;
    if (end - start < 512) return { frequency: -1, clarity: 0, rms };
    const trimmed = buf.slice(start, end + 1);
    const size = trimmed.length;

    let energy = 0;
    for (let i = 0; i < size; i++) energy += trimmed[i] * trimmed[i];
    if (energy <= 0) return { frequency: -1, clarity: 0, rms };

    const minLag = Math.max(2, Math.floor(sampleRate / 1000));  // ignore >1000Hz
    const maxLag = Math.min(size - 1, Math.floor(sampleRate / 70)); // ignore <70Hz
    if (maxLag <= minLag) return { frequency: -1, clarity: 0, rms };

    const corr = new Float32Array(maxLag + 1);
    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < size - lag; i++) sum += trimmed[i] * trimmed[i + lag];
      corr[lag] = sum;
    }

    let d = minLag;
    while (d < maxLag - 1 && corr[d] > corr[d + 1]) d++;

    let bestLag = -1, bestVal = -Infinity;
    for (let lag = d; lag <= maxLag; lag++) {
      if (corr[lag] > bestVal) { bestVal = corr[lag]; bestLag = lag; }
    }
    if (bestLag <= 0) return { frequency: -1, clarity: 0, rms };

    let refinedLag = bestLag;
    const prev = corr[bestLag - 1], curr = corr[bestLag], next = corr[bestLag + 1];
    if (next !== undefined) {
      const denom = (prev - 2 * curr + next);
      if (denom !== 0) refinedLag = bestLag + 0.5 * (prev - next) / denom;
    }

    const clarity = bestVal / energy;
    const frequency = sampleRate / refinedLag;
    return { frequency, clarity, rms };
  }

  function updateCentsNeedle(cents) {
    if (!micCentsNeedle) return;
    if (cents === null) {
      micCentsNeedle.style.left = '50%';
      micCentsNeedle.classList.remove('in-tune');
      return;
    }
    const pct = 50 + (cents / 50) * 46;
    micCentsNeedle.style.left = pct + '%';
    micCentsNeedle.classList.toggle('in-tune', Math.abs(cents) <= 10);
  }

  function startMicLoop() {
    if (micRAFId !== null || !micAnalyser) return;
    micOrb.classList.add('hot');
    const loop = () => {
      if (!(state.playing && settings.mode === 'mic' && state.current) || !micAnalyser) {
        micRAFId = null;
        micOrb.classList.remove('hot');
        return;
      }
      micAnalyser.getFloatTimeDomainData(micDataBuf);
      const { frequency, clarity } = autoCorrelate(micDataBuf, micAudioCtx.sampleRate);

      if (frequency > 0 && clarity > MIC_CLARITY_THRESHOLD) {
        const midi = 69 + 12 * Math.log2(frequency / 440);
        const rounded = Math.round(midi);
        const heardIndex = ((rounded % 12) + 12) % 12;
        const cents = Math.max(-50, Math.min(50, Math.round((midi - rounded) * 100)));

        micHeardNote.textContent = noteLabel(heardIndex);
        micHeardNote.classList.toggle('match', heardIndex === state.current.noteIndex);
        updateCentsNeedle(cents);

        if (state.micStreak.note === heardIndex) state.micStreak.count++;
        else state.micStreak = { note: heardIndex, count: 1 };

        if (state.micStreak.count >= MIC_STABLE_FRAMES) {
          micRAFId = null;
          micOrb.classList.remove('hot');
          handleAnswer(heardIndex, {}, false);
          return;
        }
      } else {
        micHeardNote.textContent = '—';
        micHeardNote.classList.remove('match');
        updateCentsNeedle(null);
        state.micStreak = { note: null, count: 0 };
      }

      micRAFId = requestAnimationFrame(loop);
    };
    micRAFId = requestAnimationFrame(loop);
  }

  function stopMicLoop() {
    if (micRAFId !== null) { cancelAnimationFrame(micRAFId); micRAFId = null; }
    if (micOrb) micOrb.classList.remove('hot');
  }

  /* =======================================================
     Session start/stop
     ======================================================= */
  async function startSession() {
    ensureAudio();

    if (settings.mode === 'mic') {
      startBtn.disabled = true;
      startBtn.textContent = 'Connecting…';
      promptText.textContent = 'Requesting microphone access…';
      try {
        await ensureMicAccess();
      } catch (err) {
        startBtn.disabled = false;
        startBtn.textContent = 'Start';
        promptText.textContent = 'Microphone access is required for this mode — ' +
          (err && err.message ? err.message : 'permission was denied.');
        return;
      }
      startBtn.disabled = false;
    }

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
    stopMicLoop();
    teardownMic();
    if (markerEl) markerEl.classList.add('hidden');
    state.current = null;
    startBtn.disabled = false;
    startBtn.textContent = 'Start';
    startBtn.classList.remove('is-playing');
    promptText.innerHTML = 'Tap <strong>Start</strong> to begin';
    promptText.classList.remove('correct', 'wrong');
    targetNoteWrap.hidden = true;
    micPanel.hidden = true;
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
        updateNoteLabelsText();
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

    showNotesEl.checked = settings.showNotes;
    applyShowNotes();
    showNotesEl.addEventListener('change', () => {
      settings.showNotes = showNotesEl.checked;
      saveState();
      applyShowNotes();
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
     Keyboard shortcuts (identify mode only):
     c d e f g a b select natural notes,
     Shift+ (c d f g a) selects the sharp above it.
     ======================================================= */
  function wireKeyboard() {
    const letterMap = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
    const sharpable = new Set(['c', 'd', 'f', 'g', 'a']);
    document.addEventListener('keydown', (evt) => {
      const tag = evt.target && evt.target.tagName;
      if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (settings.mode !== 'identify') return;
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
    wireModeSwitch();
    updateLCD();

    if (!micSupported) {
      const micBtn = modeSwitch.querySelector('[data-mode="mic"]');
      if (micBtn) {
        micBtn.disabled = true;
        micBtn.title = 'Requires microphone support in a secure (https) context.';
      }
      micUnsupportedNote.hidden = false;
      if (settings.mode === 'mic') settings.mode = 'identify'; // don't strand the user on a dead mode
    }
    applyModeUI();

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
