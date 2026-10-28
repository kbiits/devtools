# Architecture Overview

## Project Goals

Build a fully static, client-side-only devtools web application with zero build steps, minimal external dependencies (Tailwind CDN for styling, JSONPath-Plus for JSONPath), and no package managers or Node.js required.

## Tech Stack

- **HTML5** — semantic markup
- **CSS3** — via Tailwind CSS CDN (the *only* external runtime dependency)
- **Vanilla JavaScript** (ES6+) — no frameworks and no build step; one third-party library (JSONPath-Plus) for JSONPath queries
- **No build step** — all scripts are plain JavaScript files loaded via `<script defer>`

## Key Principles

1. **Client-side only** — no server-side processing; all work happens in the browser
2. **Secure by design** — no eval() or Function() in this codebase, and no user code execution (JSONPath filters use JSONPath-Plus's default `safe`, non-eval evaluator)
3. **Offline-first** — works immediately after page load (except Tailwind CDN); data never leaves your machine
4. **Zero friction** — works by opening index.html directly or via any static file server
5. **Single-page app** — tab switching via client-side JS without full-page reloads

## File Layout

```
devtools/
├── index.html                 # Main UI: sidebar nav + 6 tool panels
├── css/
│   └── app.css                # Custom CSS: tree rendering, dark mode, form styling
├── js/
│   ├── utils.js               # Shared utilities across all tools
│   ├── app.js                 # App shell: nav, tab switching, localStorage
│   ├── json-viewer.js         # JSON Viewer: tree rendering and collapse/expand
│   ├── json-transform.js      # JSON Transform: format, sort, extract, case-convert, escape, CSV
│   ├── py-to-json.js          # Python → JSON: literal tokenizer + parser
│   ├── base64-converter.js    # Base64: encode/decode (standard + URL-safe)
│   ├── datetime-tool.js       # Date & Time: epoch conversion, date add/subtract, difference
│   └── image-annotator.js     # Image Annotator: canvas annotation (shapes, text, export)
├── docs/                      # QUICKSTART, ARCHITECTURE (this file), TESTING, RELEASING
├── README.md                  # Full feature documentation
├── CLAUDE.md                  # Guide for AI coding agents
└── (no package.json, no build tools; deploy.ps1 is local-only, see RELEASING.md)
```

## Module Organization

### utils.js
Shared, low-level utilities used by multiple tools:
- `parseJsonWithPos(text)` — Parse JSON with error position detection
- `offsetToLineCol(text, offset)` — Convert character offset to line/column for error reporting
- `debounce(fn, ms)` — Debounce function calls for input events
- `sortKeysDeep(value)` — Recursively sort object keys
- `splitIntoWords(key)` / `joinWords(words, case)` — Case conversion helpers
- `convertKeysDeep(value, case)` — Recursively convert key casing
- `copyToClipboard(text)` — Copy text to clipboard (with fallback)

All functions are namespaced under `window.DevTools` to avoid globals.

### app.js
Application bootstrap and shell logic:
- Initialize all tools with `.init()` calls
- Tab switching via data-tool buttons
- localStorage persistence of active tool
- Panel visibility management

### json-viewer.js
Interactive JSON tree visualization:
- `renderNode(value, keyLabel, path, depth)` — Recursive DOM builder for tree
- Lazy expansion: children only rendered when parent is expanded
- Collapse/expand state tracked in a `Set<path>` across re-renders
- Auto-collapse deep nesting to keep initial render light
- Debounced parsing (300ms) to prevent UI lag while typing

### json-transform.js
Multi-operation JSON editor:
- **Format/minify**: native `JSON.stringify` with indent control
- **Sort keys**: recursive key alphabetization
- **JSONPath**: extraction via path query (delegated to JSONPath-Plus, loaded from CDN)
- **Key-case conversion**: via word-splitting algorithm in utils.js
- **Escape/unescape**: JSON string literal round-trips
- **CSV conversion**: flat array-of-objects ↔ CSV with proper quoting/escaping

All operations read input, validate, and write to output or show error box.

### JSONPath (third-party)
JSONPath queries are delegated to [JSONPath-Plus](https://github.com/JSONPath-Plus/JSONPath) v11.2.1,
loaded as a UMD script in `index.html` (pinned version + SRI hash) and used from `json-transform.js`.
It exposes `window.JSONPath.JSONPath`. A hand-rolled `jsonpath-lite.js` used to live here; it only
covered keys, indexes and wildcards, so it was replaced by the real thing.

The wrapper in `json-transform.js` adds four things the raw library does not:
- **`sandbox: { $: data }`** — lets filters compare against the document root (`[?(@.price < $.budget)]`);
  the library natively only exposes `@root`
- **`ignoreEvalErrors: true`** — a filter over an array holding `null`s or scalars skips those nodes
  instead of throwing
- **Pre-flight validation** — unbalanced brackets/quotes and the unsupported `=~` operator are caught
  before the query runs, because the library answers some of those with a silently empty result
- **Result shaping** — `resultType` is mapped to the Values / Paths / Path+value / Pointers modes, and
  `parent`/`parentProperty` are dropped from `all` results since they bloat the output

Filter expressions run through the library's default `safe` evaluator (a JSEP-based static expression
evaluator). The opt-in `eval: 'native'` mode, which does use `new Function`, is never enabled.

### py-to-json.js
Python literal to JSON converter (no eval() anywhere):
- **Tokenizer** — Scans Python literals, produces token stream (LBRACE, STRING, NAME, NUMBER, etc.)
- **Recursive-descent parser** — Parses dicts, lists, tuples, strings, numbers, True/False/None
- **Validation** — Rejects function calls, variables, sets, and non-string dict keys structurally
- **Error reporting** — Parse errors include position (line/column) via offsetToLineCol()

Implementation uses only string scanning and manual object/array construction. No eval/Function anywhere.

### datetime-tool.js
Epoch conversion and date arithmetic, all recalculated live on `input`/`change`:
- **Parsing** (`parseInput`) — `now`, epoch numbers (unit auto-detected by digit count: ≤11 s, ≤14 ms, ≤17 µs, else ns; µs/ns go through `BigInt` to keep precision), ISO 8601 via a strict regex (range-checked, so `2026-02-30` is rejected rather than rolled over), then `Date.parse` as a fallback
- **Zone mode** — the "Interpret dates as" Local/UTC select decides how offset-less dates are read and which calendar (`getX` vs `getUTCX`) the day math uses; `parts()`/`make()` hide that switch
- **Add/subtract** — years/months/weeks/days step through the calendar (`addMonths` clamps to month end, `addDays` keeps wall-clock time across DST); hours/minutes/seconds add exact milliseconds
- **Difference** — `calendarDiff` peels off months, then days, then exact time; `businessDays` counts Mon–Fri calendar dates in `[from, to)`
- **Live clock** — a 1s `setInterval` that runs only while the panel is visible (`onShow`/`onHide` from `app.js`)
- Results are rendered with `createElement` + `textContent`

## Data Flow

### JSON Viewer
```
User input → debounce(300ms) → parseJsonWithPos() → renderNode(recursive) → collapsible tree
              ↓ (on error)
              error box with line/column
```

### JSON Transformer
```
User input ──→ Click operation button ──→ parseJsonWithPos() ──→ transform function
                                                                    ├─ format
                                                                    ├─ minify
                                                                    ├─ sortKeysDeep
                                                                    ├─ JSONPath query
                                                                    ├─ case-convert
                                                                    ├─ escape/unescape
                                                                    └─ CSV conversion
                                             ↓ (success)
                                             JSON.stringify() → output textarea
                                             ↓ (error)
                                             error box
```

### Python → JSON
```
User input → debounce(300ms) → DevTools.PyToJson.convert() ──→ tokenize() ──→ parse()
                                                                ↓ (on error)
                                                                error box with position
                                                                ↓ (on success)
                                                                JSON.stringify() → output
```

## State Management

### localStorage
- **Key**: `activeTool` — which tab the user was last viewing
- **Value**: `'viewer'` | `'transform'` | `'pytojson'` | `'base64'` | `'datetime'` | `'annotate'`
- **Purpose**: Restore tab state across page reloads

### Module-level state
- **JSONViewer**: `collapsedPaths` Set, `lastParsedValue`
- **JSONTransform**: None persistent (reads from DOM on each operation)
- **PyToJson**: None persistent

No cross-tool state sharing. Each tool is independent.

## Error Handling

All user-input errors are surfaced in a consistent error box per tool:
- **JSON parsing errors**: "Parse error at line L, column C: <message>"
- **Path/query errors**: Position-aware error messages from custom parsers
- **Validation errors**: Clear, descriptive messages (e.g., "Dict keys must be strings")

Errors are never silently ignored; always shown in the error box, preventing data loss or silent misparse.

## Performance Considerations

1. **Debouncing**: JSON Viewer and Python → JSON both debounce parsing to 300ms to prevent lag
2. **Lazy rendering**: Tree nodes are only built when expanded, so large nested structures don't immediately create thousands of DOM nodes
3. **No persistent DOM**: Tree is rebuilt fresh on each successful parse, but this is acceptable (parsing is fast, and it's debounced)
4. **Memory**: No caching of transformed results; each operation re-computes from input. Fine for typical use (JSON documents < 10MB)

## Security

1. **No eval() or Function()** — all parsing in this codebase is manual string scanning; JSONPath filter expressions are evaluated by JSONPath-Plus's default `safe` evaluator, never its `native` (Function-based) mode
2. **No user code execution** — Python literal parser rejects function calls, variables, etc. by grammar
3. **No external dependencies besides Tailwind** — no npm packages = no supply chain risk
4. **No network requests** — all processing is local (except Tailwind CSS CDN load, which is inevitable)
5. **XSS prevention** — tree rendering uses `textContent` and `createElement`, never `innerHTML` with user input

## Browser Compatibility

- **ES6+ features**: arrow functions, `const`/`let`, template literals, destructuring
- **DOM API**: `querySelectorAll`, `addEventListener`, `classList`, `localStorage`
- **CSS**: Flexbox, Grid, custom properties (for Tailwind)
- **Tested**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

## Extensibility

Adding a new tool:
1. Create `js/new-tool.js` with a module init function
2. Add a button in the sidebar with `data-tool="newtool"`
3. Add a `<section data-panel="newtool">` in the main area
4. Import the script in `index.html`
5. Call the init function in `app.js` (and wire `onShow`/`onHide` in `showPanel` if the tool runs timers or listeners that should pause while hidden)
6. Document it in the root README, add a section to [TESTING.md](TESTING.md), and update the tool lists in [docs/README.md](README.md) and this file

The architecture naturally extends — no monolithic app state or tight coupling.

## Testing

Since there's no test framework:
- Manual testing via [TESTING.md](TESTING.md) (comprehensive checklist of all features)
- Syntax validation: `node --check js/<file>.js`
- Manual inspection of tree rendering, error messages, etc. in a browser

Deployment is covered in [RELEASING.md](RELEASING.md). Worth considering later:
- Browser-based test framework (Playwright, Cypress)
- Minification/compression (single index.html, bundled CSS/JS)

## Future Enhancements

Possible extensions that fit the "static, vanilla, zero-build" philosophy:
- **YAML viewer/converter**
- **SQL formatter** (for SELECT statements)
- **XML/HTML tree viewer**
- **Regex tester with visualizer**
- **Color picker and palette generator**
- **Markdown to HTML previewer**

Each would be a self-contained tool following the same pattern.
