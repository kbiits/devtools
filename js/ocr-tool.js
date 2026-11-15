DevTools.OcrTool = (function() {
  // Selections smaller than this (in image pixels) are treated as a click, not a region
  const MIN_REGION = 4;
  // Small crops are upscaled before recognition; Tesseract reads text best at ~30px+ line height
  const TARGET_LONG_SIDE = 1600;
  const MAX_UPSCALE = 3;
  // White margin around the crop; text detectors miss lines that touch the image edge
  const CROP_PADDING = 24;

  // jsDelivr's +esm build is generated on request, so it can't carry an SRI hash; the version is pinned
  const PADDLE_URL = 'https://cdn.jsdelivr.net/npm/@paddleocr/paddleocr-js@0.4.2/+esm';
  // Must match the onnxruntime-web version that the +esm build above imports. Importing the same URL
  // gives us the same module instance, so we can configure it before PaddleOCR creates its sessions
  const ORT_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/+esm';
  const ORT_WASM_PATH = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/';
  const PADDLE_MODELS = {
    'v6-small': { textDetectionModelName: 'PP-OCRv6_small_det', textRecognitionModelName: 'PP-OCRv6_small_rec', size: '~30 MB' },
    'v6-tiny': { textDetectionModelName: 'PP-OCRv6_tiny_det', textRecognitionModelName: 'PP-OCRv6_tiny_rec', size: '~6 MB' }
  };
  const ENGINE_KEY = 'ocrEngine';

  let canvas, ctx, wrap, dropzone, output, status, engineSelect;
  let image = null;
  let region = null;     // { x, y, w, h } in image pixels
  let dragStart = null;
  let worker = null;     // Promise<Tesseract.Worker>
  let workerLang = null;
  let paddleModule = null; // Promise<module>
  let paddle = null;     // Promise<PaddleOCR instance>
  let paddleModel = null;
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

  function getPaddle(model) {
    if (!paddleModule) {
      paddleModule = import(ORT_URL)
        .then(ort => {
          // The PaddleOCR models trigger dozens of harmless graph-cleanup warnings per load
          ort.env.logLevel = 'error';
          return import(PADDLE_URL);
        })
        .catch(() => {
          paddleModule = null;
          throw new Error('The PaddleOCR engine failed to load from the CDN. Check your connection and reload, or switch the engine to Tesseract.');
        });
    }
    if (!paddle || paddleModel !== model) {
      if (paddle) paddle.then(old => old.dispose()).catch(() => {});
      paddleModel = model;
      const { textDetectionModelName, textRecognitionModelName } = PADDLE_MODELS[model];
      paddle = paddleModule.then(m => m.PaddleOCR.create({
        textDetectionModelName,
        textRecognitionModelName,
        ortOptions: { backend: 'wasm', wasmPaths: ORT_WASM_PATH }
      }));
    }
    const pending = paddle;
    return pending.catch(err => {
      if (paddle === pending) {
        paddle = null;
        paddleModel = null;
      }
      throw err;
    });
  }

  // Paddle returns one item per detected text box; rebuild reading order by grouping boxes into rows
  function joinPaddleLines(items) {
    const boxes = items
      .filter(it => it.text && it.text.trim())
      .map(it => {
        const ys = it.poly.map(p => p[1]);
        const top = Math.min(...ys);
        const bottom = Math.max(...ys);
        return { text: it.text.trim(), left: Math.min(...it.poly.map(p => p[0])), cy: (top + bottom) / 2, h: bottom - top };
      })
      .sort((a, b) => a.cy - b.cy);

    const rows = [];
    boxes.forEach(b => {
      const row = rows[rows.length - 1];
      if (row && Math.abs(b.cy - row.cy) < Math.min(b.h, row.h) / 2) {
        row.boxes.push(b);
      } else {
        rows.push({ cy: b.cy, h: b.h, boxes: [b] });
      }
    });
    return rows.map(r => r.boxes.sort((a, b) => a.left - b.left).map(b => b.text).join(' ')).join('\n');
  }

  // Paddle inference runs on the main thread, so let the status text paint before it blocks
  function nextPaint() {
    return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  }

  function runPaddle(source, model, id) {
    return getPaddle(model)
      .then(ocr => {
        if (id === jobId) setStatus('Recognizing...');
        return nextPaint().then(() => ocr.predict(source));
      })
      .then(([result]) => {
        const items = result.items || [];
        const score = items.length ? items.reduce((sum, it) => sum + it.score, 0) / items.length : 0;
        return { text: joinPaddleLines(items), confidence: score * 100 };
      });
  }

  function runTesseract(source, lang) {
    return getWorker(lang)
      .then(w => w.recognize(source))
      .then(({ data }) => ({ text: data.text, confidence: data.confidence }));
  }

  function onProgress(m) {
    if (!busy || !m.status) return;
    const pct = typeof m.progress === 'number' ? ` ${Math.round(m.progress * 100)}%` : '';
    setStatus(`${m.status[0].toUpperCase()}${m.status.slice(1)}${pct}`);
  }

  // Crop from the original image (not the canvas, which has the selection overlay drawn on it)
  function cropCanvas(r) {
    const k = Math.min(MAX_UPSCALE, Math.max(1, TARGET_LONG_SIDE / Math.max(r.w, r.h)));
    const w = Math.round(r.w * k);
    const h = Math.round(r.h * k);
    const c = document.createElement('canvas');
    c.width = w + CROP_PADDING * 2;
    c.height = h + CROP_PADDING * 2;
    const cctx = c.getContext('2d');
    // White backdrop so dark text on a transparent PNG doesn't become black-on-black
    cctx.fillStyle = '#ffffff';
    cctx.fillRect(0, 0, c.width, c.height);
    cctx.imageSmoothingQuality = 'high';
    cctx.drawImage(image, r.x, r.y, r.w, r.h, CROP_PADDING, CROP_PADDING, w, h);
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
    const engine = engineSelect.value;
    const lang = document.getElementById('ocr-lang').value;
    const model = document.getElementById('ocr-paddle-model').value;
    const source = cropCanvas(r);
    const started = performance.now();

    setBusy(1);
    if (engine === 'paddle') {
      setStatus(paddle && paddleModel === model
        ? 'Recognizing...'
        : `Loading PaddleOCR and its model (${PADDLE_MODELS[model].size}, first run only)...`);
    } else {
      setStatus(worker && workerLang === lang ? 'Recognizing...' : 'Loading Tesseract and language data (first run only)...');
    }

    (engine === 'paddle' ? runPaddle(source, model, id) : runTesseract(source, lang))
      .then(result => {
        if (id !== jobId) return; // a newer request superseded this one
        const text = result.text.replace(/\s+$/, '');
        const append = document.getElementById('ocr-append').checked && output.value.trim();
        output.value = append ? `${output.value.replace(/\s+$/, '')}\n\n${text}` : text;

        const secs = ((performance.now() - started) / 1000).toFixed(1);
        setStatus(text
          ? `Done in ${secs}s · confidence ${Math.round(result.confidence)}%`
          : `No text found (${secs}s). Try a tighter selection, or another engine or language.`);
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

  function setEngine(engine) {
    engineSelect.value = engine;
    document.querySelectorAll('[data-ocr-engine-opts]').forEach(el => {
      el.classList.toggle('hidden', el.dataset.ocrEngineOpts !== engine);
    });
    try { localStorage.setItem(ENGINE_KEY, engine); } catch (err) { /* storage unavailable */ }
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
      engineSelect = document.getElementById('ocr-engine');

      let savedEngine = null;
      try { savedEngine = localStorage.getItem(ENGINE_KEY); } catch (err) { /* storage unavailable */ }
      setEngine(savedEngine === 'tesseract' ? 'tesseract' : 'paddle');
      engineSelect.addEventListener('change', () => setEngine(engineSelect.value));

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
