DevTools.JSONTransform = (function() {
  function showError(msg) {
    const errorBox = document.getElementById('transform-error');
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
  }

  function hideError() {
    const errorBox = document.getElementById('transform-error');
    errorBox.classList.add('hidden');
  }

  function setOutput(text) {
    document.getElementById('transform-output').value = text;
  }

  function getInput() {
    return document.getElementById('transform-input').value;
  }

  function format() {
    hideError();
    const input = getInput();
    if (!input.trim()) {
      showError('Input is empty');
      return;
    }

    const result = DevTools.parseJsonWithPos(input);
    if (!result.ok) {
      showError(`Parse error: ${result.message}`);
      return;
    }

    const indent = document.getElementById('indent-size').value;
    const formatted = JSON.stringify(result.value, null, indent === 'tab' ? '\t' : parseInt(indent));
    setOutput(formatted);
  }

  function minify() {
    hideError();
    const input = getInput();
    if (!input.trim()) {
      showError('Input is empty');
      return;
    }

    const result = DevTools.parseJsonWithPos(input);
    if (!result.ok) {
      showError(`Parse error: ${result.message}`);
      return;
    }

    const minified = JSON.stringify(result.value);
    setOutput(minified);
  }

  function sortKeys() {
    hideError();
    const input = getInput();
    if (!input.trim()) {
      showError('Input is empty');
      return;
    }

    const result = DevTools.parseJsonWithPos(input);
    if (!result.ok) {
      showError(`Parse error: ${result.message}`);
      return;
    }

    const sorted = DevTools.sortKeysDeep(result.value);
    const formatted = JSON.stringify(sorted, null, 2);
    setOutput(formatted);
  }

  // --- JSONPath ----------------------------------------------------------
  // Queries run through JSONPath-Plus (loaded from CDN in index.html).

  function getJSONPath() {
    return window.JSONPath && window.JSONPath.JSONPath;
  }

  function setCaption(text, isError) {
    const caption = document.getElementById('jsonpath-caption');
    if (!text) {
      caption.classList.add('hidden');
      return;
    }
    caption.textContent = text;
    caption.classList.remove('hidden');
    caption.classList.toggle('text-red-600', !!isError);
    caption.classList.toggle('dark:text-red-400', !!isError);
    caption.classList.toggle('text-gray-500', !isError);
    caption.classList.toggle('dark:text-gray-400', !isError);
  }

  // JSONPath-Plus silently returns odd results for unbalanced input
  // (`$.a[` yields the whole array), so catch that before querying.
  function findUnbalanced(path) {
    const stack = [];
    let quote = null;

    for (let i = 0; i < path.length; i++) {
      const c = path[i];

      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) quote = null;
        continue;
      }

      if (c === '"' || c === "'") {
        quote = c;
      } else if (c === '[' || c === '(') {
        stack.push({ char: c, at: i });
      } else if (c === ']' || c === ')') {
        const open = c === ']' ? '[' : '(';
        if (!stack.length || stack[stack.length - 1].char !== open) {
          return `Unexpected '${c}' at position ${i + 1}`;
        }
        stack.pop();
      }
    }

    if (quote) return `Unterminated ${quote === '"' ? 'double' : 'single'} quote`;
    if (stack.length) {
      const last = stack[stack.length - 1];
      return `Unclosed '${last.char}' at position ${last.at + 1}`;
    }
    return null;
  }

  // Checks that run before the query, because JSONPath-Plus turns some of
  // these into a silent empty result rather than an error.
  function preflight(path) {
    const unbalanced = findUnbalanced(path);
    if (unbalanced) return unbalanced;

    if (/=~/.test(path)) {
      return "'=~' is not supported. Use @.name.match(/pattern/) or /pattern/.test(@.name) instead";
    }
    if (/\[\s*\?\s*\(?\s*@\w+\(\)/.test(path)) {
      return 'Type filters are path steps, not expressions. Use $..*@string() rather than [?(@string())]';
    }
    return null;
  }

  // Turn library errors into something actionable.
  function explainPathError(message) {
    if (/\$ is not defined/.test(message)) {
      return 'Could not resolve $ inside the filter. Reference the document root as $ or @root, e.g. [?(@.price < $.budget)]';
    }
    return message.replace(/^jsonPath:\s*/, '');
  }

  function runQuery(data, path, resultType) {
    return getJSONPath()({
      path,
      json: data,
      resultType,
      wrap: true,
      // Lets filters reference the document root as `$` (`@root` also works)
      sandbox: { $: data },
      // A filter like [?(@.price > 5)] should skip nulls/scalars, not blow up
      ignoreEvalErrors: true
    });
  }

  function extractPath(options) {
    const live = !!(options && options.live);
    hideError();

    function fail(message) {
      setCaption(message, true);
      if (!live) showError(message);
    }

    const input = getInput();
    const pathInput = document.getElementById('jsonpath-input').value.trim();

    if (!getJSONPath()) {
      setCaption('JSONPath library unavailable', true);
      showError(
        'The JSONPath library did not load (offline?).\n' +
        'It is loaded from https://unpkg.com/jsonpath-plus@11.2.1/dist/index-browser-umd.min.cjs\n' +
        'To work offline, save that file into js/ and point the <script> tag in index.html at it.'
      );
      return;
    }

    if (!input.trim()) {
      fail('Input JSON is empty');
      return;
    }

    if (!pathInput) {
      fail('Path is empty');
      return;
    }

    const result = DevTools.parseJsonWithPos(input);
    if (!result.ok) {
      fail(`Parse error: ${result.message}`);
      return;
    }

    const problem = preflight(pathInput);
    if (problem) {
      fail(`Path error: ${problem}`);
      return;
    }

    const resultType = document.getElementById('jsonpath-result-type').value;

    let matches;
    try {
      matches = runQuery(result.value, pathInput, resultType === 'all' ? 'all' : resultType);
    } catch (e) {
      fail(`Path error: ${explainPathError(e.message)}`);
      return;
    }

    // resultType 'all' also carries parent/parentProperty, which bloat the
    // output without adding anything the path and pointer don't already say.
    if (resultType === 'all') {
      matches = matches.map(m => ({ path: m.path, pointer: m.pointer, value: m.value }));
    }

    if (matches.length === 0) {
      setOutput('[]');
      setCaption('No matches', false);
      return;
    }

    const unwrap = document.getElementById('jsonpath-unwrap').checked;
    const payload = unwrap && matches.length === 1 ? matches[0] : matches;
    setOutput(JSON.stringify(payload, null, 2));
    setCaption(`${matches.length} match${matches.length === 1 ? '' : 'es'}`, false);
  }

  function convertKeys() {
    hideError();
    const input = getInput();
    const targetCase = document.getElementById('case-target').value;

    if (!input.trim()) {
      showError('Input is empty');
      return;
    }

    const result = DevTools.parseJsonWithPos(input);
    if (!result.ok) {
      showError(`Parse error: ${result.message}`);
      return;
    }

    const converted = DevTools.convertKeysDeep(result.value, targetCase);
    const formatted = JSON.stringify(converted, null, 2);
    setOutput(formatted);
  }

  function escapeJson() {
    hideError();
    const input = getInput();
    if (!input) {
      showError('Input is empty');
      return;
    }

    const escaped = JSON.stringify(input);
    setOutput(escaped);
  }

  function unescapeJson() {
    hideError();
    const input = getInput();
    if (!input.trim()) {
      showError('Input is empty');
      return;
    }

    try {
      let trimmed = input.trim();
      if (!trimmed.startsWith('"')) {
        trimmed = '"' + trimmed;
      }
      if (!trimmed.endsWith('"')) {
        trimmed = trimmed + '"';
      }

      const unescaped = JSON.parse(trimmed);

      try {
        const reparsed = JSON.parse(unescaped);
        const pretty = JSON.stringify(reparsed, null, 2);
        setOutput(pretty);
      } catch {
        setOutput(unescaped);
      }
    } catch (e) {
      showError(`Unescape error: Invalid JSON string literal`);
    }
  }

  function jsonToCsv() {
    hideError();
    const input = getInput();
    if (!input.trim()) {
      showError('Input is empty');
      return;
    }

    const result = DevTools.parseJsonWithPos(input);
    if (!result.ok) {
      showError(`Parse error: ${result.message}`);
      return;
    }

    if (!Array.isArray(result.value)) {
      showError('JSON must be an array of objects to convert to CSV');
      return;
    }

    const data = result.value;
    if (data.length === 0) {
      setOutput('');
      return;
    }

    const headers = new Set();
    const seenOrder = [];

    for (const row of data) {
      if (row === null || typeof row !== 'object' || Array.isArray(row)) {
        showError('Each array element must be a flat object');
        return;
      }

      for (const key of Object.keys(row)) {
        if (!headers.has(key)) {
          headers.add(key);
          seenOrder.push(key);
        }

        const val = row[key];
        if (val !== null && val !== undefined && (typeof val === 'object' || Array.isArray(val))) {
          showError(`Row field '${key}' contains a nested object/array — CSV export only supports flat values`);
          return;
        }
      }
    }

    const quoteField = (field) => {
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const headerRow = seenOrder.map(h => `"${h}"`).join(',');
    const rows = data.map(row => {
      return seenOrder.map(key => {
        const val = row[key];
        if (val === null || val === undefined) return '';
        return quoteField(val);
      }).join(',');
    });

    const csv = [headerRow, ...rows].join('\n');
    setOutput(csv);
  }

  function csvToJson() {
    hideError();
    const input = getInput();
    if (!input.trim()) {
      showError('Input is empty');
      return;
    }

    try {
      const lines = input.split(/\r?\n/).filter(line => line.trim());
      if (lines.length === 0) {
        setOutput('[]');
        return;
      }

      const parseRow = (line) => {
        const fields = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const c = line[i];

          if (inQuotes) {
            if (c === '"') {
              if (line[i + 1] === '"') {
                current += '"';
                i++;
              } else {
                inQuotes = false;
              }
            } else {
              current += c;
            }
          } else {
            if (c === '"') {
              inQuotes = true;
            } else if (c === ',') {
              fields.push(current);
              current = '';
            } else {
              current += c;
            }
          }
        }

        fields.push(current);
        return fields;
      };

      const headerFields = parseRow(lines[0]);
      const headers = headerFields.map(h => h.trim().replace(/^"|"$/g, ''));

      const coerceValue = (str) => {
        if (str === '') return '';
        const trimmed = str.trim();
        if (trimmed === 'true') return true;
        if (trimmed === 'false') return false;
        const num = Number(trimmed);
        if (!isNaN(num) && trimmed !== '') return num;
        return str;
      };

      const rows = lines.slice(1).map(line => {
        const fields = parseRow(line);
        const obj = {};
        headers.forEach((header, i) => {
          obj[header] = i < fields.length ? coerceValue(fields[i]) : '';
        });
        return obj;
      });

      setOutput(JSON.stringify(rows, null, 2));
    } catch (e) {
      showError(`CSV parse error: ${e.message}`);
    }
  }

  // --- Expand a pane to fill the window -----------------------------------

  let expandedPane = null;

  function setExpandLabels() {
    document.querySelectorAll('[data-expand]').forEach(btn => {
      const pane = document.getElementById(btn.dataset.expand);
      const isOpen = pane === expandedPane;
      btn.textContent = isOpen ? 'Exit' : 'Expand';
      btn.title = isOpen ? 'Back to split view (Esc)' : 'Fill the window (Esc to exit)';
    });
  }

  function collapsePane() {
    if (!expandedPane) return;
    expandedPane.classList.remove('pane-expanded');
    document.body.classList.remove('pane-expanded-open');
    expandedPane = null;
    setExpandLabels();
  }

  function expandPane(pane) {
    if (expandedPane === pane) {
      collapsePane();
      return;
    }
    collapsePane();
    pane.classList.add('pane-expanded');
    document.body.classList.add('pane-expanded-open');
    expandedPane = pane;
    setExpandLabels();
    const textarea = pane.querySelector('textarea');
    if (textarea && !textarea.readOnly) textarea.focus();
  }

  function copyOutput() {
    const output = document.getElementById('transform-output').value;
    DevTools.copyToClipboard(output).then(() => {
      const btn = event.target;
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    });
  }

  return {
    onHide() {
      collapsePane();
    },

    init() {
      document.getElementById('btn-format').addEventListener('click', format);
      document.getElementById('btn-minify').addEventListener('click', minify);
      document.getElementById('btn-sort').addEventListener('click', sortKeys);
      document.getElementById('btn-extract').addEventListener('click', () => extractPath());

      const pathInput = document.getElementById('jsonpath-input');
      const liveExtract = DevTools.debounce(() => {
        if (pathInput.value.trim()) extractPath({ live: true });
      }, 300);
      pathInput.addEventListener('input', liveExtract);
      pathInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          extractPath();
        }
      });
      document.getElementById('jsonpath-result-type').addEventListener('change', () => {
        if (pathInput.value.trim()) extractPath();
      });
      document.getElementById('jsonpath-unwrap').addEventListener('change', () => {
        if (pathInput.value.trim()) extractPath();
      });
      document.getElementById('btn-convert-keys').addEventListener('click', convertKeys);
      document.getElementById('btn-escape').addEventListener('click', escapeJson);
      document.getElementById('btn-unescape').addEventListener('click', unescapeJson);
      document.getElementById('btn-json-to-csv').addEventListener('click', jsonToCsv);
      document.getElementById('btn-csv-to-json').addEventListener('click', csvToJson);
      document.getElementById('btn-copy-output').addEventListener('click', copyOutput);

      document.querySelectorAll('[data-expand]').forEach(btn => {
        btn.addEventListener('click', () => expandPane(document.getElementById(btn.dataset.expand)));
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && expandedPane) {
          e.preventDefault();
          collapsePane();
        }
      });
    }
  };
})();
