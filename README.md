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

**Show note names** (in Settings → Display) overlays every fret with
its note name — handy as training wheels while learning, or as a
built-in hint in Find/Play mode.

## Microphone mode

"Play the Note" uses a small pitch-detection routine (autocorrelation
on live mic input, no external libraries) to recognize what note
you're playing, regardless of which string/octave you play it on.

Notes on how well it works:
- Needs a browser with microphone support running in a **secure
  context** (`https://` — GitHub Pages qualifies, `localhost` also
  works for local testing). If unsupported, that mode is simply
  disabled with an explanation, rather than offered and failing.
- Works best with one note at a time, let it ring for a moment, in a
  reasonably quiet room. Chords, heavy distortion, or a noisy room
  will confuse it.
- The browser will prompt for microphone permission the first time
  you press Start in this mode. The mic is released again when you
  press Stop.
- It's a simple, from-scratch detector — not a professional-grade
  tuner. If it's misreading you consistently, try playing a bit
  louder/closer to the mic, or fret higher up the neck where the
  signal is cleaner.

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
- **Colors/fonts:** all design tokens are CSS custom properties at the
  top of `css/style.css` (`:root { … }`).
- **Fret range presets:** edit the `<div id="rangeRadios">` options in
  `index.html`.
- **Mic sensitivity:** `MIC_CLARITY_THRESHOLD` (how confident a pitch
  reading must be) and `MIC_STABLE_FRAMES` (how many consecutive good
  frames before it accepts an answer) are constants near the top of
  the mic section in `js/app.js`.

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
