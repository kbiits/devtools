# Quick Start

## Install & Run

### Option 1: Simple HTTP Server (Recommended)
```bash
cd /Users/nabiel.syarif/Developments/devtools
python3 -m http.server 8000
```
Then open http://localhost:8000 in your browser.

### Option 2: Direct File Access
Open `index.html` directly in your browser (file → open, or drag/drop the file).
- Works due to vanilla JS (no module imports that require CORS)
- No build step needed

### Option 3: Other Servers
Any static file server works:
```bash
# Using Node.js http-server (if installed)
npx http-server .

# Using PHP
php -S localhost:8000

# Using Ruby
ruby -run -ehttpd . -p8000
```

## What You Get

1. **Base64 Encoder/Decoder** - Encode text to Base64 or decode Base64 back to text
2. **JSON Viewer** - Paste JSON → interactive collapsible tree with syntax highlighting
3. **JSON Transformer** - Format, minify, sort, extract (JSONPath), convert case, escape/unescape, CSV conversion
4. **Python → JSON** - Convert Python literals (dicts, lists, tuples, etc.) to JSON

## Try It Now

### Example 1: Encode/Decode Base64 (with URL-Safe Mode)
1. Click **Base64** tab
2. Paste: `Hello, DevTools! 🚀`
3. Select **Standard** mode (default)
4. Click **Encode**
5. See: `SGVsbG8sIERldlRvb2xzISDwn5qK`
6. For URL-safe: select **URL-Safe** mode and encode again
7. See: Different format without `+/=` characters (ideal for URLs)
8. Click **Decode** to get back the original text

### Example 2: JSON Viewer
1. Click **JSON Viewer** tab
2. Paste:
   ```json
   {
     "users": [
       {"id": 1, "name": "Alice", "active": true},
       {"id": 2, "name": "Bob", "active": false}
     ]
   }
   ```
3. Click the arrow next to `users` to collapse/expand

### Example 3: Extract Data with JSONPath
1. Click **JSON Transformer** tab
2. Paste the same JSON above into the input
3. In the "JSONPath Query" field, type: `$.users[*].name`
4. Results appear as you type (or press Enter): `["Alice", "Bob"]`
5. Try a filter: `$.users[?(@.age > 25)].name`, or switch the dropdown to **Paths** to see where each match lives

### Example 4: Python to JSON
1. Click **Python → JSON** tab
2. Paste:
   ```python
   {'name': 'Alice', 'tags': ('python', 'json'), 'active': True}
   ```
3. See it convert automatically to:
   ```json
   {
     "name": "Alice",
     "tags": ["python", "json"],
     "active": true
   }
   ```

## Features

- ✅ **Fully client-side** - no server processing, all data stays local
- ✅ **No build step** - pure HTML/CSS/JS, works immediately
- ✅ **No dependencies** - only Tailwind CSS from CDN (everything else is vanilla)
- ✅ **Dark mode** - automatically follows system preference
- ✅ **Persistent state** - remembers which tool you were using
- ✅ **Works offline** - except for the Tailwind CDN script load

## Documentation

- **Full feature docs**: See [README.md](README.md)
- **Detailed test cases**: See [TESTING.md](TESTING.md)
- **JSONPath syntax**: See [README.md#jsonpath-query](README.md#jsonpath-query)
- **Key case conversion**: See [README.md#key-case-conversion](README.md#key-case-conversion)

## Browser Support

Requires a modern browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+).

## Troubleshooting

**"Failed to load" errors in console?**
- Make sure you're serving via HTTP (not opening as `file://`) OR that Tailwind CDN is accessible
- Try using a simple server: `python3 -m http.server 8000`

**Dark mode isn't working?**
- It should follow your OS settings automatically
- In Chrome DevTools, toggle: F12 → Rendering → "Emulate CSS media feature prefers-color-scheme"

**Data seems to disappear after reload?**
- Each tool has its own textarea — the JSON Viewer's input doesn't persist to localStorage (by design)
- The only persistent state is which tool tab you had selected

## What's Next?

- Edit JSON in real-time with the Transformer
- Normalize key naming conventions across JSON documents
- Convert CSV data to/from JSON
- Parse Python data structures without running Python

Enjoy! 🚀
