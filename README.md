# DevTools – Static Client-Side Utilities

A fully client-side, no-build-required devtools web application featuring five powerful tools for JSON, data transformation, encoding, and image annotation.

## Features

### 1. Base64 Encoder/Decoder
Encode text to Base64 or decode Base64 back to text, with support for both standard and URL-safe encoding.

**Capabilities:**
- **Encode**: Convert any UTF-8 text to Base64 format
- **Decode**: Convert Base64 back to readable text
- **Two encoding modes**:
  - **Standard (RFC 4648)**: Uses `+`, `/`, and `=` padding
  - **URL-Safe (RFC 4648 Section 5)**: Uses `-` and `_` instead of `+` and `/`, no padding
- Full UTF-8 support (emoji, non-Latin characters, etc.)
- Clear error messages for invalid Base64 input
- Live output with copy-to-clipboard button

**Mode Details:**
- **Standard Base64** is the classic base64 encoding, suitable for general-purpose use (emails, JSON payloads)
- **URL-Safe Base64** removes characters that have special meaning in URLs (`+` → `-`, `/` → `_`) and omits padding (`=`), making it ideal for URLs, file names, and tokens

### 2. JSON Viewer
Parse and visualize JSON with an interactive collapsible tree view.

**Capabilities:**
- Real-time JSON parsing with position-aware error messages
- Syntax-highlighted tree (strings, numbers, booleans, null, keys all color-coded)
- Collapse/expand nodes with a single click — state persists while editing
- Lazy rendering: large nested structures only render when expanded, keeping the UI responsive
- Auto-collapse deep nesting (depth > 3 by default) to prevent overwhelming first paint

### 3. JSON Transformer
A multi-purpose JSON editor with format, minify, sort, extract, convert, and escape operations.

**Operations:**

#### Format / Minify
- **Format**: Pretty-print with adjustable indentation (2 spaces, 4 spaces, or tabs)
- **Minify**: Collapse to a single line with no extra whitespace

#### Sort Keys
Recursively alphabetize all object keys at every level of nesting while preserving array order and primitive values.

#### JSONPath Query
Query JSON with full JSONPath, powered by [JSONPath-Plus](https://github.com/JSONPath-Plus/JSONPath) (v11, loaded from a CDN). Results update as you type; press Enter or click **Extract** to run immediately.

**Supported syntax:**

| Syntax | Meaning |
| --- | --- |
| `$` | the document root (optional — `a.b` works too) |
| `.key` / `['key']` | child by name (brackets for keys with spaces, dashes, dots) |
| `.*` / `[*]` | every value of an object or array |
| `[0]`, `[-1]` | array index, negative counts from the end |
| `[1:4]`, `[1:4:2]`, `[:3]`, `[-2:]` | slices, with optional step |
| `[0,2]`, `['a','b']` | unions |
| `..key` | recursive descent |
| `..*` | every node in the document |
| `[?(<expr>)]` | filter expression |
| `$..*@string()` | filter by type: `@string()`, `@number()`, `@boolean()`, `@null()`, `@object()`, `@array()`, `@scalar()` |
| `^` | the parent of each match |
| `~` | the key/index of each match instead of its value |

**Inside a filter expression:**
- `@` is the current value — `$..book[?(@.price < 10)]`
- `@.a && @.b`, `||`, `!`, parentheses, and the comparisons `== != < <= > >=`
- `$` or `@root` is the whole document — `$..book[?(@.price < $.expensive)]`
- `@property` is the current key or index — `$.config[?(@property === 'id')]`
- `@path` is the normalized path of the current node
- Regex via JavaScript methods — `$..book[?(@.author.match(/Tolkien/))]` or `[?(/^A/.test(@.name))]`
  (the Goessner-era `=~` operator is **not** supported; the tool tells you so if you use it)
- Script expressions work too — `$..book[(@.length-1)]` for the last element

**Examples:**
- `$.store.book[*].author` — every author
- `$..price` — every price anywhere in the document
- `$..book[?(@.isbn)]` — books that have an ISBN
- `$..book[?(@.category=='fiction' && @.price>10)].title` — titles of expensive fiction
- `$..book[-1:]` — the last book
- `$.store.*~` — the keys under `store`

**Output modes** (the select next to the input):
- **Values** — the matched values (default)
- **Paths** — normalized paths, e.g. `$['store']['book'][0]['title']`
- **Path + value** — both, as `{path, pointer, value}` objects
- **JSON Pointers** — RFC 6901 pointers, e.g. `/store/book/0/title`

**Unwrap single match** (checkbox, on by default): when exactly one node matches, output it directly instead of a one-element array. Turn it off if you always want an array.

**Error handling:**
- Unbalanced brackets, parens, or quotes are caught before the query runs and reported with a position
- Filter errors on individual nodes are ignored rather than aborting the query, so `[?(@.price > 5)]` works over arrays that also contain `null`s and scalars
- While you type, problems show in the small caption under the field; the full error box only appears when you explicitly run a query

#### Editor panes
The Input and Output boxes never shrink below a usable height, however tall the options toolbar is, and both can be dragged taller by their bottom-right corner.

Each has an **Expand** button that pops that pane out to fill the entire window — useful for pasting a large document or reading a long result. Press **Esc** or click **Exit** to go back to the split view. Expanding one pane collapses the other, and leaving the tool exits full screen automatically.

#### Key Case Conversion
Convert all object keys (recursively) between four case styles. Word boundaries are automatically detected:
- **camelCase** — first word lowercase, subsequent words capitalized
- **PascalCase** — all words capitalized
- **snake_case** — lowercase words joined by underscores
- **kebab-case** — lowercase words joined by hyphens

**Word detection algorithm:**
- Underscores and hyphens are treated as delimiters
- CamelCase humps are detected (e.g., `userId` → `user`, `Id`)
- Acronym runs are preserved, then split on a following uppercase letter starting a new word (e.g., `HTTPServer` → `HTTP`, `Server`)

Example: `{"userId": 1, "user_email": "a@b.com", "HTTPStatus": 200}`
- → camelCase: `{"userId": 1, "userEmail": "a@b.com", "httpStatus": 200}`
- → snake_case: `{"user_id": 1, "user_email": "a@b.com", "http_status": 200}`
- → PascalCase: `{"UserId": 1, "UserEmail": "a@b.com", "HttpStatus": 200}`

#### Escape / Unescape JSON Strings
- **Escape**: Treat raw text as a string value and JSON-escape it (wrap in quotes, escape internal quotes/backslashes/control characters)
- **Unescape**: Parse a JSON string literal (including quotes) back to raw text. If that text is also valid JSON, pretty-print it for convenience.

Use case: embedding JSON or logs as string values in larger documents.

#### CSV Conversion
Convert between flat JSON arrays-of-objects and CSV.

**JSON → CSV:**
- Validates input is an array of objects with only primitive (string/number/boolean/null) values
- Header row: union of all keys in first-seen order
- Missing keys in a row become empty cells
- Explicit `null` values also become empty cells (not distinguished in CSV)
- Quoting: fields containing commas, quotes, or newlines are double-quoted; internal quotes are doubled (`"`)

**CSV → JSON:**
- Parses CSV with proper handling of quoted commas and newlines
- First row is the header
- Missing trailing cells in a row are treated as empty strings
- Values are coerced: `true`/`false` → booleans, numeric strings → numbers, everything else → strings
- Empty cells stay as empty strings (cannot round-trip to distinguish `null`)

### 4. Python → JSON Converter
Convert Python literal syntax (dicts, lists, tuples, strings, numbers, booleans, None) to valid JSON.

**Supported syntax:**
```python
{
  'key': 'value',
  'list': [1, 2, 3],
  'tuple': (1, 2, 3),
  'nested': {
    'bool': True,
    'null': None,
    'float': 3.14,
    'exp': 1e10
  }
}
```

**Features:**
- Single and double-quoted strings with Python escape sequences (`\n`, `\t`, `\'`, `\"`, `\\`, `\xHH`, `\uHHHH`, etc.)
- Integers, floats, and scientific notation
- Tuples become JSON arrays (and are indistinguishable from lists in JSON output)
- Single-element tuples must include a trailing comma: `(1,)` → `[1]`
- Trailing commas allowed in dicts, lists, and tuples
- Booleans: `True` and `False` (capitalized)
- Null: `None`
- Dict keys must be string literals (not bare identifiers or numbers)

**Explicitly not supported:**
- Sets (e.g., `{1, 2, 3}`) — rejected with a clear error
- Function calls (e.g., `dict(a=1)`) — rejected structurally at parse time
- Arbitrary expressions or variable references
- String type annotations
- F-strings or raw strings

**Implementation notes:**
- **No `eval` or `new Function`** — purely hand-rolled tokenizer + recursive-descent parser for safety
- Invalid identifiers (anything other than `True`/`False`/`None`) are rejected with a descriptive error
- Parse errors include position (line and column) for easy debugging
- Non-string dict keys produce a clear error: "Dict keys must be strings..."

### 5. Image Annotator
Mark up a screenshot right in the browser — paste, draw, copy back out. No upload, no server; the image never leaves the page.

**Getting an image in:**
- **Paste** with Cmd/Ctrl+V while the panel is open (great for screenshots)
- **Drag and drop** a file anywhere on the canvas area
- **Upload** button for a file picker

**Drawing tools:**
- **Rectangle** — drag to box an area
- **Arrow** — drag from tail to head
- **Pen** — freehand scribble
- **Text** — click where you want the label, type, press Enter (Esc cancels). Text is drawn with a white halo so it stays readable over busy screenshots.

**Options:**
- Five preset colors plus a full color picker
- Four stroke widths and four text sizes
- **Undo** (or Cmd/Ctrl+Z) removes the last mark, **Clear marks** removes all of them, **Remove image** starts over

**Getting the image out:**
- **Copy image** puts the annotated PNG on the clipboard (needs a secure context — `localhost` or `https`, not `file://`)
- **Download PNG** saves it as `annotated-<timestamp>.png`

**Implementation notes:**
- Annotations are kept as a list of shape objects and re-rendered on every change, so undo is exact and the original image is never destroyed
- The canvas is always the image's natural pixel size and scaled down with CSS, so exports are full resolution regardless of zoom
- Pointer coordinates are mapped through the display-to-canvas scale factor, so drawing stays accurate on a scaled-down image

## Usage

### Opening the App
1. **Via static server**: `python3 -m http.server` in this directory, then open `http://localhost:8000`
2. **Directly as a file**: Open `index.html` in your browser (works due to vanilla JS, no module imports)

### Keyboard & Navigation
- **Tab navigation**: Click the sidebar buttons to switch between tools
- **Persistent state**: Active tool is saved to `localStorage` and restored on page reload
- **Dark mode**: Automatically follows system preference (`prefers-color-scheme`)

### Tips
- **JSON Viewer**: Type or paste JSON → tree renders automatically after a 300ms pause (debounced so typing doesn't lag)
- **JSON Transformer**: Use the toolbar buttons to apply transformations. Input and output are independent (use "Copy" button to copy the output). Hit **Expand** on either pane for a full-window editor, **Esc** to come back
- **Python Converter**: Paste Python literal syntax → converts to formatted JSON. Supports live debounced conversion.
- **Image Annotator**: Paste a screenshot, pick a tool and color, drag to draw. Serve over `localhost` if you want "Copy image" to work — clipboard image writes need a secure context.

## Architecture

### Dependencies
- Pure HTML5 and vanilla JavaScript — no build step, no npm, no node_modules
- Two CDN script tags: Tailwind CSS (styling) and JSONPath-Plus (the JSONPath engine, pinned to v11.2.1 with an SRI hash)
- Everything else — JSON parsing, Python conversion, CSV, Base64, image annotation — is hand-rolled and local
- Works offline except for the Tailwind and JSONPath-Plus CDN script loads
- Single-page app with client-side tab switching

### File Structure
```
devtools/
├── index.html              # Main shell and UI markup
├── css/
│   └── app.css             # Custom styles (tree rendering, dark mode)
├── js/
│   ├── utils.js            # Shared: JSON parsing, line/col conversion, debounce, case conversion
│   ├── app.js              # Nav/panel switching, localStorage
│   ├── base64-converter.js   # Tool 1: Base64 encode/decode
│   ├── json-viewer.js        # Tool 2: tree rendering and collapse/expand
│   ├── json-transform.js     # Tool 3: all transformation operations
│   ├── image-annotator.js    # Tool 5: canvas image annotation
│   └── py-to-json.js         # Tool 4: Python literal tokenizer + parser
└── README.md               # This file
```

### Browser Support
Requires a modern browser with:
- ES6+ (arrow functions, `const`/`let`, template literals)
- Fetch API (for potential future network ops; currently unused)
- `localStorage`
- CSS Grid/Flexbox

Tested on Chrome/Edge 90+, Firefox 88+, Safari 14+.

## Known Limitations

1. **JSONPath**: Requires the CDN script to load. Offline, the Extract button reports this and tells you how to vendor the file; every other tool keeps working. The `=~` operator is not supported — use `.match(/re/)`.
2. **Key case conversion**: Ambiguous acronym runs (e.g., `HTTPSConnectionID`) may not split perfectly. See the algorithm description above for exact behavior.
3. **CSV**: Cannot round-trip `null` vs. empty string (both become empty cells). Ragged rows (fewer columns than header) are padded with empty strings.
4. **Python converter**: Limited to literal data structures; no expressions, variables, or comprehensions.
5. **Tree view**: Very deeply nested JSON (1000+ levels) may hit recursion limits; not recommended for pathologically deep structures.

## Examples

### Example 1: Encode/Decode Base64 (Standard vs URL-Safe)
**Input text:**
```
Hello+World/Test==
```

1. Paste into **Base64** input
2. **Standard mode**: Click **Encode** → `SGVsbG8rV29ybGQvVGVzdD09`
3. **URL-Safe mode**: Click **Encode** → `SGVsbG8rV29ybGQvVGVzdD09` (same input)

**Decoding example:**
- **Standard**: Paste `SGVsbG8sIFdvcmxkISDwn4yN`, select Standard → Click **Decode** → `Hello, World! 🌍`
- **URL-Safe**: Paste `SGVsbG8sIFdvcmxkISDwn4yN`, select URL-Safe → Click **Decode** (auto-pads and converts) → `Hello, World! 🌍`

**Practical difference:**
- **URL in Standard**: `https://example.com/token=aGVsbG8gd29ybGQgKys/` (has `+` and `/` characters that may need escaping)
- **URL in URL-Safe**: `https://example.com/token=aGVsbG8gd29ybGQgLS1f` (safe to use directly, `-` and `_` don't need escaping)

### Example 2: Reformat and Extract
**Input (minified JSON):**
```json
{"users":[{"id":1,"name":"Alice","email":"alice@example.com"},{"id":2,"name":"Bob","email":"bob@example.com"}]}
```

1. Paste into **JSON Transformer** input
2. Click **Format** → nicely indented
3. In the JSONPath field, enter `$.users[*].email`
4. Click **Extract** → outputs an array of emails

### Example 3: Convert Python to JSON
**Input:**
```python
{'name': 'Alice', 'age': 30, 'tags': ('python', 'json'), 'active': True}
```

1. Paste into **Python → JSON** input
2. Auto-converts to:
```json
{
  "name": "Alice",
  "age": 30,
  "tags": ["python", "json"],
  "active": true
}
```

### Example 4: Normalize Key Styles
**Input:**
```json
{
  "user_id": 1,
  "userName": "alice",
  "email_address": "alice@example.com",
  "HTTPStatus": 200
}
```

1. Paste into **JSON Transformer** input
2. Select target case **snake_case**
3. Click **Convert Keys** → all keys become `snake_case`

## License

Public domain. Use freely.
