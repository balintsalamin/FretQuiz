# FretQuiz — Guitar Fretboard Note Trainer

A note lights up on the fretboard. You name it. Or: it names a note
and you find it. Or: it names a note and you play it on a real guitar.
Streak, accuracy, and a few difficulty settings are built in. It's an
installable PWA — once you visit it in a browser you can add it to
your home screen / dock and it behaves like a real app icon, works
offline, no browser chrome.

No build step, no dependencies. Plain HTML/CSS/JS.

## Modes

- **Name the Note** — a note lights up on the board, tap the matching
  letter on the answer pad (or press the key on your keyboard).
- **Find the Note** — a note name is shown, tap the matching position
  anywhere on the fretboard. Any correct string/fret counts.
- **Play the Note** — a note name is shown, play it on a real guitar.
  Your browser's microphone listens and detects the pitch — no
  clicking required. See **Microphone mode** below for details and
  limitations.
- **Scales** — pick a root note and a scale (Major, Natural Minor,
  Major Pentatonic, Minor Pentatonic, Blues), then either:
  - **Explore** — every note of that scale lights up across the whole
    fretboard, color-coded by degree (root in one color, everything
    else in another), with degree numbers labeled right on the board.
  - **Quiz Me** — the labels disappear (the dots stay, so the shape is
    still visible) and you're tested on naming the scale degree of a
    highlighted note, same streak/accuracy tracking as the other modes.

  A **position stepper** steps through the scale's ~5 "boxes" across
  the neck (the same idea behind the CAGED system), or check **Full
  neck** to see the whole thing at once. The positions aren't from a
  hand-typed shape table — they're derived algorithmically from where
  the root note falls on each string, so they work correctly for any
  root and any of the scale types above without extra data.
- **Progression** — type a chord progression (e.g. `C G Am F`, or with
  extensions like `Cmaj7 A7 Dm G7`) and hit Generate. Tap any chord to
  see up to 4 different ways to play it — open position first, then
  alternates further up the neck — each as a standard chord-box
  diagram, plus that voicing highlighted on the main fretboard so you
  can see where it sits on the whole neck. A **▶** button on each
  voicing plays a quick synthesized strum of the actual notes.

  Every chord also offers a row of **substitutions** — e.g. a plain
  `C` offers `C7`, `Cmaj7`, `Csus4`, `Cadd9` as one-click alternates —
  so you're not locked into exactly what you typed. Voicings are
  generated algorithmically from each chord's interval formula (not a
  hand-typed shape table), so any of the 17 supported qualities work
  at any root: major, minor, 7, maj7, m7, m7♭5, dim, dim7, aug, sus2,
  sus4, add9, 6, m6, 9, m9, and power chords. Chord symbols are
  case-sensitive where it matters (`M7` vs `m7`) and otherwise
  forgiving about capitalization.

**Show note names** (in Settings → Display) overlays every fret with
its note name — handy as training wheels while learning, or as a
built-in hint in Find/Play mode. (It's automatically hidden in Scales
and Progression modes, since their own overlays already cover that
same visual space.)

## Microphone mode

"Play the Note" uses a small pitch-detection routine (autocorrelation
on live mic input, no external libraries) to recognize what note
you're playing, regardless of which string/octave you play it on.

**Electric vs. Acoustic** (Settings → Microphone) tunes detection for
your setup — how loud a signal counts as "real" (vs. background
noise), how confident a reading must be before it's accepted, and how
many consecutive good readings it waits for. Acoustic defaults more
sensitive/patient since a mic'd acoustic is usually quieter and
noisier than an amp; electric defaults snappier since that signal is
typically cleaner. These are reasonable starting points, not a
guarantee — nudge the constants in `js/app.js` (see Customizing) if
your setup needs something different.

Notes on how well it works:
- Needs a browser with microphone support running in a **secure
  context** (`https://` — GitHub Pages qualifies, `localhost` also
  works for local testing). If unsupported, that mode is simply
  disabled with an explanation, rather than offered and failing.
- Works best with one note at a time, let it ring for a moment, in a
  reasonably quiet room. Chords, heavy distortion, or a noisy room
  will confuse it.
- Low strings are inherently harder to read than high ones — fewer
  full waveform cycles fit in the same analysis window, so a fixed
  confidence bar would unfairly reject a perfectly good low E. The
  detector compensates for this automatically (see `clarityThresholdFor`
  in `js/app.js`), but if a specific note is still consistently
  missed, try fretting a bit higher up the neck or playing a touch
  louder/closer to the mic.
- The browser will prompt for microphone permission the first time
  you press Start in this mode. The mic is released again when you
  press Stop.
- It's a simple, from-scratch detector — not a professional-grade
  tuner.

## Run it locally

Opening `index.html` directly (`file://…`) will mostly work, but the
service worker (offline support) only activates when served over
`http(s)`, and microphone access requires `http(s)` too. Easiest local
test:

```bash
python3 -m http.server 8080
# or: npx serve
```

Then visit `http://localhost:8080`.

## Deploy to GitHub Pages

1. Create a new **public** repo on GitHub, e.g. `fretboard-quiz`.
2. Add all the files in this folder to the repo, keeping the structure:

   ```
   index.html
   manifest.json
   sw.js
   css/style.css
   js/app.js
   icons/icon-192.png
   icons/icon-192-maskable.png
   icons/icon-512.png
   icons/icon-512-maskable.png
   ```

3. Commit and push to the `main` branch.
4. In the repo: **Settings → Pages → Build and deployment → Source**:
   choose **Deploy from a branch**, branch **main**, folder **/ (root)**,
   then **Save**.
5. GitHub gives you a URL like `https://<username>.github.io/fretboard-quiz/`
   — it can take a minute to go live the first time.

All the asset paths in this project are relative, so it works whether
it's hosted at the domain root or under a repo subpath like the one
above — no config changes needed either way.

## "Installing" it

- **Android / Desktop Chrome or Edge:** open the page, tap the
  **Install** button in the header (or the install icon in the
  address bar). It's added as a standalone app with its own icon.
- **iPhone / iPad (Safari):** tap **Share → Add to Home Screen**. iOS
  doesn't support the automatic install prompt, so the app shows a
  reminder about this the first time it's opened there.

## Customizing

- **Tuning:** the `STRINGS` array at the top of `js/app.js` hard-codes
  standard tuning (E A D G B E). Change the `openIndex` values there
  (0=C, 1=C#, 2=D, … 11=B) for drop-D, alternate tunings, etc.
- **Scales:** the `SCALES` object near the top of `js/app.js` holds
  each scale as semitone offsets from the root plus its degree labels
  — add a Dorian or Mixolydian entry, for instance, the same shape as
  the existing ones, and it'll show up in the Scale dropdown and work
  with the position stepper automatically.
- **Chords:** `CHORD_QUALITIES` defines each chord type the same way
  (intervals + a label + the symbol suffix), `CHORD_SUFFIX_ALIASES`
  maps text like "maj7"/"M7"/"Δ7" to that quality, and
  `CHORD_SUBSTITUTIONS` controls which "try instead" chips show up per
  quality. Add an entry to each and the voicing search, chord-box
  diagrams, and progression parser all pick it up automatically —
  nothing else to update.
- **Colors/fonts:** all design tokens are CSS custom properties at the
  top of `css/style.css` (`:root { … }`).
- **Fret range presets:** edit the `<div id="rangeRadios">` options in
  `index.html`.
- **Mic sensitivity:** `INSTRUMENT_PRESETS` (near the top of the mic
  section in `js/app.js`) holds `rmsGate` (how loud a signal must be
  to count as real), `clarityBias` (nudges the confidence bar up/down
  from its default per-frequency curve), and `stableFrames` (how many
  consecutive good readings before it accepts an answer) for each of
  Electric/Acoustic. `clarityThresholdFor()` right above it is the
  base confidence curve itself (lower bar for low strings, since they
  naturally read less "clean" in a fixed-length analysis window).

## Notes

- Stats and settings are stored in the browser's `localStorage`, per
  device/browser — there's no account or syncing.
- Everything (including the little correct/wrong tones and the pitch
  detector) is generated/computed in-browser; there are no external
  asset, font, or API requests, so it stays fully usable offline once
  loaded (microphone input obviously requires the mic itself, and
  won't work offline in the sense that there's nothing to fetch, but
  it doesn't need a network connection to function either).
- Shipped a new version of the app shell? Bump `CACHE_NAME` at the top
  of `sw.js` (e.g. `v2` → `v3`) so anyone with it already installed
  gets a clean update instead of a stale cache.
