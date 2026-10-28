window.DevTools = window.DevTools || {};

DevTools.parseJsonWithPos = function(text) {
  try {
    const value = JSON.parse(text);
    return { ok: true, value };
  } catch (e) {
    const match = e.message.match(/position (\d+)/);
    let line = null, column = null, message = e.message;

    if (match) {
      const offset = parseInt(match[1], 10);
      const result = DevTools.offsetToLineCol(text, offset);
      line = result.line;
      column = result.column;
      message = e.message.replace(/position \d+/, '');
    }

    return { ok: false, message, line, column };
  }
};

DevTools.offsetToLineCol = function(text, offset) {
  let line = 1, column = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
};

DevTools.debounce = function(fn, ms) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
};

DevTools.sortKeysDeep = function(value) {
  if (Array.isArray(value)) {
    return value.map(v => DevTools.sortKeysDeep(v));
  }
  if (value !== null && typeof value === 'object') {
    const sorted = {};
    Object.keys(value).sort().forEach(key => {
      sorted[key] = DevTools.sortKeysDeep(value[key]);
    });
    return sorted;
  }
  return value;
};

DevTools.splitIntoWords = function(key) {
  if (!key) return [];

  let str = key.replace(/[_\-]+/g, ' ');
  str = str.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  str = str.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');

  return str.trim().split(/\s+/).map(w => w.toLowerCase()).filter(w => w.length > 0);
};

DevTools.joinWords = function(words, targetCase) {
  if (words.length === 0) return '';

  switch (targetCase) {
    case 'camelCase':
      return words[0] + words.slice(1).map(w => w[0].toUpperCase() + w.slice(1)).join('');
    case 'PascalCase':
      return words.map(w => w[0].toUpperCase() + w.slice(1)).join('');
    case 'snake_case':
      return words.join('_');
    case 'kebab-case':
      return words.join('-');
    default:
      return words.join('');
  }
};

DevTools.convertKeysDeep = function(value, targetCase) {
  if (Array.isArray(value)) {
    return value.map(v => DevTools.convertKeysDeep(v, targetCase));
  }
  if (value !== null && typeof value === 'object') {
    const converted = {};
    Object.keys(value).forEach(key => {
      const words = DevTools.splitIntoWords(key);
      const newKey = DevTools.joinWords(words, targetCase);
      converted[newKey] = DevTools.convertKeysDeep(value[key], targetCase);
    });
    return converted;
  }
  return value;
};

DevTools.copyToClipboard = function(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for older browsers
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  return Promise.resolve();
};
