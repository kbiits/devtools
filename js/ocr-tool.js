DevTools.OcrTool = (function() {
  // Selections smaller than this (in image pixels) are treated as a click, not a region
  const MIN_REGION = 4;
  // Small crops are upscaled before recognition; Tesseract reads text best at ~30px+ line height
  const TARGET_LONG_SIDE = 1600;
  const MAX_UPSCALE = 3;

  let canvas, ctx, wrap, dropzone, output, status;
  let image = null;
  let region = null;     // { x, y, w, h } in image pixels
  let dragStart = null;
  let worker = null;     // Promise<Tesseract.Worker>
  let workerLang = null;
  let jobId = 0;
  let busy = 0;

  function showError(msg) {
    const box = document.getElementById('ocr-error');
    box.textContent = msg;
    box.classList.remove('hidden');
  }

  function hideError() {
    document.getElementById('ocr-error').classList.add('hidden');
  }

  function setStatus(text) {
    status.textContent = text;
  }

  // --- rendering ---------------------------------------------------------

  function render() {
    if (!image) return;
    // Same white backdrop the OCR crop uses, so transparent images look like what gets recognized
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    if (!region) return;

    // Dim everything outside the selection
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.rect(region.x, region.y, region.w, region.h);
    ctx.fill('evenodd');

    const k = scale();
    ctx.lineWidth = Math.max(1, 2 * k);
    ctx.setLineDash([6 * k, 4 * k]);
    ctx.strokeStyle = '#3b82f6';
    ctx.strokeRect(region.x, region.y, region.w, region.h);
    ctx.restore();
  }

  function updateInfo() {
    const info = document.getElementById('ocr-info');
    if (!image) { info.textContent = ''; return; }
    let text = `${image.naturalWidth} x ${image.naturalHeight} px`;
    if (region) text += ` · selection ${Math.round(region.w)} x ${Math.round(region.h)} at ${Math.round(region.x)}, ${Math.round(region.y)}`;
    info.textContent = text;
  }

  // --- image loading -----------------------------------------------------

  function loadImageSrc(src) {
    const img = new Image();
    img.onload = () => {
      image = img;
      region = null;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      hideError();
      wrap.classList.remove('hidden');
      dropzone.classList.add('hidden');
      render();
      updateInfo();
      setStatus('Drag on the image to select a region, or use "OCR whole image"');
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

  function reset() {
    image = null;
    region = null;
    hideError();
    wrap.classList.add('hidden');
    dropzone.classList.remove('hidden');
    updateInfo();
    setStatus('');
  }

  // --- region selection --------------------------------------------------

  function scale() {
    const rect = canvas.getBoundingClientRect();
    return rect.width ? canvas.width / rect.width : 1;
  }

  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const k = scale();
    const x = (e.clientX - rect.left) * k;
    const y = (e.clientY - rect.top) * k;
    return {
      x: Math.min(Math.max(x, 0), canvas.width),
      y: Math.min(Math.max(y, 0), canvas.height)
    };
  }

  function onPointerDown(e) {
    if (!image || e.button !== 0) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
    dragStart = canvasPoint(e);
    region = { x: dragStart.x, y: dragStart.y, w: 0, h: 0 };
    render();
  }

  function onPointerMove(e) {
    if (!dragStart) return;
    const p = canvasPoint(e);
    region = {
      x: Math.min(dragStart.x, p.x),
      y: Math.min(dragStart.y, p.y),
      w: Math.abs(p.x - dragStart.x),
      h: Math.abs(p.y - dragStart.y)
    };
    render();
    updateInfo();
  }

  function onPointerUp() {
    if (!dragStart) return;
    dragStart = null;
    if (region.w < MIN_REGION || region.h < MIN_REGION) {
      region = null;
      render();
      updateInfo();
      return;
    }
    render();
    updateInfo();
    if (document.getElementById('ocr-auto').checked) recognize(region);
  }

  function clearRegion() {
    region = null;
    render();
    updateInfo();
  }

  // --- recognition -------------------------------------------------------

  function getWorker(lang) {
    if (typeof Tesseract === 'undefined') {
      return Promise.reject(new Error('The OCR engine (Tesseract.js) failed to load from the CDN. Check your connection and reload.'));
    }
    if (!worker) {
      workerLang = lang;
      worker = Tesseract.createWorker(lang, 1, { logger: onProgress });
    } else if (workerLang !== lang) {
      workerLang = lang;
      worker = worker.then(w => w.reinitialize(lang).then(() => w));
    }
    // Drop a failed worker so the next attempt starts fresh
    return worker.catch(err => {
      worker = null;
      workerLang = null;
      throw err;
    });
  }

  function onProgress(m) {
    if (!busy || !m.status) return;
    const pct = typeof m.progress === 'number' ? ` ${Math.round(m.progress * 100)}%` : '';
    setStatus(`${m.status[0].toUpperCase()}${m.status.slice(1)}${pct}`);
  }

  // Crop from the original image (not the canvas, which has the selection overlay drawn on it)
  function cropCanvas(r) {
    const k = Math.min(MAX_UPSCALE, Math.max(1, TARGET_LONG_SIDE / Math.max(r.w, r.h)));
    const c = document.createElement('canvas');
    c.width = Math.round(r.w * k);
    c.height = Math.round(r.h * k);
    const cctx = c.getContext('2d');
    // White backdrop so dark text on a transparent PNG doesn't become black-on-black
    cctx.fillStyle = '#ffffff';
    cctx.fillRect(0, 0, c.width, c.height);
    cctx.imageSmoothingQuality = 'high';
    cctx.drawImage(image, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
    return c;
  }

  function setBusy(delta) {
    busy += delta;
    ['btn-ocr-full', 'btn-ocr-region'].forEach(id => {
      document.getElementById(id).disabled = busy > 0;
    });
  }

  function recognize(r) {
    if (!image) return showError('Load an image first');
    hideError();

    const id = ++jobId;
    const lang = document.getElementById('ocr-lang').value;
    const source = cropCanvas(r);
    const started = performance.now();

    setBusy(1);
    setStatus(worker && workerLang === lang ? 'Recognizing...' : 'Loading OCR engine and language data (first run only)...');

    getWorker(lang)
      .then(w => w.recognize(source))
      .then(({ data }) => {
        if (id !== jobId) return; // a newer request superseded this one
        const text = data.text.replace(/\s+$/, '');
        const append = document.getElementById('ocr-append').checked && output.value.trim();
        output.value = append ? `${output.value.replace(/\s+$/, '')}\n\n${text}` : text;

        const secs = ((performance.now() - started) / 1000).toFixed(1);
        setStatus(text
          ? `Done in ${secs}s · confidence ${Math.round(data.confidence)}%`
          : `No text found (${secs}s). Try a tighter selection or another language.`);
      })
      .catch(err => {
        if (id !== jobId) return;
        setStatus('');
        showError(`OCR failed: ${err && err.message ? err.message : err}`);
      })
      .finally(() => setBusy(-1));
  }

  function recognizeFull() {
    if (!image) return showError('Load an image first');
    recognize({ x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight });
  }

  function recognizeRegion() {
    if (!image) return showError('Load an image first');
    if (!region) return showError('Drag on the image to select a region first');
    recognize(region);
  }

  function copyText(btn) {
    if (!output.value) return;
    DevTools.copyToClipboard(output.value)
      .then(() => {
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = original; }, 1500);
      })
      .catch(() => showError('Copy failed — select the text and copy it manually'));
  }

  function isVisible() {
    const panel = document.querySelector('[data-panel="ocr"]');
    return panel && !panel.classList.contains('hidden');
  }

  return {
    init() {
      canvas = document.getElementById('ocr-canvas');
      if (!canvas) return;
      ctx = canvas.getContext('2d');
      wrap = document.getElementById('ocr-canvas-wrap');
      dropzone = document.getElementById('ocr-dropzone');
      output = document.getElementById('ocr-output');
      status = document.getElementById('ocr-status');

      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointercancel', onPointerUp);

      document.getElementById('ocr-file').addEventListener('change', e => {
        loadFile(e.target.files[0]);
        e.target.value = '';
      });

      document.getElementById('btn-ocr-full').addEventListener('click', recognizeFull);
      document.getElementById('btn-ocr-region').addEventListener('click', recognizeRegion);
      document.getElementById('btn-ocr-clear-region').addEventListener('click', clearRegion);
      document.getElementById('btn-ocr-reset').addEventListener('click', reset);
      document.getElementById('btn-ocr-copy').addEventListener('click', e => copyText(e.currentTarget));
      document.getElementById('btn-ocr-clear-text').addEventListener('click', () => { output.value = ''; });

      const stage = document.getElementById('ocr-stage');
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

      // Paste an image while the panel is open; plain-text pastes (e.g. into the results box) pass through
      document.addEventListener('paste', e => {
        if (!isVisible()) return;
        const item = Array.from(e.clipboardData?.items || [])
          .find(i => i.type.startsWith('image/'));
        if (!item) return;
        e.preventDefault();
        loadFile(item.getAsFile());
      });

      document.addEventListener('keydown', e => {
        if (!isVisible() || e.key !== 'Escape' || document.activeElement === output) return;
        if (region) clearRegion();
      });
    }
  };
})();
