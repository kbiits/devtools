# Manual Testing Guide

This document outlines test cases for verifying the devtools application works correctly. Since there's no automated test framework, these are manual tests to perform in a browser.

## Setup

1. Start the server: `python3 -m http.server 8000` in this directory
2. Open http://localhost:8000 in a modern browser
3. Optionally test with dark mode: toggle your OS dark mode setting while the app is open, or use browser DevTools to simulate it

## Test Suite

### General / Navigation

- [ ] **Page loads without errors** - Check browser console (F12 → Console) for any errors
- [ ] **Sidebar navigation works** - Click each of the five buttons (JSON Viewer, JSON Transform, Python → JSON, Base64, Image Annotator) and confirm the correct panel is shown
- [ ] **Active tab styling** - The current tab button should have blue background, others should be gray
- [ ] **Persistent state** - Click a different tab, reload the page (F5), confirm the same tab is still active
- [ ] **Dark mode** - Toggle your OS dark mode (or use Chrome DevTools → Rendering → Emulate CSS media) and confirm the page has good contrast and proper color scheme in both modes

---

## Tool 1: Base64 Encoder/Decoder

### Basic Functionality

- [ ] **Empty input** - Leave input empty, click encode/decode, confirm nothing happens and no errors
- [ ] **Simple text to Base64** - Input: `Hello, World!`, click **Encode to Base64**
  Expected: Output shows `SGVsbG8sIFdvcmxkIQ==`

- [ ] **Base64 to text** - Input: `SGVsbG8sIFdvcmxkIQ==`, click **Decode from Base64**
  Expected: Output shows `Hello, World!`

- [ ] **Round-trip** - Encode text to Base64, then decode the output, should get original text back
  Example: `DevTools` → encode → decode → `DevTools`

### UTF-8 Support

- [ ] **Emoji encoding** - Input: `Hello 🚀`, click **Encode to Base64**
  Expected: Output shows proper Base64 with emoji encoded

- [ ] **Emoji decoding** - Encode an emoji string, then decode it, should get original emoji back

- [ ] **Unicode characters** - Input: `你好世界 (Hello World in Chinese)`, encode and decode
  Expected: Round-trip works perfectly with non-Latin characters

- [ ] **Mixed text** - Input: `Hello 世界 🌍 DevTools`, encode and decode
  Expected: All characters preserved correctly

### Error Cases

- [ ] **Invalid Base64** - Input: `!!!invalid!!!`, click **Decode from Base64**
  Expected: Error box shows "Invalid Base64 characters"

- [ ] **Malformed Base64** - Input: `SGVs` (truncated/invalid padding), click **Decode from Base64**
  Expected: Clear error message about decoding failure

### URL-Safe Mode (RFC 4648 Section 5)

- [ ] **Standard vs URL-Safe difference** - Input: `Hello+World/Test`, select Standard mode, click Encode
  Expected: Output contains `+` and `/` characters

- [ ] **URL-Safe encoding** - Same input `Hello+World/Test`, select URL-Safe mode, click Encode
  Expected: Output uses `-` and `_` instead, no `=` padding

- [ ] **URL-Safe decoding** - Encode something with URL-Safe mode, then decode it
  Expected: Round-trip works correctly, original text recovered

- [ ] **Mixed mode handling** - Encode with Standard mode, then try to decode with URL-Safe mode (or vice versa)
  Expected: For simple text without `+/=` characters, both modes work; for text with special chars, mode mismatch shows clear error

- [ ] **Padding removal** - Encode with URL-Safe mode, confirm output has no `=` padding
  Expected: URL-safe output is shorter when padding would normally be present

### Copy Button

- [ ] **Copy encoded output** - Encode some text (either mode), click **Copy** button next to output
  Expected: Button shows "Copied!" for 2 seconds, text is in clipboard

- [ ] **Copy decoded output** - Decode some Base64 (either mode), click **Copy**
  Expected: Same behavior, decoded text is in clipboard

---

## Tool 2: JSON Viewer

### Basic Functionality

- [ ] **Empty input** - Leave the input empty, confirm it shows "Enter JSON to see a preview" and no errors
- [ ] **Valid JSON** - Paste this and confirm it renders as a tree:
  ```json
  {
    "name": "Alice",
    "age": 30,
    "tags": ["python", "json"],
    "active": true,
    "address": null
  }
  ```
  Expected: Keys in red, strings in green, numbers in blue, true/false in orange, null in gray italic

- [ ] **Tree structure** - In the above example, click the arrow next to `"tags"` to collapse it, then expand it again
  - Confirm the array shows `[3]` when collapsed (count of elements)
  - Confirm collapse state persists while editing other parts of the input

- [ ] **Invalid JSON error** - Paste this invalid JSON and confirm an error message appears:
  ```json
  {"name": "Alice", "age": 30,}
  ```
  Expected: Error box shows "Parse error at line X, column Y:" with a descriptive message

### Edge Cases

- [ ] **Large JSON** - Paste a large JSON file (100+ lines, 1000+ elements) and confirm:
  - The page doesn't freeze while you're typing
  - The tree renders quickly after you stop typing
  - Deeply nested items start collapsed to keep the UI light

- [ ] **Unicode strings** - Paste:
  ```json
  {
    "emoji": "😀🎉",
    "chinese": "你好世界",
    "escaped": "éè"
  }
  ```
  Expected: All characters render correctly as-is

- [ ] **Numbers with exponents** - Paste:
  ```json
  {
    "large": 1e10,
    "small": 1e-5,
    "negative": -3.14e2
  }
  ```
  Expected: All parse and display correctly

---

## Tool 3: JSON Transformer

### Format & Minify

- [ ] **Format with 2 spaces** - Input:
  ```json
  {"a":1,"b":[1,2,3],"c":{"d":2}}
  ```
  Click **Format**, select indent = "2 spaces", click **Format** again
  Expected: Each level indented by 2 spaces

- [ ] **Format with 4 spaces** - Same input, select "4 spaces", click **Format**
  Expected: Each level indented by 4 spaces

- [ ] **Format with tabs** - Same input, select "Tab", click **Format**
  Expected: Each level indented by a single tab character

- [ ] **Minify** - Paste formatted JSON, click **Minify**
  Expected: All whitespace removed, single-line output with no spaces around colons/commas

### Sort Keys

- [ ] **Basic sort** - Input:
  ```json
  {
    "zebra": 1,
    "apple": 2,
    "mango": 3
  }
  ```
  Click **Sort Keys**
  Expected: Keys appear in alphabetical order: apple, mango, zebra

- [ ] **Recursive sort** - Input:
  ```json
  {
    "z": {"z": 1, "a": 2},
    "a": {"z": 1, "a": 2}
  }
  ```
  Click **Sort Keys**
  Expected: Both top-level and nested keys sorted alphabetically

### JSONPath Query

Most cases below use this document, referred to as **the store doc**:

```json
{
  "store": {
    "book": [
      {"category": "reference", "author": "Nigel Rees", "title": "Sayings of the Century", "price": 8.95},
      {"category": "fiction", "author": "Evelyn Waugh", "title": "Sword of Honour", "price": 12.99},
      {"category": "fiction", "author": "Herman Melville", "title": "Moby Dick", "isbn": "0-553-21311-3", "price": 8.99},
      {"category": "fiction", "author": "J. R. R. Tolkien", "title": "The Lord of the Rings", "isbn": "0-395-19395-8", "price": 22.99}
    ],
    "bicycle": {"color": "red", "price": 19.95}
  },
  "expensive": 10,
  "mixed": [1, null, "two", {"c": 3}]
}
```

#### Basics

- [ ] **Library loaded** - Open the JSON Transformer with devtools console open
  Expected: No CSP/MIME/integrity errors; `window.JSONPath.JSONPath` is a function
- [ ] **Simple path** - Path: `$.store.bicycle.color`
  Expected: `"red"`, caption "1 match"
- [ ] **Live results** - Type `$..author` one character at a time
  Expected: Output updates as you type (300ms debounce); the big red error box never appears for half-typed paths, only the small caption under the field
- [ ] **Enter runs immediately** - Put the cursor in the path field and press Enter
  Expected: Query runs without waiting for the debounce
- [ ] **Wildcard** - Path: `$.store.book[*].author`
  Expected: All four authors, caption "4 matches"
- [ ] **Index** - Path: `$.store.book[2].title` → `"Moby Dick"`
- [ ] **Negative index** - Path: `$.store.book[-1:].title` → `["The Lord of the Rings"]`
- [ ] **Quoted key** - Input `{"user-info": {"first-name": "Alice"}}`, Path: `$['user-info']['first-name']`
  Expected: `"Alice"`

#### Full JSONPath syntax

- [ ] **Recursive descent** - Path: `$..price`
  Expected: `[8.95, 12.99, 8.99, 22.99, 19.95]` (includes the bicycle)
- [ ] **Every node** - Path: `$..*` → a long list, no errors
- [ ] **Slice** - Path: `$..book[:2].title` → first two titles
- [ ] **Slice with step** - Path: `$..book[1:4:2].title` → `["Sword of Honour", "The Lord of the Rings"]`
- [ ] **Union** - Path: `$..book[0,1].title` → first two titles
- [ ] **Filter: existence** - Path: `$..book[?(@.isbn)].title` → Moby Dick and LOTR
- [ ] **Filter: comparison** - Path: `$..book[?(@.price<10)].title` → Sayings of the Century, Moby Dick
- [ ] **Filter: against root** - Path: `$..book[?(@.price < $.expensive)].title`
  Expected: Same two titles (`$` resolves to the whole document inside the filter)
- [ ] **Filter: @root alias** - Path: `$..book[?(@.price < @root.expensive)].title` → same result
- [ ] **Filter: boolean logic** - Path: `$..book[?(@.category=='fiction' && @.price>10)].title`
  Expected: Sword of Honour, The Lord of the Rings
- [ ] **Filter: negation** - Path: `$..book[?(!@.isbn)].title` → the two without an ISBN
- [ ] **Filter: regex** - Path: `$..book[?(@.author.match(/Tolkien/))].title` → `"The Lord of the Rings"`
- [ ] **Filter: on key** - Path: `$.store.bicycle[?(@property === 'color')]` → `"red"`
- [ ] **Filter over mixed types** - Path: `$.mixed[?(@.c)]`
  Expected: `{"c": 3}` — the `null` and scalars are skipped, not an error
- [ ] **Type selector** - Path: `$..*@number()` → every numeric value
- [ ] **Parent operator** - Path: `$..bicycle.color^` → the whole bicycle object
- [ ] **Key operator** - Path: `$.store.*~` → `["book", "bicycle"]`
- [ ] **Length** - Path: `$..book.length` → `4`
- [ ] **Script expression** - Path: `$..book[(@.length-1)].title` → the last title

#### Output modes and unwrapping

- [ ] **Values mode** (default) - Path: `$..book[?(@.price < 10)].title` → the two titles
- [ ] **Paths mode** - Same path, switch select to **Paths**
  Expected: `["$['store']['book'][0]['title']", "$['store']['book'][2]['title']"]`
- [ ] **Path + value mode** - Expected: objects with `path`, `pointer`, and `value` keys (no `parent` noise)
- [ ] **JSON Pointers mode** - Expected: `["/store/book/0/title", "/store/book/2/title"]`
- [ ] **Switching mode re-runs** - Change the select with a path already entered
  Expected: Output updates immediately, no need to click Extract
- [ ] **Unwrap on** (default) - Path: `$.store.book[0].title` → `"Sayings of the Century"`
- [ ] **Unwrap off** - Untick the checkbox, same path → `["Sayings of the Century"]`
- [ ] **Unwrap does not apply to multiple matches** - Path: `$..author` with unwrap on → still an array

#### Editor panes

- [ ] **Minimum height** - Shrink the browser window vertically until the page scrolls
  Expected: Input and Output stay at a usable height (the panel scrolls instead of squashing them)
- [ ] **Manual resize** - Drag the bottom-right corner of the Input box
  Expected: It resizes vertically
- [ ] **Expand input** - Click **Expand** on the Input pane
  Expected: It fills the entire window, button becomes **Exit**, the page behind does not scroll
- [ ] **Esc exits** - With a pane expanded, press Escape → back to the split view
- [ ] **Switching panes** - Expand Input, then click **Expand** on Output
  Expected: Input collapses and Output expands (only ever one at a time)
- [ ] **Copy while expanded** - Expand Output, click **Copy**
  Expected: Copies as usual, pane stays expanded
- [ ] **Leaving the tool** - Expand a pane, then click another tool in the sidebar
  Expected: Full screen exits; coming back shows the normal split view
- [ ] **Transform while expanded** - Expand Input, paste JSON, press Esc, click **Format**
  Expected: The pasted text is there and formats normally

#### Errors

- [ ] **No matches** - Path: `$.nonexistent.deep`
  Expected: Output `[]`, caption "No matches", no red error box
- [ ] **Unclosed bracket** - Path: `$.store.book[`
  Expected: "Path error: Unclosed '[' at position 13" (caught before the query — the library would otherwise return the whole array)
- [ ] **Unterminated quote** - Path: `$['store`
  Expected: "Path error: Unterminated single quote"
- [ ] **Bad filter** - Path: `$..book[?(@.price ==)]`
  Expected: A path error quoting the library's message, not a silent empty result
- [ ] **`=~` operator** - Path: `$..book[?(@.author =~ /Tolkien/)]`
  Expected: Error explaining `=~` is unsupported and suggesting `.match(/pattern/)`
- [ ] **Type filter misuse** - Path: `$..[?(@string())]`
  Expected: Error explaining type filters are path steps, e.g. `$..*@string()`
- [ ] **Empty path** - Clear the field and click **Extract** → "Path is empty"
- [ ] **Invalid JSON input** - Break the input JSON, then run a query
  Expected: Parse error with line/column, not a JSONPath error
- [ ] **Library unavailable** - Go offline (devtools → Network → Offline), hard-reload, click **Extract**
  Expected: Clear message that the JSONPath library did not load, including the URL and how to vendor it locally; the other tools still work

### Key Case Conversion

- [ ] **camelCase → snake_case** - Input:
  ```json
  {
    "userId": 1,
    "userName": "alice",
    "userEmail": "alice@example.com"
  }
  ```
  Select "snake_case", click **Convert Keys**
  Expected: All keys become `user_id`, `user_name`, `user_email`

- [ ] **snake_case → camelCase** - Input:
  ```json
  {
    "user_id": 1,
    "user_name": "alice"
  }
  ```
  Select "camelCase", click **Convert Keys**
  Expected: All keys become `userId`, `userName`

- [ ] **PascalCase conversion** - Input:
  ```json
  {
    "firstName": "Alice",
    "last_name": "Smith"
  }
  ```
  Select "PascalCase", click **Convert Keys**
  Expected: All keys become `FirstName`, `LastName`

- [ ] **kebab-case conversion** - Input:
  ```json
  {
    "firstName": "Alice",
    "last_name": "Smith",
    "HTTPStatus": 200
  }
  ```
  Select "kebab-case", click **Convert Keys**
  Expected: All keys become `first-name`, `last-name`, `http-status`

### Escape / Unescape

- [ ] **Escape** - Input: `Hello "world" with\nnewline`, click **Escape JSON**
  Expected: Output is a valid JSON string literal: `"Hello \"world\" with\nnewline"`

- [ ] **Unescape** - Input: `"Hello \"world\""`, click **Unescape JSON**
  Expected: Output shows the raw text: `Hello "world"`

- [ ] **Round-trip** - Use Escape to convert raw text to a JSON string, copy it, paste into input, use Unescape to get back the original text
  Expected: Original text is fully recovered

### CSV Conversion

- [ ] **JSON → CSV** - Input:
  ```json
  [
    {"name": "Alice", "age": 30, "city": "NYC"},
    {"name": "Bob", "age": 25, "city": "LA"}
  ]
  ```
  Click **JSON → CSV**
  Expected: Output is:
  ```
  "name","age","city"
  "Alice",30,"NYC"
  "Bob",25,"LA"
  ```

- [ ] **CSV with commas in values** - Input:
  ```json
  [
    {"name": "Doe, Jr.", "note": "Says \"hello\""}
  ]
  ```
  Click **JSON → CSV**
  Expected: Values with commas/quotes are properly quoted:
  ```
  "name","note"
  "Doe, Jr.","Says ""hello"""
  ```

- [ ] **CSV with missing keys** - Input:
  ```json
  [
    {"name": "Alice", "email": "alice@example.com"},
    {"name": "Bob", "phone": "555-1234"}
  ]
  ```
  Click **JSON → CSV**
  Expected: Header is `"name","email","phone"`; Bob's row has an empty cell for email

- [ ] **CSV → JSON** - Input:
  ```
  name,age,active
  Alice,30,true
  Bob,25,false
  ```
  Click **CSV → JSON**
  Expected: Output is an array of objects with booleans parsed correctly

- [ ] **CSV with quoted commas** - Input:
  ```
  name,description
  Item A,"Costs $5, includes tax"
  ```
  Click **CSV → JSON**
  Expected: The comma inside the quoted field is preserved in the output

### Copy Button

- [ ] **Copy output** - Enter some JSON, apply a transformation, click the **Copy** button next to the output
  Expected: Button text changes to "Copied!" for 2 seconds, then reverts; output is available in clipboard

---

## Tool 4: Python → JSON

### Basic Functionality

- [ ] **Empty input** - Leave input empty
  Expected: Output is empty, no error

- [ ] **Simple dict** - Input:
  ```python
  {'name': 'Alice', 'age': 30}
  ```
  Expected: Immediately converts to JSON:
  ```json
  {
    "name": "Alice",
    "age": 30
  }
  ```

- [ ] **List** - Input:
  ```python
  [1, 2.5, 'three', True, False, None]
  ```
  Expected: Correct JSON array with proper type conversions

- [ ] **Tuple** - Input:
  ```python
  (1, 2, 3)
  ```
  Expected: Converts to JSON array `[1, 2, 3]`

- [ ] **Single-element tuple** - Input:
  ```python
  (42,)
  ```
  Expected: Converts to `[42]` (note the trailing comma in Python)

- [ ] **Nested structures** - Input:
  ```python
  {
    'users': [
      {'id': 1, 'name': 'Alice', 'tags': ('admin', 'user')},
      {'id': 2, 'name': 'Bob', 'tags': ()}
    ]
  }
  ```
  Expected: Full nested conversion works correctly

### String Handling

- [ ] **Single-quoted strings** - Input:
  ```python
  {'msg': 'Hello world'}
  ```
  Expected: Converts to double-quoted JSON

- [ ] **Double-quoted strings** - Input:
  ```python
  {"msg": "Hello world"}
  ```
  Expected: Converts correctly

- [ ] **String escapes** - Input:
  ```python
  {'newline': 'line1\nline2', 'tab': 'col1\tcol2', 'quote': "He said \"hi\""}
  ```
  Expected: All escapes are correctly converted to JSON escapes

- [ ] **Mixed quotes** - Input:
  ```python
  {"apostrophe": "it's working"}
  ```
  Expected: Converts without error

### Numbers

- [ ] **Integers** - Input:
  ```python
  {'small': 42, 'large': 1000000, 'negative': -99}
  ```
  Expected: All parse as JSON numbers

- [ ] **Floats** - Input:
  ```python
  {'pi': 3.14159, 'small': 0.001}
  ```
  Expected: All parse correctly

- [ ] **Scientific notation** - Input:
  ```python
  {'big': 1e10, 'small': 1e-5, 'negative': -2.5e3}
  ```
  Expected: All parse correctly

### Error Cases

- [ ] **Function call** - Input:
  ```python
  dict(name='Alice')
  ```
  Expected: Error "Parse error at line X, column Y: Unexpected identifier 'dict'..."

- [ ] **Non-string dict key** - Input:
  ```python
  {1: 'value'}
  ```
  Expected: Error "Dict keys must be strings..."

- [ ] **Set syntax** - Input:
  ```python
  {1, 2, 3}
  ```
  Expected: Error "sets are not supported"

- [ ] **Unterminated string** - Input:
  ```python
  {'name': 'Alice
  ```
  Expected: Error "Parse error... Unterminated string..."

- [ ] **Variable reference** - Input:
  ```python
  {'name': name}
  ```
  Expected: Error "Unexpected identifier 'name'..."

### Copy Button

- [ ] **Copy output** - Enter Python literal, output generates, click **Copy** button
  Expected: Button shows "Copied!" for 2 seconds; JSON is in clipboard

---

## Tool 5: Image Annotator

> Run these from `http://localhost:8000` — the **Copy image** button needs a secure context and will not work from a `file://` page.

### Loading an Image

- [ ] **Empty state** - Open the panel with no image loaded
  Expected: Dashed drop zone with "Paste an image (Cmd/Ctrl+V)"; toolbar is visible but doing nothing errors out gracefully
- [ ] **Paste** - Copy a screenshot (Cmd+Shift+Ctrl+4 on macOS), click the panel, press Cmd/Ctrl+V
  Expected: Image appears on the canvas, drop zone disappears, dimensions show on the right (e.g. `1280 x 800 px`)
- [ ] **Drag and drop** - Drag a PNG/JPG onto the canvas area
  Expected: Drop zone border highlights blue while dragging, image loads on drop
- [ ] **Upload** - Click **Upload**, pick an image
  Expected: Image loads; picking the same file again still works (input is reset)
- [ ] **Non-image file** - Drop a `.txt` file
  Expected: Error "Not an image file", current image untouched
- [ ] **Replace image** - Load an image, draw on it, then paste a different image
  Expected: New image loads and all previous marks are discarded

### Drawing

- [ ] **Rectangle** - Select **Rectangle**, drag on the canvas
  Expected: Outlined box follows the cursor while dragging and stays put on release
- [ ] **Drag in any direction** - Drag a rectangle right-to-left and bottom-to-top
  Expected: Box is drawn correctly (no negative-size glitches)
- [ ] **Arrow** - Select **Arrow**, drag
  Expected: Line with a filled arrowhead at the end point (where you released)
- [ ] **Pen** - Select **Pen**, scribble
  Expected: Smooth freehand line follows the cursor
- [ ] **Single click with pen** - Click without moving
  Expected: A small dot, no error
- [ ] **Text** - Select **Text**, click the canvas, type `hello`, press Enter
  Expected: Text input appears at the click point; on Enter the label is drawn at the same spot with a white outline for contrast
- [ ] **Text cancel** - Click, type, press Escape
  Expected: Input disappears and nothing is drawn
- [ ] **Empty text** - Click, press Enter without typing
  Expected: Nothing is drawn, no stray marks
- [ ] **Consecutive labels** - With the text tool, click, type, then click elsewhere without pressing Enter
  Expected: First label is committed, a fresh input opens at the new spot

### Styling

- [ ] **Preset colors** - Click each swatch, then draw
  Expected: New shapes use the chosen color; existing shapes keep their original color
- [ ] **Custom color** - Pick a color from the color input, then draw
  Expected: Shape uses the custom color and the swatch ring clears
- [ ] **Stroke width** - Draw rectangles at Thin and Extra thick
  Expected: Visibly different line weights; arrowheads scale with the stroke
- [ ] **Text size** - Draw text at Small and Huge
  Expected: Label sizes differ, and the on-canvas input preview roughly matches the final size

### Editing and Export

- [ ] **Undo button** - Draw three shapes, click **Undo** twice
  Expected: Last two shapes disappear, first remains, image intact
- [ ] **Undo shortcut** - Press Cmd/Ctrl+Z
  Expected: Same as the Undo button; typing Cmd/Ctrl+Z inside the text input does not remove shapes
- [ ] **Undo with nothing left** - Click **Undo** on a clean image repeatedly
  Expected: No error, image stays
- [ ] **Clear marks** - Draw several shapes, click **Clear marks**
  Expected: All annotations gone, original image still loaded
- [ ] **Remove image** - Click **Remove image**
  Expected: Back to the drop zone, dimensions label cleared
- [ ] **Download PNG** - Draw marks, click **Download PNG**
  Expected: `annotated-<timestamp>.png` downloads; opening it shows the image with all marks at the image's full resolution
- [ ] **Copy image** - Click **Copy image** on localhost, then paste into Slack/Preview/a doc
  Expected: Button flashes "Copied!" and the annotated image pastes
- [ ] **Copy image over file://** - Open `index.html` directly and click **Copy image**
  Expected: Clear error telling you to use Download instead (no silent failure)

### Scaling Accuracy

- [ ] **Large image** - Load an image wider than the panel (e.g. 3000px wide) so it is scaled down to fit
  Expected: Shapes land exactly under the cursor, not offset or at the wrong scale
- [ ] **Window resize** - Draw a shape, resize the window, draw another
  Expected: Both shapes are positioned correctly relative to the image
- [ ] **Exported resolution** - Download the annotated large image
  Expected: Output matches the original image dimensions (not the shrunken on-screen size)

---

## Final Checklist

- [ ] No JavaScript errors in browser console (F12 → Console)
- [ ] All five tools load without lag
- [ ] Keyboard navigation works (Tab key moves focus between inputs, Enter submits buttons where applicable)
- [ ] Resize browser window and confirm layout remains usable on narrow screens
- [ ] Test in both light and dark modes
- [ ] Close browser, reopen, confirm last-viewed tool is still active (localStorage persists)
