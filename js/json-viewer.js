DevTools.JSONViewer = (function() {
  const AUTO_COLLAPSE_DEPTH = 3;
  let collapsedPaths = new Set();
  let lastParsedValue = null;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderNode(value, keyLabel, path, depth) {
    const container = document.createElement('div');

    if (value === null) {
      const line = document.createElement('div');
      line.className = 'text-gray-400 dark:text-gray-500 italic text-sm';
      if (keyLabel) {
        const keySpan = document.createElement('span');
        keySpan.className = 'text-red-700 dark:text-red-400 font-medium mr-1';
        keySpan.textContent = `"${keyLabel}":`;
        line.appendChild(keySpan);
      }
      line.appendChild(document.createTextNode(' null'));
      container.appendChild(line);
      return container;
    }

    if (typeof value === 'boolean') {
      const line = document.createElement('div');
      line.className = 'text-orange-700 dark:text-orange-400 text-sm';
      if (keyLabel) {
        const keySpan = document.createElement('span');
        keySpan.className = 'text-red-700 dark:text-red-400 font-medium mr-1';
        keySpan.textContent = `"${keyLabel}":`;
        line.appendChild(keySpan);
      }
      line.appendChild(document.createTextNode(` ${value}`));
      container.appendChild(line);
      return container;
    }

    if (typeof value === 'number') {
      const line = document.createElement('div');
      line.className = 'text-blue-700 dark:text-blue-400 text-sm font-mono';
      if (keyLabel) {
        const keySpan = document.createElement('span');
        keySpan.className = 'text-red-700 dark:text-red-400 font-medium mr-1';
        keySpan.textContent = `"${keyLabel}":`;
        line.appendChild(keySpan);
      }
      line.appendChild(document.createTextNode(` ${value}`));
      container.appendChild(line);
      return container;
    }

    if (typeof value === 'string') {
      const line = document.createElement('div');
      line.className = 'text-green-700 dark:text-green-400 text-sm font-mono';
      if (keyLabel) {
        const keySpan = document.createElement('span');
        keySpan.className = 'text-red-700 dark:text-red-400 font-medium mr-1';
        keySpan.textContent = `"${keyLabel}":`;
        line.appendChild(keySpan);
      }
      const valueSpan = document.createElement('span');
      valueSpan.textContent = ` "${value}"`;
      line.appendChild(valueSpan);
      container.appendChild(line);
      return container;
    }

    const isArray = Array.isArray(value);
    const isCollapsed = collapsedPaths.has(path);
    const shouldAutoCollapse = depth >= AUTO_COLLAPSE_DEPTH;
    const startCollapsed = isCollapsed || shouldAutoCollapse;

    const headerLine = document.createElement('div');
    headerLine.className = 'flex items-center gap-1 text-sm';

    const caret = document.createElement('button');
    caret.className = 'w-4 h-4 p-0 text-purple-700 dark:text-purple-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded cursor-pointer text-xs flex items-center justify-center';
    caret.textContent = startCollapsed ? '▶' : '▼';
    caret.style.border = 'none';
    caret.style.background = 'transparent';
    caret.style.padding = '0';
    caret.style.lineHeight = '1';

    headerLine.appendChild(caret);

    if (keyLabel) {
      const keySpan = document.createElement('span');
      keySpan.className = 'text-purple-700 dark:text-purple-400 font-medium';
      keySpan.textContent = `"${keyLabel}"`;
      headerLine.appendChild(keySpan);

      const colonSpan = document.createElement('span');
      colonSpan.textContent = ':';
      headerLine.appendChild(colonSpan);
    }

    const typeSpan = document.createElement('span');
    typeSpan.className = 'text-gray-600 dark:text-gray-400 text-xs ml-1';
    if (isArray) {
      typeSpan.textContent = `[${value.length}]`;
    } else {
      typeSpan.textContent = `{${Object.keys(value).length}}`;
    }
    headerLine.appendChild(typeSpan);

    container.appendChild(headerLine);

    let childrenContainer = null;
    let childrenBuilt = false;

    const toggleCollapse = () => {
      if (collapsedPaths.has(path)) {
        collapsedPaths.delete(path);
        caret.textContent = '▼';
        if (!childrenBuilt) {
          buildChildren();
        }
        if (childrenContainer) childrenContainer.classList.remove('hidden');
      } else {
        collapsedPaths.add(path);
        caret.textContent = '▶';
        if (childrenContainer) childrenContainer.classList.add('hidden');
      }
    };

    const buildChildren = () => {
      if (childrenBuilt) return;
      if (!childrenContainer) {
        childrenContainer = document.createElement('div');
        childrenContainer.className = 'pl-4 border-l border-gray-300 dark:border-gray-600 ml-2';
        container.appendChild(childrenContainer);
      }
      childrenContainer.innerHTML = '';

      if (isArray) {
        value.forEach((item, index) => {
          const newPath = `${path}[${index}]`;
          childrenContainer.appendChild(renderNode(item, null, newPath, depth + 1));
        });
      } else {
        Object.entries(value).forEach(([key, val]) => {
          const newPath = `${path}.${key}`;
          childrenContainer.appendChild(renderNode(val, key, newPath, depth + 1));
        });
      }
      childrenBuilt = true;
    };

    caret.addEventListener('click', toggleCollapse);

    if (!startCollapsed) {
      buildChildren();
    } else {
      childrenContainer = document.createElement('div');
      childrenContainer.className = 'pl-4 border-l border-gray-300 dark:border-gray-600 ml-2 hidden';
      container.appendChild(childrenContainer);
    }

    return container;
  }

  function renderFromInput() {
    const input = document.getElementById('viewer-input');
    const treeDiv = document.getElementById('viewer-tree');
    const errorBox = document.getElementById('viewer-error');

    const text = input.value.trim();

    if (!text) {
      treeDiv.innerHTML = '<div class="text-gray-500 dark:text-gray-400 text-sm italic">Enter JSON to see a preview</div>';
      errorBox.classList.add('hidden');
      return;
    }

    const result = DevTools.parseJsonWithPos(text);

    if (!result.ok) {
      let errorMsg = result.message;
      if (result.line !== null && result.column !== null) {
        errorMsg = `Parse error at line ${result.line}, column ${result.column}: ${errorMsg}`;
      } else {
        errorMsg = `Parse error: ${errorMsg}`;
      }
      errorBox.textContent = errorMsg;
      errorBox.classList.remove('hidden');
      return;
    }

    errorBox.classList.add('hidden');
    lastParsedValue = result.value;
    treeDiv.innerHTML = '';
    treeDiv.appendChild(renderNode(result.value, null, '$', 0));
  }

  return {
    init() {
      const input = document.getElementById('viewer-input');
      const debouncedRender = DevTools.debounce(renderFromInput, 300);
      input.addEventListener('input', debouncedRender);
    },

    onShow() {
      const input = document.getElementById('viewer-input');
      if (input.value.trim()) {
        renderFromInput();
      }
    }
  };
})();
