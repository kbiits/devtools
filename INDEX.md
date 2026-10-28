# DevTools Documentation Index

Complete documentation for the static client-side devtools application.

## 📖 Start Here

1. **[SUMMARY.md](SUMMARY.md)** — High-level overview of what was built, key features, and how to get started
2. **[QUICKSTART.md](QUICKSTART.md)** — Get running in < 1 minute with four example use cases

## 🚀 How to Use

- **[README.md](README.md)** — Full feature documentation with detailed guides for each tool
  - Base64 encode/decode (UTF-8 support)
  - JSON Viewer capabilities
  - JSON Transformer operations (7 different tools)
  - JSONPath-lite syntax and grammar
  - Key case conversion algorithm
  - CSV conversion rules
  - Python literal syntax support

## 🧪 Testing

- **[TESTING.md](TESTING.md)** — Manual test checklist with 100+ test cases covering:
  - General navigation
  - Base64 encode/decode
  - All JSON Viewer features
  - All Transformer operations
  - All Python converter features
  - Edge cases and error handling

## 🏗️ Technical Details

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — System design and implementation details
  - Tech stack and principles
  - Module organization
  - Data flows
  - State management
  - Error handling
  - Security guarantees
  - Performance considerations
  - Extensibility guidelines

## 📁 File Structure

```
devtools/
├── index.html              # Main SPA (single-page application)
├── css/app.css             # Custom styles
├── js/
│   ├── utils.js             # Shared utilities (case conversion, parsing, debounce)
│   ├── app.js               # App shell (navigation, tab switching, localStorage)
│   ├── base64-converter.js  # Tool 1: Base64 encode/decode
│   ├── json-viewer.js       # Tool 2: interactive tree viewer
│   ├── json-transform.js    # Tool 3: format, sort, extract, convert, escape, CSV
│   ├── py-to-json.js        # Tool 4: Python literal converter
│   └── image-annotator.js   # Tool 5: Image annotator (canvas)
├── README.md               # Features and usage guide
├── QUICKSTART.md           # Quick start (examples)
├── TESTING.md              # Test cases
├── ARCHITECTURE.md         # Technical design
├── SUMMARY.md              # Project summary
└── INDEX.md                # This file
```

## ✨ Key Features

### Tool 1: Base64 Encoder/Decoder
- Encode any UTF-8 text to Base64
- Decode Base64 back to text
- Full Unicode support (emoji, non-Latin scripts)
- Clear error messages for invalid input

### Tool 2: JSON Viewer
- Real-time JSON parsing with error positions
- Syntax-highlighted collapsible tree
- Lazy rendering for performance
- Auto-collapses deep nesting

### Tool 3: JSON Transformer
- **Format/Minify** — Pretty-print with customizable indent
- **Sort Keys** — Recursive alphabetization
- **JSONPath Query** — Full JSONPath via JSONPath-Plus: filters, slices, unions, recursive descent (`$..book[?(@.price < 10)]`)
- **Key Case Conversion** — camelCase ↔ snake_case ↔ kebab-case ↔ PascalCase
- **Escape/Unescape** — JSON string literal round-trips
- **CSV Conversion** — Flat JSON arrays ↔ CSV (handles quoting, commas)

### Tool 4: Python → JSON
- Converts Python literal syntax to JSON
- Supports dicts, lists, tuples, strings, numbers, booleans, None
- Explicit error messages for unsupported syntax
- No eval() or code execution

### Tool 5: Image Annotator
- Paste (Cmd/Ctrl+V), drop, or upload an image
- Draw rectangles, arrows, freehand pen, and text labels
- Preset + custom colors, stroke widths, text sizes
- Undo (Cmd/Ctrl+Z), clear marks, copy to clipboard, download PNG
- 100% client-side — the image is never uploaded anywhere

## 🔒 Security

- ✅ No eval() or Function() anywhere in this codebase
- ✅ No bundler or npm install; CDN scripts are pinned by version (JSONPath-Plus also by SRI hash)
- ✅ All parsing is manual string scanning
- ✅ No user code execution (Python parser rejects calls/variables by grammar; JSONPath filters use JSONPath-Plus's default `safe` evaluator, not `eval`/`Function`)
- ✅ All data stays local (no network requests except Tailwind CDN)

## 🌐 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🚀 Getting Started

### Quick Start
```bash
cd /Users/nabiel.syarif/Developments/devtools
python3 -m http.server 8000
# Open http://localhost:8000 in your browser
```

### Or Open Directly
Just open `index.html` in your browser (works without a server).

## 📚 Documentation Map

| Document | Purpose | Audience |
|----------|---------|----------|
| SUMMARY.md | Project overview | Everyone |
| QUICKSTART.md | Get started in 2 minutes | New users |
| README.md | Feature reference | Users wanting details |
| TESTING.md | Manual test cases | QA / power users |
| ARCHITECTURE.md | System design | Developers / contributors |
| This file (INDEX.md) | Navigation | Everyone |

## 💡 Tips

- Click the **Copy** button next to any output to copy to clipboard
- Use **JSONPath** queries to extract specific data (e.g., `$.users[*].email`)
- All three tools work with **dark mode** automatically
- Your selected tool is **remembered** across page reloads (localStorage)

## 🔍 Common Tasks

### Encode/decode Base64
1. Go to **Base64**
2. Paste text or Base64 data
3. Click **Encode to Base64** or **Decode from Base64**

### Parse JSON and view it as a tree
1. Go to **JSON Viewer**
2. Paste JSON
3. Click arrows to expand/collapse nodes

### Convert Python to JSON
1. Go to **Python → JSON**
2. Paste Python literal syntax
3. JSON appears automatically

### Extract specific data from JSON
1. Go to **JSON Transformer**
2. Paste JSON
3. Enter a JSONPath query (e.g., `$.items[*].id`)
4. Click **Extract**

### Normalize keys to snake_case
1. Go to **JSON Transformer**
2. Paste JSON
3. Select **snake_case** from dropdown
4. Click **Convert Keys**

### Convert CSV to JSON
1. Go to **JSON Transformer**
2. Paste CSV data
3. Click **CSV → JSON**

## 🎯 Design Philosophy

- **Zero dependencies** — no npm, no build step
- **Security first** — no eval() in our code, no user code execution
- **Offline-capable** — works after page load
- **Accessible** — clear error messages, keyboard navigation
- **Extensible** — easy to add new tools following the same pattern

## 📝 License

Public domain. Use freely, modify as needed.

---

**Version**: 1.0  
**Status**: ✅ Complete and ready for use  
**Last updated**: 2026-10-14
