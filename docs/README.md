# DevTools Documentation

Documentation for the static, client-side devtools app. The project overview and full feature reference live in the [root README](../README.md).

## Documents

| Document | Purpose | Audience |
|----------|---------|----------|
| [../README.md](../README.md) | Feature reference for every tool, usage, known limitations | Everyone |
| [QUICKSTART.md](QUICKSTART.md) | Run the app and try each tool in a couple of minutes | New users |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Tech stack, module layout, data flow, state, security, adding a tool | Developers / contributors |
| [TESTING.md](TESTING.md) | Manual test checklist for every tool | Anyone changing code / QA |
| [RELEASING.md](RELEASING.md) | How to deploy a new version with the local `deploy.ps1` | Maintainers |

## Tools at a glance

| Sidebar tab | Module | What it does |
|-------------|--------|--------------|
| JSON Viewer | `js/json-viewer.js` | Paste JSON and get a collapsible tree, with line/column parse errors |
| JSON Transform | `js/json-transform.js` | Format, minify, sort keys, JSONPath queries, key-case conversion, escape/unescape, CSV ⇄ JSON |
| Python → JSON | `js/py-to-json.js` | Convert Python literals (dicts, lists, tuples, `True`/`None`) to JSON without `eval` |
| Base64 | `js/base64-converter.js` | UTF-8 Base64 encode/decode, standard and URL-safe |
| Date & Time | `js/datetime-tool.js` | Live epoch clock, epoch ⇄ date conversion, add/subtract durations, difference between dates |
| Image Annotator | `js/image-annotator.js` | Paste, drop or upload an image, then draw boxes, arrows, pen strokes and text, and export it as PNG |

## Common tasks

- **Run locally:** `python -m http.server 8000` in the repo root, then open http://localhost:8000 (or open `index.html` directly)
- **Add a new tool:** follow [ARCHITECTURE.md → Extensibility](ARCHITECTURE.md#extensibility)
- **Verify a change:** work through the relevant section of [TESTING.md](TESTING.md)
- **Ship it:** commit and push, then follow [RELEASING.md](RELEASING.md)
