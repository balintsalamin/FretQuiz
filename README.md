# FretQuiz — Guitar Fretboard Note Trainer

A note lights up on the fretboard. You name it. Streak, accuracy, and a
few difficulty settings are built in. It's a installable PWA — once
you visit it in a browser you can add it to your home screen / dock
and it behaves like a real app icon, works offline, no browser chrome.

No build step, no dependencies. Plain HTML/CSS/JS.

## Run it locally

Opening `index.html` directly (`file://…`) will mostly work, but the
service worker (offline support) only activates when served over
`http(s)`. Easiest local test:

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

## Notes

- Stats and settings are stored in the browser's `localStorage`, per
  device/browser — there's no account or syncing.
- Everything (including the little correct/wrong tones) is generated
  in-browser; there are no external asset or font requests, so it
  stays fully usable offline once loaded.
