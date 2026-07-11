(() => {
  'use strict';

  /* =======================================================
     Music data
     ======================================================= */
  const NOTE_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const NOTE_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
  const NATURAL_SET = new Set([0,2,4,5,7,9,11]);

  // Scale definitions: semitone offsets from the root, plus the
  // degree label shown on the fretboard/quiz pad for each offset.
  const SCALES = {
    major:   { name: 'Major',            intervals: [0,2,4,5,7,9,11], degrees: ['1','2','3','4','5','6','7'] },
    minor:   { name: 'Natural Minor',    intervals: [0,2,3,5,7,8,10], degrees: ['1','2','♭3','4','5','♭6','♭7'] },
    majPent: { name: 'Major Pentatonic', intervals: [0,2,4,7,9],      degrees: ['1','2','3','5','6'] },
    minPent: { name: 'Minor Pentatonic', intervals: [0,3,5,7,10],     degrees: ['1','♭3','4','5','♭7'] },
    blues:   { name: 'Blues',            intervals: [0,3,5,6,7,10],   degrees: ['1','♭3','4','♭5','5','♭7'] },
  };

  // Chord qualities: semitone offsets from the root, a display label,
  // and the symbol suffix appended after the root letter (e.g. "m7").
  const CHORD_QUALITIES = {
    major: { intervals: [0,4,7],      label: 'Major',            suffix: '' },
    minor: { intervals: [0,3,7],      label: 'Minor',            suffix: 'm' },
    dom7:  { intervals: [0,4,7,10],   label: '7',                suffix: '7' },
    maj7:  { intervals: [0,4,7,11],   label: 'Major 7',          suffix: 'maj7' },
    m7:    { intervals: [0,3,7,10],   label: 'Minor 7',          suffix: 'm7' },
    m7b5:  { intervals: [0,3,6,10],   label: 'Half-diminished',  suffix: 'm7b5' },
    dim:   { intervals: [0,3,6],      label: 'Diminished',       suffix: 'dim' },
    dim7:  { intervals: [0,3,6,9],    label: 'Diminished 7',     suffix: 'dim7' },
    aug:   { intervals: [0,4,8],      label: 'Augmented',        suffix: 'aug' },
    sus2:  { intervals: [0,2,7],      label: 'Sus2',             suffix: 'sus2' },
    sus4:  { intervals: [0,5,7],      label: 'Sus4',             suffix: 'sus4' },
    add9:  { intervals: [0,4,7,2],    label: 'Add9',             suffix: 'add9' },
    six:   { intervals: [0,4,7,9],    label: '6',                suffix: '6' },
    m6:    { intervals: [0,3,7,9],    label: 'Minor 6',          suffix: 'm6' },
    nine:  { intervals: [0,4,7,10,2], label: '9',                suffix: '9' },
    m9:    { intervals: [0,3,7,10,2], label: 'Minor 9',          suffix: 'm9' },
    power: { intervals: [0,7],        label: 'Power chord',      suffix: '5' },
  };

  // Text -> quality key. Checked case-sensitively first (so 'm' vs 'M'
  // stay distinct), then case-insensitively as a fallback.
  const CHORD_SUFFIX_ALIASES = {
    '': 'major', 'maj': 'major', 'M': 'major',
    'm': 'minor', 'min': 'minor', '-': 'minor',
    '7': 'dom7',
    'maj7': 'maj7', 'M7': 'maj7', 'Δ': 'maj7', 'Δ7': 'maj7',
    'm7': 'm7', 'min7': 'm7', '-7': 'm7',
    'm7b5': 'm7b5', 'm7-5': 'm7b5', 'ø': 'm7b5',
    'dim': 'dim', '°': 'dim',
    'dim7': 'dim7', '°7': 'dim7',
    'aug': 'aug', '+': 'aug',
    'sus2': 'sus2',
    'sus4': 'sus4', 'sus': 'sus4',
    'add9': 'add9',
    '6': 'six',
    'm6': 'm6', 'min6': 'm6',
    '9': 'nine',
    'm9': 'm9', 'min9': 'm9',
    '5': 'power',
  };

  // "Doesn't have to be strictly the same chord" — a few closely
  // related qualities offered as one-click alternates per chord.
  const CHORD_SUBSTITUTIONS = {
    major: ['dom7', 'maj7', 'sus4', 'add9'],
    minor: ['m7', 'm9', 'm6'],
    dom7:  ['nine', 'major'],
    maj7:  ['six', 'major'],
    m7:    ['m9', 'minor'],
    m7b5:  ['dim7', 'm7'],
    dim:   ['dim7'],
    dim7:  ['dim'],
    aug:   ['major'],
    sus2:  ['major', 'add9'],
    sus4:  ['major', 'add9'],
    add9:  ['major', 'sus4'],
    six:   ['major', 'maj7'],
    m6:    ['minor', 'm7'],
    nine:  ['dom7', 'major'],
    m9:    ['m7', 'minor'],
    power: ['major', 'minor'],
  };

  // Rendered top-to-bottom, the way a player looks down at the neck.
  const STRINGS = [
    { stringNum:1, label:'E', openIndex:4,  kind:'plain', thickness:1.6, openFreq:329.63 },
    { stringNum:2, label:'B', openIndex:11, kind:'plain', thickness:2.1, openFreq:246.94 },
    { stringNum:3, label:'G', openIndex:7,  kind:'plain', thickness:2.6, openFreq:196.00 },
    { stringNum:4, label:'D', openIndex:2,  kind:'wound', thickness:3.2, openFreq:146.83 },
    { stringNum:5, label:'A', openIndex:9,  kind:'wound', thickness:3.8, openFreq:110.00 },
    { stringNum:6, label:'E', openIndex:4,  kind:'wound', thickness:4.4, openFreq:82.41  },
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
    mode: 'identify',      // 'identify' | 'locate' | 'mic' | 'scales'
    showNotes: false,
    instrument: 'electric', // 'electric' | 'acoustic' — tunes mic-mode detection
    scaleRoot: 0,          // pitch class 0-11
    scaleType: 'major',    // key into SCALES
    scalePosition: 0,      // index into computed positions
    scaleFullNeck: false,  // show the whole board instead of one position
    scaleSubMode: 'explore', // 'explore' | 'quiz'
    progressionText: 'C G Am F',
    songSubMode: 'suggest', // 'suggest' | 'keyfinder'
    songKeyRoot: 0,
    songKeyIsMinor: false,
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
    progression: {
      chords: [],        // [{ raw, rootPc, qualityKey, valid }]
      activeIndex: 0,
      viewQuality: null, // substitution override for the active chord, or null
      voicings: [],
      activeVoicingIndex: 0,
    },
    songwriting: {
      lastSuggestion: null,
    },
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
  const degreePad = document.getElementById('degreePad');
  const scaleControls = document.getElementById('scaleControls');
  const scaleRootSelect = document.getElementById('scaleRootSelect');
  const scaleTypeSelect = document.getElementById('scaleTypeSelect');
  const scalePosPrev = document.getElementById('scalePosPrev');
  const scalePosNext = document.getElementById('scalePosNext');
  const scalePositionLabel = document.getElementById('scalePositionLabel');
  const scaleFullNeckEl = document.getElementById('scaleFullNeck');
  const scaleSubModeSwitch = document.getElementById('scaleSubModeSwitch');
  const progressionControls = document.getElementById('progressionControls');
  const progressionInput = document.getElementById('progressionInput');
  const progressionGenerate = document.getElementById('progressionGenerate');
  const progressionChips = document.getElementById('progressionChips');
  const chordDetail = document.getElementById('chordDetail');
  const chordDetailName = document.getElementById('chordDetailName');
  const chordDetailError = document.getElementById('chordDetailError');
  const chordSubRow = document.getElementById('chordSubRow');
  const chordVoicings = document.getElementById('chordVoicings');
  const boardCardEl = document.querySelector('.board-card');
  const songwritingControls = document.getElementById('songwritingControls');
  const songSubModeSwitch = document.getElementById('songSubModeSwitch');
  const suggestPanelEl = document.getElementById('suggestPanel');
  const keyfinderPanelEl = document.getElementById('keyfinderPanel');
  const songKeyRootSelect = document.getElementById('songKeyRootSelect');
  const songKeyModeSelect = document.getElementById('songKeyModeSelect');
  const songSuggestBtn = document.getElementById('songSuggestBtn');
  const songSuggestionRow = document.getElementById('songSuggestionRow');
  const songExploreBtn = document.getElementById('songExploreBtn');
  const songDiatonicRow = document.getElementById('songDiatonicRow');
  const keyfinderInput = document.getElementById('keyfinderInput');
  const keyfinderBtn = document.getElementById('keyfinderBtn');
  const keyfinderError = document.getElementById('keyfinderError');
  const keyfinderResult = document.getElementById('keyfinderResult');
  const keyfinderKeyName = document.getElementById('keyfinderKeyName');
  const keyfinderNote = document.getElementById('keyfinderNote');
  const keyfinderChordRow = document.getElementById('keyfinderChordRow');

  let markerEl, dimLeft, dimRight, hitGroupEl, noteLabelsGroupEl, scaleOverlayGroupEl;
  const noteLabelEls = []; // [{ el, noteIndex }] for relabeling on accidental change
  const scaleOverlayEls = []; // [si][fret] = { dot, label } for fast visibility/color updates

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

    // scale-degree overlay (Scales mode): dots + degree labels, filtered
    // to the active scale/position at update time
    scaleOverlayGroupEl = el('g', { id: 'scaleOverlayGroup', class: 'fb-scale-overlay' });
    STRINGS.forEach((s, si) => {
      const strGroup = el('g', { class: 'fb-scale-string', 'data-string-index': si });
      scaleOverlayEls[si] = [];
      for (let fret = 0; fret <= FRETS; fret++) {
        const cx = fret === 0 ? OPEN_X : fretCellX(fret);
        const dot = el('circle', { class: 'fb-scale-dot hidden', cx, cy: s.y, r: 12 });
        const label = el('text', { class: 'fb-scale-label hidden', x: cx, y: s.y });
        strGroup.appendChild(dot);
        strGroup.appendChild(label);
        scaleOverlayEls[si][fret] = { dot, label };
      }
      scaleOverlayGroupEl.appendChild(strGroup);
    });
    boardSvg.appendChild(scaleOverlayGroupEl);

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
    let minFret = settings.rangeMin, maxFret = settings.rangeMax;
    if (settings.mode === 'scales' && !settings.scaleFullNeck) {
      const positions = computeScalePositions();
      const posIdx = Math.min(settings.scalePosition, positions.length - 1);
      const pos = positions[posIdx];
      if (pos) { minFret = pos.start; maxFret = pos.end; }
    }
    const leftX = minFret > 0 ? fretLineX(minFret) : 0;
    dimLeft.setAttribute('width', leftX);
    const rightX = fretLineX(maxFret);
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
    if (noteLabelsGroupEl) {
      const suppressed = settings.mode === 'scales' || settings.mode === 'progression' || settings.mode === 'songwriting';
      noteLabelsGroupEl.classList.toggle('visible', settings.showNotes && !suppressed);
    }
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

  function renderDegreePad() {
    const scale = currentScale();
    degreePad.innerHTML = '';
    scale.degrees.forEach((label, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'note-btn';
      btn.dataset.degreeIndex = idx;
      btn.textContent = label;
      btn.addEventListener('click', () => handleAnswer(idx, { btnEl: btn }, false));
      degreePad.appendChild(btn);
    });
    syncDegreePadDisabled();
  }
  function syncDegreePadDisabled() {
    const enabled = state.playing && !!state.current && settings.mode === 'scales' && settings.scaleSubMode === 'quiz';
    Array.from(degreePad.children).forEach(b => { b.disabled = !enabled; });
  }

  /* =======================================================
     Scales: data lookups, the 5-position system, and the
     fretboard overlay that visualizes them
     ======================================================= */
  function currentScale() {
    return SCALES[settings.scaleType] || SCALES.major;
  }

  // Which degree (index into scale.degrees) a pitch class belongs to,
  // or -1 if it's not in the current root/scale at all.
  function degreeOfNote(noteIndex) {
    const scale = currentScale();
    for (let i = 0; i < scale.intervals.length; i++) {
      if ((settings.scaleRoot + scale.intervals[i]) % 12 === noteIndex) return i;
    }
    return -1;
  }

  // Derives CAGED-style position windows algorithmically: find every
  // fret where the root note falls on each string, dedupe (standard
  // tuning's two E strings share a value, which is exactly why there
  // are 5 shapes, not 6), sort, and give each a ~4-fret span. Works
  // for any root/scale without hand-authored shape tables.
  function computeScalePositions() {
    const rootFrets = new Set();
    STRINGS.forEach(s => {
      rootFrets.add((settings.scaleRoot - s.openIndex + 12) % 12);
    });
    const anchors = Array.from(rootFrets).sort((a, b) => a - b);
    return anchors.map(a => ({ start: a, end: Math.min(FRETS, a + 3) }));
  }

  function getEligibleScalePairs() {
    const positions = computeScalePositions();
    const posIdx = Math.min(settings.scalePosition, Math.max(0, positions.length - 1));
    const activePos = positions[posIdx] || { start: 0, end: FRETS };
    const minFret = settings.scaleFullNeck ? 0 : activePos.start;
    const maxFret = settings.scaleFullNeck ? FRETS : activePos.end;
    const pairs = [];
    for (let si = 0; si < STRINGS.length; si++) {
      if (!settings.strings[si]) continue;
      for (let fret = minFret; fret <= maxFret; fret++) {
        const noteIndex = (STRINGS[si].openIndex + fret) % 12;
        const degreeIndex = degreeOfNote(noteIndex);
        if (degreeIndex === -1) continue;
        pairs.push({ stringIndex: si, fret, noteIndex, degreeIndex });
      }
    }
    return pairs;
  }

  // Repaints every dot/label in the scale overlay to match the
  // current root/scale/position, and refreshes the position-stepper
  // label and button states.
  function updateScaleOverlay() {
    if (!scaleOverlayGroupEl) return;
    const scale = currentScale();
    const positions = computeScalePositions();
    const posIdx = Math.min(settings.scalePosition, Math.max(0, positions.length - 1));
    const activePos = positions[posIdx] || { start: 0, end: FRETS };

    STRINGS.forEach((s, si) => {
      for (let fret = 0; fret <= FRETS; fret++) {
        const noteIndex = (s.openIndex + fret) % 12;
        const degreeIndex = degreeOfNote(noteIndex);
        const inScale = degreeIndex !== -1;
        const inWindow = settings.scaleFullNeck || (fret >= activePos.start && fret <= activePos.end);
        const visible = inScale && inWindow;
        const { dot, label } = scaleOverlayEls[si][fret];
        dot.classList.toggle('hidden', !visible);
        label.classList.toggle('hidden', !visible);
        dot.classList.toggle('root', visible && degreeIndex === 0);
        if (visible) label.textContent = scale.degrees[degreeIndex];
      }
    });

    if (scalePositionLabel) {
      scalePositionLabel.textContent = settings.scaleFullNeck
        ? 'Full neck'
        : `Position ${posIdx + 1} of ${positions.length}`;
    }
    if (scalePosPrev) scalePosPrev.disabled = settings.scaleFullNeck || posIdx <= 0;
    if (scalePosNext) scalePosNext.disabled = settings.scaleFullNeck || posIdx >= positions.length - 1;
  }

  /* =======================================================
     Chords / Progression mode
     ======================================================= */
  const NOTE_LETTER_TO_PC = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };

  // "C", "G7", "F#m7", "Bbmaj7", "Dsus4" ... -> { rootPc, qualityKey, symbol } or null
  function parseChordSymbol(raw) {
    const text = String(raw).trim();
    if (!text) return null;
    const m = /^([A-Ga-g])([#♯b♭]?)(.*)$/.exec(text);
    if (!m) return null;
    const letter = m[1].toUpperCase();
    let pc = NOTE_LETTER_TO_PC[letter];
    if (pc === undefined) return null;
    if (m[2] === '#' || m[2] === '♯') pc = (pc + 1) % 12;
    else if (m[2] === 'b' || m[2] === '♭') pc = (pc + 11) % 12;

    const rest = m[3].trim();
    let qualityKey = Object.prototype.hasOwnProperty.call(CHORD_SUFFIX_ALIASES, rest)
      ? CHORD_SUFFIX_ALIASES[rest]
      : undefined;
    if (qualityKey === undefined) {
      const lower = rest.toLowerCase();
      qualityKey = Object.prototype.hasOwnProperty.call(CHORD_SUFFIX_ALIASES, lower)
        ? CHORD_SUFFIX_ALIASES[lower]
        : undefined;
    }
    if (qualityKey === undefined) return null;
    return { rootPc: pc, qualityKey, symbol: text };
  }

  function chordSymbolFor(rootPc, qualityKey) {
    const q = CHORD_QUALITIES[qualityKey];
    return noteLabel(rootPc) + (q ? q.suffix : '');
  }

  // How essential a chord tone is to identifying the chord's quality —
  // used to score candidate voicings (root/3rd matter more than the 5th).
  function intervalWeight(semitone) {
    if (semitone === 0) return 3;
    if (semitone === 2 || semitone === 3 || semitone === 4 || semitone === 5) return 3;
    if (semitone === 9 || semitone === 10 || semitone === 11) return 2;
    return 1;
  }

  // Best-scoring playable fingering within a single fret window.
  function searchChordWindow(fretMin, fretMax, targetPCs, weights, rootPc, allowOpen, minStrings) {
    const candidates = STRINGS.map((s) => {
      const opts = [null];
      for (let fret = fretMin; fret <= fretMax; fret++) {
        if (fret === 0 && !allowOpen) continue;
        const pc = (s.openIndex + fret) % 12;
        if (targetPCs.has(pc)) opts.push(fret);
      }
      return opts;
    });

    let best = null, bestScore = -Infinity;
    const sizes = candidates.map(c => c.length);
    const total = sizes.reduce((a, b) => a * b, 1);
    for (let idx = 0; idx < total; idx++) {
      let rem = idx;
      const combo = [];
      for (let si = 0; si < 6; si++) { combo.push(candidates[si][rem % sizes[si]]); rem = Math.floor(rem / sizes[si]); }
      const played = combo.map((f, si) => (f === null ? null : { si, f })).filter(Boolean);
      if (played.length < minStrings) continue;

      const soundingPCs = new Set(played.map(p => (STRINGS[p.si].openIndex + p.f) % 12));
      if (!soundingPCs.has(rootPc)) continue;

      const frettedNonOpen = played.filter(p => p.f > 0).map(p => p.f);
      if (frettedNonOpen.length > 0) {
        const span = Math.max(...frettedNonOpen) - Math.min(...frettedNonOpen);
        if (span > 4) continue;
      }

      let score = 0;
      soundingPCs.forEach(pc => { score += weights[pc] || 0; });
      // STRINGS is ordered high-E(0)..low-E(5), so the physically
      // lowest-pitched played string has the largest string index.
      const lowestPitchString = played.reduce((a, b) => (a.si > b.si ? a : b));
      const lowestPc = (STRINGS[lowestPitchString.si].openIndex + lowestPitchString.f) % 12;
      if (lowestPc === rootPc) score += 2;
      score += Math.min(3, Math.max(0, played.length - 3));

      if (score > bestScore) { bestScore = score; best = { combo, score, played }; }
    }
    return best;
  }

  // Up to 4 distinct, sensibly-spread voicings for a chord: the open/
  // first-position shape (if playable) is always included first, then
  // the best higher voicings that are at clearly different positions.
  function findChordVoicings(rootPc, intervals, opts) {
    opts = opts || {};
    const minStrings = opts.minStrings || 3;
    const targetPCs = new Set(intervals.map(iv => (rootPc + iv) % 12));
    const weights = {};
    intervals.forEach(iv => { weights[(rootPc + iv) % 12] = intervalWeight(iv); });

    const perWindow = [];
    for (let ws = 0; ws <= 8; ws++) {
      const r = searchChordWindow(ws, ws + 4, targetPCs, weights, rootPc, ws === 0, minStrings);
      if (r) perWindow.push(r);
    }
    if (perWindow.length === 0) return [];

    const seen = new Set();
    const distinct = [];
    perWindow.forEach(r => { const key = r.combo.join(','); if (!seen.has(key)) { seen.add(key); distinct.push(r); } });

    const chosen = [];
    if (perWindow[0]) chosen.push(perWindow[0]);
    distinct.slice().sort((a, b) => b.score - a.score).forEach(r => {
      if (chosen.includes(r)) return;
      const frets = r.played.filter(p => p.f > 0).map(p => p.f);
      const lowest = frets.length ? Math.min(...frets) : 0;
      const tooClose = chosen.some(c => {
        const cf = c.played.filter(p => p.f > 0).map(p => p.f);
        const cLow = cf.length ? Math.min(...cf) : 0;
        return Math.abs(cLow - lowest) < 2;
      });
      if (!tooClose) chosen.push(r);
    });

    return chosen.slice(0, 4).sort((a, b) => {
      const af = a.played.filter(p => p.f > 0).map(p => p.f); const aLow = af.length ? Math.min(...af) : 0;
      const bf = b.played.filter(p => p.f > 0).map(p => p.f); const bLow = bf.length ? Math.min(...bf) : 0;
      return aLow - bLow;
    });
  }

  /* ---- mini chord-diagram (vertical) SVG ---- */
  function chordDiagramSVG(voicing, rootPc) {
    const comboTopToBottom = STRINGS.map((s, si) => {
      const p = voicing.played.find(pp => pp.si === si);
      return p ? p.f : null;
    });
    const fretted = comboTopToBottom.filter(f => f !== null && f > 0);
    const hasOpen = comboTopToBottom.some(f => f === 0);
    const maxFretted = fretted.length ? Math.max(...fretted) : 0;
    const lowestFretted = fretted.length ? Math.min(...fretted) : 0;
    const baseFret = (hasOpen || maxFretted <= 4) ? 0 : lowestFretted;

    const W = 110, TOP_Y = 34, CELL_H = 24, STRING_X = [10, 28, 46, 64, 82, 100];
    const rows = 4;
    const H = TOP_Y + rows * CELL_H + 14;

    let svg = `<svg viewBox="0 0 ${W} ${H}" class="chord-diagram">`;
    // string lines
    STRING_X.forEach(x => { svg += `<line x1="${x}" y1="${TOP_Y}" x2="${x}" y2="${TOP_Y + rows*CELL_H}" class="cd-string"/>`; });
    // fret lines
    for (let r = 0; r <= rows; r++) {
      const y = TOP_Y + r * CELL_H;
      svg += `<line x1="${STRING_X[0]}" y1="${y}" x2="${STRING_X[5]}" y2="${y}" class="${r===0 && baseFret===0 ? 'cd-nut' : 'cd-fret'}"/>`;
    }
    if (baseFret > 0) {
      svg += `<text x="${STRING_X[5]+8}" y="${TOP_Y+10}" class="cd-fretlabel">${baseFret}fr</text>`;
    }
    // X / O markers above the nut
    comboTopToBottom.forEach((f, si) => {
      const x = STRING_X[si];
      if (f === null) svg += `<text x="${x}" y="${TOP_Y-10}" class="cd-marker">✕</text>`;
      else if (f === 0) svg += `<text x="${x}" y="${TOP_Y-10}" class="cd-marker">○</text>`;
    });
    // dots
    comboTopToBottom.forEach((f, si) => {
      if (f === null || f === 0) return;
      const row = baseFret === 0 ? f : (f - baseFret + 1);
      const y = TOP_Y + (row - 0.5) * CELL_H;
      const pc = (STRINGS[si].openIndex + f) % 12;
      const isRoot = pc === rootPc;
      svg += `<circle cx="${STRING_X[si]}" cy="${y}" r="8" class="cd-dot${isRoot ? ' root' : ''}"/>`;
    });
    svg += '</svg>';
    return svg;
  }

  /* ---- progression parsing + rendering ---- */
  function parseProgression(text) {
    return String(text).split(/[\s,]+/).filter(Boolean).map(raw => {
      const parsed = parseChordSymbol(raw);
      return parsed ? { raw, rootPc: parsed.rootPc, qualityKey: parsed.qualityKey, valid: true }
                     : { raw, rootPc: null, qualityKey: null, valid: false };
    });
  }

  function renderProgressionChips() {
    progressionChips.innerHTML = '';
    state.progression.chords.forEach((chord, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chord-chip' + (idx === state.progression.activeIndex ? ' active' : '') + (!chord.valid ? ' invalid' : '');
      btn.textContent = chord.valid ? chordSymbolFor(chord.rootPc, chord.qualityKey) : chord.raw;
      btn.addEventListener('click', () => {
        state.progression.activeIndex = idx;
        state.progression.viewQuality = null;
        renderProgressionChips();
        renderChordDetail();
      });
      progressionChips.appendChild(btn);
    });
  }

  function renderChordDetail() {
    const chord = state.progression.chords[state.progression.activeIndex];
    if (!chord) { chordDetail.hidden = true; return; }
    chordDetail.hidden = false;

    if (!chord.valid) {
      chordDetailName.textContent = chord.raw;
      chordDetailError.hidden = false;
      chordDetailError.textContent = `Couldn't understand "${chord.raw}" — try things like C, G7, Am, Dmaj7, Fsus4.`;
      chordSubRow.innerHTML = '';
      chordVoicings.innerHTML = '';
      state.progression.voicings = [];
      updateChordOverlay();
      return;
    }
    chordDetailError.hidden = true;

    const viewQualityKey = state.progression.viewQuality || chord.qualityKey;
    const quality = CHORD_QUALITIES[viewQualityKey];
    chordDetailName.textContent = chordSymbolFor(chord.rootPc, viewQualityKey) + ' — ' + quality.label;

    chordSubRow.innerHTML = '';
    const subKeys = [chord.qualityKey, ...((CHORD_SUBSTITUTIONS[chord.qualityKey] || []))];
    subKeys.forEach(qKey => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chord-chip' + (qKey === viewQualityKey ? ' active' : '');
      btn.textContent = chordSymbolFor(chord.rootPc, qKey);
      btn.addEventListener('click', () => {
        state.progression.viewQuality = (qKey === chord.qualityKey) ? null : qKey;
        renderChordDetail();
      });
      chordSubRow.appendChild(btn);
    });

    const voicings = findChordVoicings(chord.rootPc, quality.intervals, { minStrings: viewQualityKey === 'power' ? 2 : 3 });
    state.progression.voicings = voicings;
    state.progression.activeVoicingIndex = 0;
    renderVoicingCards(voicings, chord.rootPc);
    updateChordOverlay();
  }

  function renderVoicingCards(voicings, rootPc) {
    chordVoicings.innerHTML = '';
    if (voicings.length === 0) {
      chordVoicings.innerHTML = '<p class="chord-detail-error">No playable voicing found in range — try a substitution above.</p>';
      return;
    }
    voicings.forEach((v, idx) => {
      const card = document.createElement('div');
      card.className = 'voicing-card' + (idx === state.progression.activeVoicingIndex ? ' selected' : '');
      const fretted = v.played.filter(p => p.f > 0).map(p => p.f);
      const hasOpen = v.played.some(p => p.f === 0);
      const label = (hasOpen || fretted.length === 0 || Math.max(...fretted, 0) <= 4) ? 'Open position' : `${Math.min(...fretted)}th fret`;

      const labelEl = document.createElement('div');
      labelEl.className = 'voicing-card-label';
      labelEl.textContent = label;

      const diagramWrap = document.createElement('div');
      diagramWrap.innerHTML = chordDiagramSVG(v, rootPc);

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'voicing-play-btn';
      playBtn.setAttribute('aria-label', 'Play this voicing');
      playBtn.textContent = '▶';
      playBtn.addEventListener('click', (e) => { e.stopPropagation(); strumVoicing(v); });

      card.appendChild(labelEl);
      card.appendChild(diagramWrap);
      card.appendChild(playBtn);
      card.addEventListener('click', () => {
        state.progression.activeVoicingIndex = idx;
        renderVoicingCards(voicings, rootPc);
        updateChordOverlay();
      });
      chordVoicings.appendChild(card);
    });
  }

  // Reuses the same dot/label elements built for the Scales overlay —
  // only one of Scales/Progression is ever active at a time, so this
  // is just a different way of populating the same visual layer.
  function updateChordOverlay() {
    if (!scaleOverlayGroupEl) return;
    STRINGS.forEach((s, si) => {
      for (let fret = 0; fret <= FRETS; fret++) {
        const { dot, label } = scaleOverlayEls[si][fret];
        dot.classList.add('hidden');
        label.classList.add('hidden');
      }
    });
    const chord = state.progression.chords[state.progression.activeIndex];
    const voicing = state.progression.voicings[state.progression.activeVoicingIndex];
    if (!chord || !chord.valid || !voicing) return;
    voicing.played.forEach(p => {
      const { dot } = scaleOverlayEls[p.si][p.f];
      const pc = (STRINGS[p.si].openIndex + p.f) % 12;
      dot.classList.remove('hidden');
      dot.classList.toggle('root', pc === chord.rootPc);
    });
  }

  function generateProgression() {
    state.progression.chords = parseProgression(progressionInput.value);
    state.progression.activeIndex = 0;
    state.progression.viewQuality = null;
    settings.progressionText = progressionInput.value;
    saveState();
    renderProgressionChips();
    renderChordDetail();
  }

  function stringFrequency(stringIndex, fret) {
    return STRINGS[stringIndex].openFreq * Math.pow(2, fret / 12);
  }

  function strumVoicing(voicing) {
    if (!settings.sound || !voicing) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const notes = voicing.played.slice().sort((a, b) => b.si - a.si); // low string first (downstrum)
      const now = ctx.currentTime;
      notes.forEach((n, i) => {
        const freq = stringFrequency(n.si, n.f);
        const t0 = now + i * 0.035;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t0);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.95);
      });
    } catch (e) { /* ignore audio errors */ }
  }

  function wireProgressionControls() {
    progressionInput.value = settings.progressionText;
    progressionGenerate.addEventListener('click', generateProgression);
    progressionInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') generateProgression();
    });
  }

  /* =======================================================
     Songwriting Helper: diatonic chords, random suggestions,
     and a key finder — built on the same chord-quality data
     used by Progression mode.
     ======================================================= */
  function classifyIntervals(intervals) {
    const key = intervals.join(',');
    for (const qKey in CHORD_QUALITIES) {
      if (CHORD_QUALITIES[qKey].intervals.join(',') === key) return qKey;
    }
    return 'major';
  }

  // The chord built by stacking thirds on a given scale degree,
  // derived directly from the scale's own interval pattern rather
  // than a hand-typed table — works for major/minor automatically
  // and stays correct if more scales are ever added.
  function diatonicChordAt(scaleIntervals, degreeIndex, useSeventh) {
    const n = scaleIntervals.length;
    const steps = useSeventh ? [0, 2, 4, 6] : [0, 2, 4];
    const rootAbs = scaleIntervals[degreeIndex % n];
    const chordIntervals = steps.map(s => {
      const idx = (degreeIndex + s) % n;
      const wraps = Math.floor((degreeIndex + s) / n);
      const abs = scaleIntervals[idx] + wraps * 12;
      return ((abs - rootAbs) % 12 + 12) % 12;
    });
    return { chordIntervals, qualityKey: classifyIntervals(chordIntervals) };
  }

  const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  function romanNumeralFor(degreeIndex, qualityKey) {
    const numeral = ROMAN_NUMERALS[degreeIndex];
    if (qualityKey === 'dim' || qualityKey === 'dim7') return numeral.toLowerCase() + '°';
    if (qualityKey === 'm7b5') return numeral.toLowerCase() + 'ø';
    if (qualityKey === 'minor' || qualityKey === 'm7' || qualityKey === 'm6' || qualityKey === 'm9') return numeral.toLowerCase();
    return numeral;
  }

  function getDiatonicChords(keyRootPc, isMinor, useSeventh) {
    const scaleIntervals = (isMinor ? SCALES.minor : SCALES.major).intervals;
    const chords = [];
    for (let deg = 0; deg < scaleIntervals.length; deg++) {
      const { qualityKey } = diatonicChordAt(scaleIntervals, deg, useSeventh);
      const rootPc = (keyRootPc + scaleIntervals[deg]) % 12;
      chords.push({ degree: deg, rootPc, qualityKey, roman: romanNumeralFor(deg, qualityKey) });
    }
    return chords;
  }

  // Roughly how common each diatonic degree is in real songs — used
  // only to bias the random suggester, not a hard rule.
  const DEGREE_WEIGHTS_MAJOR = [3, 2, 1, 3, 3, 2, 1];
  const DEGREE_WEIGHTS_MINOR = [3, 1, 2, 2, 2, 2, 2];

  function weightedRandomDegree(weights, avoidDegree) {
    let pool = weights.map((w, i) => ({ i, w }));
    if (avoidDegree !== null && pool.length > 1) pool = pool.filter(p => p.i !== avoidDegree);
    const total = pool.reduce((s, p) => s + p.w, 0);
    let r = Math.random() * total;
    for (const p of pool) { if (r < p.w) return p.i; r -= p.w; }
    return pool[pool.length - 1].i;
  }

  function suggestChordProgression(keyRootPc, isMinor, length) {
    const diatonic = getDiatonicChords(keyRootPc, isMinor, false);
    const weights = isMinor ? DEGREE_WEIGHTS_MINOR : DEGREE_WEIGHTS_MAJOR;
    const result = [];
    let prevDeg = null;
    for (let i = 0; i < (length || 4); i++) {
      const deg = weightedRandomDegree(weights, prevDeg);
      result.push(diatonic[deg]);
      prevDeg = deg;
    }
    return result;
  }

  function qualityFamily(qualityKey) {
    if (qualityKey === 'minor' || qualityKey === 'm7' || qualityKey === 'm6' || qualityKey === 'm9') return 'minor';
    if (qualityKey === 'dim' || qualityKey === 'dim7' || qualityKey === 'm7b5') return 'dim';
    return 'major';
  }

  function relativeOf(root, isMinor) {
    return isMinor ? { root: (root + 3) % 12, isMinor: false } : { root: (root + 9) % 12, isMinor: true };
  }

  // Scores all 24 keys (12 roots × major/minor) by how many input
  // chords are diatonic to each, matching by root + broad quality
  // family so "G7" still counts for a plain V, "Dm7" for a plain
  // ii, etc.
  function findMatchingKeys(inputChords) {
    const results = [];
    for (let root = 0; root < 12; root++) {
      [false, true].forEach(isMinor => {
        const diatonic = getDiatonicChords(root, isMinor, false);
        let matchCount = 0;
        inputChords.forEach(c => {
          const fam = qualityFamily(c.qualityKey);
          if (diatonic.some(d => d.rootPc === c.rootPc && qualityFamily(d.qualityKey) === fam)) matchCount++;
        });
        results.push({ root, isMinor, matchCount, diatonic });
      });
    }
    results.sort((a, b) => b.matchCount - a.matchCount);
    return results;
  }

  // Picks a single best-guess key out of the tied top scorers by
  // preferring whichever one the progression actually starts or
  // ends on (songs overwhelmingly resolve to their tonic), and
  // separately notes the true relative major/minor if it's also
  // tied — that's a real, honest ambiguity, not noise.
  function pickBestKey(inputChords) {
    const results = findMatchingKeys(inputChords);
    const topScore = results[0].matchCount;
    const bestKeys = results.filter(r => r.matchCount === topScore);

    const firstRoot = inputChords[0].rootPc;
    const lastRoot = inputChords[inputChords.length - 1].rootPc;
    let candidates = bestKeys.filter(k => k.root === firstRoot);
    if (candidates.length !== 1) candidates = bestKeys.filter(k => k.root === lastRoot);

    let primary = null;
    if (candidates.length === 1) primary = candidates[0];
    else if (bestKeys.length <= 2) primary = bestKeys[0];

    if (!primary) return { ambiguous: true, candidates: bestKeys, topScore, total: inputChords.length };

    const rel = relativeOf(primary.root, primary.isMinor);
    const relative = bestKeys.find(k => k.root === rel.root && k.isMinor === rel.isMinor) || null;
    return { ambiguous: false, primary, relative, topScore, total: inputChords.length };
  }

  function populateNoteSelect(selectEl, selectedValue) {
    selectEl.innerHTML = '';
    for (let i = 0; i < 12; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = noteLabel(i);
      selectEl.appendChild(opt);
    }
    selectEl.value = String(selectedValue);
  }

  function renderChordChipRow(container, chords, onClick) {
    container.innerHTML = '';
    chords.forEach((c, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chord-chip';
      const symbol = chordSymbolFor(c.rootPc, c.qualityKey);
      if (c.roman) {
        btn.innerHTML = `${symbol}<span class="chord-chip-roman">${c.roman}</span>`;
      } else {
        btn.textContent = symbol;
      }
      btn.addEventListener('click', () => (onClick || sendToProgression)(chords, idx));
      container.appendChild(btn);
    });
  }

  // Hands a chord list off to Progression mode so the player can
  // immediately see how to actually play what was just suggested.
  function sendToProgression(chordList, activeIndex) {
    const chords = chordList.map(c => ({
      raw: chordSymbolFor(c.rootPc, c.qualityKey), rootPc: c.rootPc, qualityKey: c.qualityKey, valid: true,
    }));
    const text = chords.map(c => c.raw).join(' ');
    settings.progressionText = text;
    if (progressionInput) progressionInput.value = text;
    state.progression.chords = chords;
    state.progression.activeIndex = activeIndex || 0;
    state.progression.viewQuality = null;
    if (state.playing) stopSession();
    settings.mode = 'progression';
    saveState();
    applyModeUI();
  }

  function runSuggestChords() {
    const rootPc = Number(songKeyRootSelect.value);
    const isMinor = songKeyModeSelect.value === 'minor';
    const chords = suggestChordProgression(rootPc, isMinor, 4);
    state.songwriting.lastSuggestion = chords;
    renderChordChipRow(songSuggestionRow, chords);
    songExploreBtn.hidden = false;
    renderChordChipRow(songDiatonicRow, getDiatonicChords(rootPc, isMinor, false));
  }

  function runKeyFinder() {
    const parsed = parseProgression(keyfinderInput.value).filter(c => c.valid);
    keyfinderResult.hidden = true;
    if (parsed.length === 0) {
      keyfinderError.hidden = false;
      keyfinderError.textContent = "Couldn't parse any chords — try something like C Am F G.";
      return;
    }
    keyfinderError.hidden = true;
    const guess = pickBestKey(parsed);
    keyfinderResult.hidden = false;

    if (guess.ambiguous) {
      keyfinderKeyName.textContent = 'A few possibilities';
      keyfinderNote.hidden = false;
      keyfinderNote.textContent = "Not quite enough here to narrow it to one key — these all fit equally well:";
      renderChordChipRow(keyfinderChordRow,
        guess.candidates.slice(0, 4).map(k => ({ rootPc: k.root, qualityKey: k.isMinor ? 'minor' : 'major' })));
      return;
    }

    const { primary, relative, topScore, total } = guess;
    keyfinderKeyName.textContent = noteLabel(primary.root) + (primary.isMinor ? ' Minor' : ' Major');
    const notes = [];
    if (topScore < total) notes.push(`${topScore} of ${total} chords fit this key — the rest may be borrowed from elsewhere.`);
    if (relative) notes.push(`Could also be read as ${noteLabel(relative.root)} ${relative.isMinor ? 'Minor' : 'Major'} (its relative ${relative.isMinor ? 'minor' : 'major'}) — same chords, different sense of "home".`);
    keyfinderNote.hidden = notes.length === 0;
    keyfinderNote.textContent = notes.join(' ');
    renderChordChipRow(keyfinderChordRow, primary.diatonic);
  }

  function applySongSubModeUI() {
    const sub = settings.songSubMode || 'suggest';
    suggestPanelEl.hidden = sub !== 'suggest';
    keyfinderPanelEl.hidden = sub !== 'keyfinder';
    Array.from(songSubModeSwitch.querySelectorAll('.mode-btn')).forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.submode === sub));
    });
  }

  function wireSongwritingControls() {
    populateNoteSelect(songKeyRootSelect, settings.songKeyRoot);
    songKeyModeSelect.value = settings.songKeyIsMinor ? 'minor' : 'major';

    songKeyRootSelect.addEventListener('change', () => {
      settings.songKeyRoot = Number(songKeyRootSelect.value);
      saveState();
    });
    songKeyModeSelect.addEventListener('change', () => {
      settings.songKeyIsMinor = songKeyModeSelect.value === 'minor';
      saveState();
    });
    songSuggestBtn.addEventListener('click', runSuggestChords);
    songExploreBtn.addEventListener('click', () => {
      if (state.songwriting.lastSuggestion) sendToProgression(state.songwriting.lastSuggestion, 0);
    });

    keyfinderBtn.addEventListener('click', runKeyFinder);
    keyfinderInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runKeyFinder(); });

    Array.from(songSubModeSwitch.querySelectorAll('.mode-btn')).forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.submode === settings.songSubMode) return;
        settings.songSubMode = btn.dataset.submode;
        saveState();
        applySongSubModeUI();
      });
    });
  }

  /* =======================================================
     Mode switching (Name it / Find it / Play it / Scales)
     ======================================================= */
  function applyModeUI() {
    Array.from(modeSwitch.querySelectorAll('.mode-btn')).forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.mode === settings.mode));
    });

    const mode = settings.mode;
    const isScales = mode === 'scales';
    const isProgression = mode === 'progression';
    const isSongwriting = mode === 'songwriting';
    const isExplore = isScales && settings.scaleSubMode === 'explore';

    notePad.style.display = mode === 'identify' ? '' : 'none';
    degreePad.style.display = (isScales && !isExplore) ? '' : 'none';
    startBtn.style.display = (isExplore || isProgression || isSongwriting) ? 'none' : '';
    scaleControls.hidden = !isScales;
    progressionControls.hidden = !isProgression;
    chordDetail.hidden = !isProgression;
    songwritingControls.hidden = !isSongwriting;
    if (boardCardEl) boardCardEl.hidden = isSongwriting;

    if (hitGroupEl) hitGroupEl.classList.toggle('active', mode === 'locate');
    if (mode !== 'mic') micPanel.hidden = true;
    targetNoteWrap.hidden = !(mode === 'locate' || mode === 'mic');

    if (isScales) {
      Array.from(scaleSubModeSwitch.querySelectorAll('.mode-btn')).forEach(b => {
        b.setAttribute('aria-pressed', String(b.dataset.submode === settings.scaleSubMode));
      });
      if (scaleOverlayGroupEl) {
        scaleOverlayGroupEl.classList.add('visible');
        scaleOverlayGroupEl.classList.toggle('quiz-mode', !isExplore);
      }
      if (isExplore) {
        markerEl.classList.add('hidden');
        promptText.innerHTML = 'Explore the scale above — change root, scale, or position any time.';
        promptText.classList.remove('correct', 'wrong');
      } else {
        promptText.innerHTML = 'Tap <strong>Start</strong> to begin';
      }
    } else if (isProgression) {
      markerEl.classList.add('hidden');
      if (scaleOverlayGroupEl) {
        scaleOverlayGroupEl.classList.add('visible');
        scaleOverlayGroupEl.classList.remove('quiz-mode');
      }
      promptText.innerHTML = 'Pick a chord above to see how to play it.';
      promptText.classList.remove('correct', 'wrong');
      if (state.progression.chords.length === 0) generateProgression();
      else { renderProgressionChips(); renderChordDetail(); }
    } else if (isSongwriting) {
      if (scaleOverlayGroupEl) scaleOverlayGroupEl.classList.remove('visible');
      applySongSubModeUI();
    } else if (scaleOverlayGroupEl) {
      scaleOverlayGroupEl.classList.remove('visible');
    }

    applyShowNotes();
    updateRangeVisual();
    if (isScales) updateScaleOverlay();
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

    Array.from(scaleSubModeSwitch.querySelectorAll('.mode-btn')).forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.submode === settings.scaleSubMode) return;
        if (state.playing) stopSession();
        settings.scaleSubMode = btn.dataset.submode;
        saveState();
        applyModeUI();
      });
    });
  }

  function renderScaleRootOptions() {
    populateNoteSelect(scaleRootSelect, settings.scaleRoot);
  }

  function refreshScaleView() {
    updateRangeVisual();
    updateScaleOverlay();
    if (state.playing && settings.mode === 'scales') nextQuestion();
  }

  function wireScaleControls() {
    renderScaleRootOptions();
    scaleTypeSelect.value = settings.scaleType;
    scaleFullNeckEl.checked = settings.scaleFullNeck;

    scaleRootSelect.addEventListener('change', () => {
      settings.scaleRoot = Number(scaleRootSelect.value);
      saveState();
      refreshScaleView();
    });
    scaleTypeSelect.addEventListener('change', () => {
      settings.scaleType = scaleTypeSelect.value;
      settings.scalePosition = 0;
      saveState();
      renderDegreePad();
      refreshScaleView();
    });
    scalePosPrev.addEventListener('click', () => {
      settings.scalePosition = Math.max(0, settings.scalePosition - 1);
      saveState();
      refreshScaleView();
    });
    scalePosNext.addEventListener('click', () => {
      const positions = computeScalePositions();
      settings.scalePosition = Math.min(positions.length - 1, settings.scalePosition + 1);
      saveState();
      refreshScaleView();
    });
    scaleFullNeckEl.addEventListener('change', () => {
      settings.scaleFullNeck = scaleFullNeckEl.checked;
      saveState();
      refreshScaleView();
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
    } else if (mode === 'scales') {
      const pairs = getEligibleScalePairs();
      if (pairs.length === 0) {
        promptText.textContent = 'No scale tones in this position — try Full neck or a different position.';
        stopSession();
        return;
      }
      let pick;
      do {
        pick = pairs[Math.floor(Math.random() * pairs.length)];
      } while (pairs.length > 1 && state.lastPick &&
               pick.stringIndex === state.lastPick.stringIndex && pick.fret === state.lastPick.fret);
      state.lastPick = pick;
      state.current = pick; // { stringIndex, fret, noteIndex, degreeIndex }
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
    } else if (mode === 'scales') {
      positionMarker(state.current.stringIndex, state.current.fret);
      markerEl.classList.remove('hidden', 'correct', 'wrong');
      Array.from(degreePad.children).forEach(b => { b.disabled = false; b.classList.remove('is-correct', 'is-wrong'); });
      promptText.textContent = 'What scale degree is this?';
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
    const scale = currentScale();
    const correctIndex = (mode === 'scales') ? state.current.degreeIndex : state.current.noteIndex;
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
    } else if (mode === 'scales') {
      Array.from(degreePad.children).forEach(b => { b.disabled = true; });
      const correctBtn = degreePad.querySelector(`[data-degree-index="${correctIndex}"]`);
      if (correctBtn) correctBtn.classList.add('is-correct');
      if (!isCorrect && meta.btnEl) meta.btnEl.classList.add('is-wrong');
      markerEl.classList.toggle('correct', isCorrect);
      markerEl.classList.toggle('wrong', !isCorrect);
      pluckStringIndex = state.current.stringIndex;
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

    const targetLabel = (mode === 'scales') ? scale.degrees[correctIndex] : noteLabel(correctIndex);
    promptText.classList.remove('correct', 'wrong');
    if (isCorrect) {
      promptText.innerHTML = mode === 'scales'
        ? `Nice — that's the <strong>${targetLabel}</strong>`
        : `Nice — that's <strong>${targetLabel}</strong>`;
      promptText.classList.add('correct');
    } else if (isTimeout) {
      promptText.innerHTML = mode === 'scales'
        ? `Too slow — that's the <strong>${targetLabel}</strong>`
        : `Too slow — it was <strong>${targetLabel}</strong>`;
      promptText.classList.add('wrong');
    } else if (mode === 'identify') {
      promptText.innerHTML = `Not quite — it was <strong>${targetLabel}</strong>`;
      promptText.classList.add('wrong');
    } else if (mode === 'locate') {
      const clickedLabel = noteLabel(selectedIndex);
      promptText.innerHTML = `That's <strong>${clickedLabel}</strong> — looking for <strong>${targetLabel}</strong>`;
      promptText.classList.add('wrong');
    } else if (mode === 'scales') {
      const clickedLabel = scale.degrees[selectedIndex];
      promptText.innerHTML = `That's the <strong>${clickedLabel}</strong> — this one is the <strong>${targetLabel}</strong>`;
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

  // Electric (pickup/amp, usually a strong clean waveform close to the
  // mic) vs acoustic (mic'd from further away, quieter, more room noise)
  // get different sensitivity/patience settings. Tweak freely.
  const INSTRUMENT_PRESETS = {
    electric: { rmsGate: 0.012, clarityBias: 0,     stableFrames: 8 },
    acoustic: { rmsGate: 0.006, clarityBias: -0.04, stableFrames: 13 },
  };
  function micParams() {
    return INSTRUMENT_PRESETS[settings.instrument] || INSTRUMENT_PRESETS.electric;
  }

  // A fixed confidence bar unfairly rejects low strings: with a
  // fixed-length analysis window, lower notes pack in fewer full
  // cycles, so their autocorrelation "clarity" is naturally lower
  // than a high string's even for a clean, correct reading. This
  // ramps the bar down for low frequencies to compensate.
  function clarityThresholdFor(freq, bias) {
    const lo = 82, hi = 400; // ~low E .. comfortably above the open strings
    const t = Math.max(0, Math.min(1, (freq - lo) / (hi - lo)));
    const base = 0.80 + t * 0.12; // ~0.80 near low E, ~0.92 by ~400Hz+
    return Math.max(0.6, base + (bias || 0));
  }

  async function ensureMicAccess() {
    if (micAnalyser) return;
    if (!micSupported) throw new Error('this browser has no microphone support.');
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    micAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = micAudioCtx.createMediaStreamSource(micStream);
    micAnalyser = micAudioCtx.createAnalyser();
    // Wide enough window to comfortably fit several cycles of a low E
    // (~82Hz) so its pitch reads as cleanly as the high strings do.
    micAnalyser.fftSize = 4096;
    micDataBuf = new Float32Array(micAnalyser.fftSize);
    src.connect(micAnalyser);
  }

  function teardownMic() {
    if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
    if (micAudioCtx) { micAudioCtx.close().catch(() => {}); micAudioCtx = null; }
    micAnalyser = null;
    micDataBuf = null;
  }

  // One-pole DC blocker (y[n] = x[n] - x[n-1] + R*y[n-1]). Strips DC
  // bias and sub-audio rumble picked up by the raw mic (we run with
  // noiseSuppression off) without touching guitar-range frequencies —
  // that noise otherwise concentrates right where low strings live.
  function dcBlock(buf) {
    const out = new Float32Array(buf.length);
    let x1 = 0, y1 = 0;
    const R = 0.995;
    for (let i = 0; i < buf.length; i++) {
      const x0 = buf[i];
      const y0 = x0 - x1 + R * y1;
      out[i] = y0;
      x1 = x0; y1 = y0;
    }
    return out;
  }

  // Autocorrelation pitch detector (ACF-style): finds the lag of
  // strongest self-similarity beyond the first downward slope (so it
  // doesn't latch onto a strong-but-wrong harmonic at a shorter lag),
  // then refines it with parabolic interpolation for sub-sample accuracy.
  function autoCorrelate(rawBuf, sampleRate) {
    const buf = dcBlock(rawBuf);
    const size = buf.length;

    let sumSquares = 0;
    for (let i = 0; i < size; i++) sumSquares += buf[i] * buf[i];
    const rms = Math.sqrt(sumSquares / size);
    const energy = sumSquares;
    if (energy <= 0) return { frequency: -1, clarity: 0, rms };

    const minLag = Math.max(2, Math.floor(sampleRate / 1000));   // ignore >1000Hz
    const maxLag = Math.min(size - 1, Math.floor(sampleRate / 70)); // ignore <70Hz
    if (maxLag <= minLag) return { frequency: -1, clarity: 0, rms };

    const corr = new Float32Array(maxLag + 1);
    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < size - lag; i++) sum += buf[i] * buf[i + lag];
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
      const { frequency, clarity, rms } = autoCorrelate(micDataBuf, micAudioCtx.sampleRate);
      const params = micParams();

      if (frequency > 0 && rms >= params.rmsGate && clarity > clarityThresholdFor(frequency, params.clarityBias)) {
        const midi = 69 + 12 * Math.log2(frequency / 440);
        const rounded = Math.round(midi);
        const heardIndex = ((rounded % 12) + 12) % 12;
        const cents = Math.max(-50, Math.min(50, Math.round((midi - rounded) * 100)));

        micHeardNote.textContent = noteLabel(heardIndex);
        micHeardNote.classList.toggle('match', heardIndex === state.current.noteIndex);
        updateCentsNeedle(cents);

        if (state.micStreak.note === heardIndex) state.micStreak.count++;
        else state.micStreak = { note: heardIndex, count: 1 };

        if (state.micStreak.count >= params.stableFrames) {
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
    syncDegreePadDisabled();
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
  function syncInstrumentRadio() {
    document.querySelectorAll('#instrumentRadios input').forEach(r => { r.checked = (r.value === settings.instrument); });
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
        renderScaleRootOptions();
        populateNoteSelect(songKeyRootSelect, settings.songKeyRoot);
      });
    });
    document.querySelectorAll('#instrumentRadios input').forEach(r => {
      r.addEventListener('change', () => {
        if (!r.checked) return;
        settings.instrument = r.value;
        saveState();
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
    syncInstrumentRadio();
    renderNotePad();
    renderDegreePad();
    wireScaleControls();
    wireProgressionControls();
    wireSongwritingControls();
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
