DevTools.ImageAnnotator = (function() {
  const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

  const state = {
    tool: 'rect',
    color: '#ef4444',
    lineWidth: 4,
    fontSize: 28
  };

  let canvas, ctx, wrap, dropzone, textInput;
  let image = null;
  let shapes = [];
  let preview = null;
  let drawing = false;
  let start = null;
  let textAnchor = null;

  function showError(msg) {
    const box = document.getElementById('annotate-error');
    box.textContent = msg;
    box.classList.remove('hidden');
  }

  function hideError() {
    document.getElementById('annotate-error').classList.add('hidden');
  }

  // --- rendering ---------------------------------------------------------

  function render() {
    if (!image) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    shapes.forEach(drawShape);
    if (preview) drawShape(preview);
  }

  function drawShape(s) {
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (s.type === 'rect') {
      ctx.strokeRect(s.x, s.y, s.w, s.h);
    } else if (s.type === 'arrow') {
      drawArrow(s);
    } else if (s.type === 'pen') {
      drawPen(s);
    } else if (s.type === 'text') {
      drawText(s);
    }

    ctx.restore();
  }

  function drawArrow(s) {
    const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
    const head = Math.max(14, s.lineWidth * 4);

    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(s.x2, s.y2);
    ctx.lineTo(s.x2 - head * Math.cos(angle - Math.PI / 7), s.y2 - head * Math.sin(angle - Math.PI / 7));
    ctx.lineTo(s.x2 - head * Math.cos(angle + Math.PI / 7), s.y2 - head * Math.sin(angle + Math.PI / 7));
    ctx.closePath();
    ctx.fill();
  }

  function drawPen(s) {
    if (s.points.length === 1) {
      ctx.beginPath();
      ctx.arc(s.points[0].x, s.points[0].y, s.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (let i = 1; i < s.points.length; i++) {
      ctx.lineTo(s.points[i].x, s.points[i].y);
    }
    ctx.stroke();
  }

  function drawText(s) {
    ctx.font = `bold ${s.fontSize}px ${FONT_STACK}`;
    ctx.textBaseline = 'top';
    // White halo keeps the text readable over busy screenshots
    ctx.lineWidth = Math.max(3, s.fontSize / 7);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeText(s.text, s.x, s.y);
    ctx.fillStyle = s.color;
    ctx.fillText(s.text, s.x, s.y);
  }

  // --- image loading -----------------------------------------------------

  function loadImageSrc(src) {
    const img = new Image();
    img.onload = () => {
      image = img;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      shapes = [];
      preview = null;
      hideTextInput();
      hideError();
      wrap.classList.remove('hidden');
      dropzone.classList.add('hidden');
      render();
      updateInfo();
    };
    img.onerror = () => showError('Could not load that image');
    img.src = src;
  }

  function loadFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showError('Not an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => loadImageSrc(reader.result);
    reader.onerror = () => showError('Could not read that file');
    reader.readAsDataURL(file);
  }

  function updateInfo() {
    const info = document.getElementById('annotate-info');
    info.textContent = image ? `${image.naturalWidth} x ${image.naturalHeight} px` : '';
  }

  // --- coordinates -------------------------------------------------------

  function scale() {
    const rect = canvas.getBoundingClientRect();
    return rect.width ? canvas.width / rect.width : 1;
  }

  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const k = scale();
    return { x: (e.clientX - rect.left) * k, y: (e.clientY - rect.top) * k };
  }

  // --- drawing interaction -----------------------------------------------

  function onPointerDown(e) {
    if (!image) return;

    if (state.tool === 'text') {
      // Stop the click's default focus change, which would blur (and commit/hide) the new input
      e.preventDefault();
      // Finish any open label before starting the next one
      if (!textInput.classList.contains('hidden')) commitText();
      showTextInput(e);
      return;
    }

    hideTextInput();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
    drawing = true;
    start = canvasPoint(e);

    if (state.tool === 'pen') {
      preview = { type: 'pen', points: [start], color: state.color, lineWidth: state.lineWidth };
    } else if (state.tool === 'rect') {
      preview = { type: 'rect', x: start.x, y: start.y, w: 0, h: 0, color: state.color, lineWidth: state.lineWidth };
    } else {
      preview = { type: 'arrow', x1: start.x, y1: start.y, x2: start.x, y2: start.y, color: state.color, lineWidth: state.lineWidth };
    }
    render();
  }

  function onPointerMove(e) {
    if (!drawing) return;
    const p = canvasPoint(e);

    if (preview.type === 'pen') {
      preview.points.push(p);
    } else if (preview.type === 'rect') {
      preview.x = Math.min(start.x, p.x);
      preview.y = Math.min(start.y, p.y);
      preview.w = Math.abs(p.x - start.x);
      preview.h = Math.abs(p.y - start.y);
    } else {
      preview.x2 = p.x;
      preview.y2 = p.y;
    }
    render();
  }

  function onPointerUp() {
    if (!drawing) return;
    drawing = false;

    const s = preview;
    preview = null;

    const tooSmall =
      (s.type === 'rect' && s.w < 3 && s.h < 3) ||
      (s.type === 'arrow' && Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < 5);

    if (!tooSmall) shapes.push(s);
    render();
  }

  // --- text input overlay ------------------------------------------------

  function showTextInput(e) {
    const rect = canvas.getBoundingClientRect();
    textAnchor = canvasPoint(e);

    textInput.value = '';
    textInput.style.left = `${e.clientX - rect.left}px`;
    textInput.style.top = `${e.clientY - rect.top}px`;
    textInput.style.fontSize = `${Math.max(11, state.fontSize / scale())}px`;
    textInput.style.color = state.color;
    textInput.classList.remove('hidden');
    // Focus after the pointer/mouse events finish so the browser can't move focus back to the page
    setTimeout(() => textInput.focus(), 0);
  }

  function hideTextInput() {
    textInput.classList.add('hidden');
    textAnchor = null;
  }

  function commitText() {
    const text = textInput.value.trim();
    if (text && textAnchor) {
      shapes.push({
        type: 'text',
        text,
        x: textAnchor.x,
        y: textAnchor.y,
        color: state.color,
        lineWidth: state.lineWidth,
        fontSize: state.fontSize
      });
    }
    hideTextInput();
    render();
  }

  // --- actions -----------------------------------------------------------

  function undo() {
    if (!shapes.length) return;
    shapes.pop();
    render();
  }

  function clearShapes() {
    shapes = [];
    hideTextInput();
    render();
  }

  function reset() {
    image = null;
    shapes = [];
    preview = null;
    hideTextInput();
    hideError();
    wrap.classList.add('hidden');
    dropzone.classList.remove('hidden');
    updateInfo();
  }

  function flash(btn, label) {
    const original = btn.textContent;
    btn.textContent = label;
    setTimeout(() => { btn.textContent = original; }, 1500);
  }

  function download() {
    if (!image) return showError('Load an image first');
    const link = document.createElement('a');
    link.download = `annotated-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function copyImage(btn) {
    if (!image) return showError('Load an image first');
    if (!navigator.clipboard || !window.ClipboardItem) {
      showError('Clipboard image copy is not available in this browser — use Download instead');
      return;
    }
    canvas.toBlob(blob => {
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        .then(() => flash(btn, 'Copied!'))
        .catch(() => showError('Copy failed (needs a secure context) — use Download instead'));
    }, 'image/png');
  }

  function setTool(tool) {
    state.tool = tool;
    if (tool !== 'text') hideTextInput();
    document.querySelectorAll('[data-annotate-tool]').forEach(btn => {
      const active = btn.dataset.annotateTool === tool;
      btn.classList.toggle('bg-blue-600', active);
      btn.classList.toggle('text-white', active);
      btn.classList.toggle('bg-gray-200', !active);
      btn.classList.toggle('dark:bg-gray-700', !active);
    });
    canvas.style.cursor = tool === 'text' ? 'text' : 'crosshair';
  }

  function setColor(color) {
    state.color = color;
    document.getElementById('annotate-color').value = color;
    document.querySelectorAll('[data-annotate-color]').forEach(sw => {
      sw.classList.toggle('ring-2', sw.dataset.annotateColor === color);
    });
  }

  function isVisible() {
    const panel = document.querySelector('[data-panel="annotate"]');
    return panel && !panel.classList.contains('hidden');
  }

  return {
    init() {
      canvas = document.getElementById('annotate-canvas');
      if (!canvas) return;
      ctx = canvas.getContext('2d');
      wrap = document.getElementById('annotate-canvas-wrap');
      dropzone = document.getElementById('annotate-dropzone');
      textInput = document.getElementById('annotate-text-input');

      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointercancel', onPointerUp);

      textInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); commitText(); }
        else if (e.key === 'Escape') { e.preventDefault(); hideTextInput(); }
      });
      textInput.addEventListener('blur', commitText);

      document.querySelectorAll('[data-annotate-tool]').forEach(btn => {
        btn.addEventListener('click', () => setTool(btn.dataset.annotateTool));
      });

      document.querySelectorAll('[data-annotate-color]').forEach(sw => {
        sw.addEventListener('click', () => setColor(sw.dataset.annotateColor));
      });

      document.getElementById('annotate-color').addEventListener('input', e => setColor(e.target.value));

      document.getElementById('annotate-width').addEventListener('change', e => {
        state.lineWidth = parseInt(e.target.value, 10);
      });

      document.getElementById('annotate-font-size').addEventListener('change', e => {
        state.fontSize = parseInt(e.target.value, 10);
      });

      document.getElementById('annotate-file').addEventListener('change', e => {
        loadFile(e.target.files[0]);
        e.target.value = '';
      });

      document.getElementById('btn-annotate-undo').addEventListener('click', undo);
      document.getElementById('btn-annotate-clear').addEventListener('click', clearShapes);
      document.getElementById('btn-annotate-reset').addEventListener('click', reset);
      document.getElementById('btn-annotate-download').addEventListener('click', download);
      document.getElementById('btn-annotate-copy').addEventListener('click', e => copyImage(e.currentTarget));

      // Drag and drop anywhere on the stage
      const stage = document.getElementById('annotate-stage');
      ['dragenter', 'dragover'].forEach(type => {
        stage.addEventListener(type, e => {
          e.preventDefault();
          dropzone.classList.add('border-blue-500');
        });
      });
      ['dragleave', 'drop'].forEach(type => {
        stage.addEventListener(type, () => dropzone.classList.remove('border-blue-500'));
      });
      stage.addEventListener('drop', e => {
        e.preventDefault();
        loadFile(e.dataTransfer.files[0]);
      });

      // Paste an image from the clipboard while the panel is open
      document.addEventListener('paste', e => {
        if (!isVisible()) return;
        const item = Array.from(e.clipboardData?.items || [])
          .find(i => i.type.startsWith('image/'));
        if (!item) return;
        e.preventDefault();
        loadFile(item.getAsFile());
      });

      document.addEventListener('keydown', e => {
        if (!isVisible() || document.activeElement === textInput) return;
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          undo();
        }
      });

      setTool(state.tool);
      setColor(state.color);
    }
  };
})();
