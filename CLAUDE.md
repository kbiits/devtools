# CLAUDE.md

A static, client-side devtools web app (JSON viewer/transformer, Python → JSON, Base64, Date & Time, Image Annotator). It's plain HTML + vanilla JS, with no build step, no npm and no framework.

## Where to look

| Need | Read |
|------|------|
| What each tool does, from the user's side | [README.md](README.md) |
| Module layout, data flow, state, security rules, adding a tool | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| How to verify a change (manual checklist per tool) | [docs/TESTING.md](docs/TESTING.md) |
| Deploying a release | [docs/RELEASING.md](docs/RELEASING.md) |
| Running it locally and trying each tool | [docs/QUICKSTART.md](docs/QUICKSTART.md) |
| Index of all docs | [docs/README.md](docs/README.md) |

## Run

```powershell
python -m http.server 8000   # from the repo root, then open http://localhost:8000
```

Opening `index.html` directly also works, except for clipboard image writes, which need `localhost`/`https`.

## Code conventions

- **One file per tool** in `js/`, written as an IIFE assigned to the `DevTools` namespace (`DevTools.Base64Converter = (function() { ... return { init() {...} }; })();`). No ES modules: scripts load with `<script defer>` in order, and `utils.js` must come first
- **Shared helpers** live in `js/utils.js` (`DevTools.copyToClipboard`, `DevTools.debounce`, …). Reuse them instead of re-implementing
- **Markup** goes in `index.html`: a sidebar `<button data-tool="x">` plus a `<section data-panel="x">`. Use Tailwind utility classes with `dark:` variants matching the existing panels. Only put shared or non-Tailwind styling in `css/app.css`
- **Wiring** goes in `js/app.js`: call `init()`, and hook `onShow`/`onHide` in `showPanel` if the tool has timers or global listeners
- **Security:** never use `eval`/`new Function`. Render user data with `createElement` + `textContent`, never `innerHTML`. Pin CDN scripts to an exact version (with SRI where possible)
- **Errors** are shown in the UI (a per-tool error box or an inline message), never swallowed
- Match the existing comment density: short comments only where the logic isn't obvious

## Adding or changing a tool

Follow [docs/ARCHITECTURE.md → Extensibility](docs/ARCHITECTURE.md#extensibility). Then update:

- the feature section in `README.md`
- the tool's section and the tool count in `docs/TESTING.md`
- the tool tables in `docs/README.md`, `docs/QUICKSTART.md` and `docs/ARCHITECTURE.md`

## Verifying

There's no automated test suite. Check syntax with `node --check js/<file>.js`, then test in a real browser: load the page, click through the affected tool, and check the console has no errors. Use the matching section of [docs/TESTING.md](docs/TESTING.md) as the checklist.

## Releasing

- `git push` does **not** deploy. Releases run through the local `deploy.ps1`. See [docs/RELEASING.md](docs/RELEASING.md)
- `deploy.ps1` is gitignored on purpose because it contains private server details. Never commit it, never remove `deploy*` from `.gitignore`, and never copy its host names or paths into committed files
- Run it only when the user asks for a release, after the change is tested and committed
