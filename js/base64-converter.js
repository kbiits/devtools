DevTools.Base64Converter = (function() {
  function encodeToBase64(input, isUrlSafe) {
    try {
      // Handle UTF-8 encoding
      const utf8Bytes = new TextEncoder().encode(input);
      let binaryString = '';
      for (let i = 0; i < utf8Bytes.length; i++) {
        binaryString += String.fromCharCode(utf8Bytes[i]);
      }
      let encoded = btoa(binaryString);

      // Convert to URL-safe if requested (RFC 4648 Section 5)
      if (isUrlSafe) {
        encoded = encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      }

      return encoded;
    } catch (e) {
      throw new Error(`Encoding error: ${e.message}`);
    }
  }

  function decodeFromBase64(input, isUrlSafe) {
    try {
      const trimmed = input.trim();
      if (!trimmed) return '';

      let toDecode = trimmed;

      if (isUrlSafe) {
        // Convert from URL-safe back to standard Base64
        // Replace URL-safe characters and add padding
        toDecode = trimmed.replace(/-/g, '+').replace(/_/g, '/');
        // Add padding if needed
        const padding = (4 - (toDecode.length % 4)) % 4;
        toDecode += '='.repeat(padding);

        // Validate URL-safe Base64 format
        if (!/^[A-Za-z0-9\-_]*$/.test(trimmed)) {
          throw new Error('Invalid Base64 URL-safe characters');
        }
      } else {
        // Validate standard Base64 format
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(trimmed)) {
          throw new Error('Invalid Base64 characters');
        }
      }

      const binaryString = atob(toDecode);
      const utf8Bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        utf8Bytes[i] = binaryString.charCodeAt(i);
      }
      return new TextDecoder().decode(utf8Bytes);
    } catch (e) {
      if (e.message.includes('Invalid Base64')) {
        throw e;
      }
      throw new Error(`Decoding error: Invalid Base64 format or corrupted data`);
    }
  }

  function showError(msg) {
    const errorBox = document.getElementById('base64-error');
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
  }

  function hideError() {
    const errorBox = document.getElementById('base64-error');
    errorBox.classList.add('hidden');
  }

  function setOutput(text) {
    document.getElementById('base64-output').value = text;
  }

  function getInput() {
    return document.getElementById('base64-input').value;
  }

  function encode() {
    hideError();
    const input = getInput();
    if (!input) {
      showError('Input is empty');
      return;
    }

    try {
      const isUrlSafe = document.getElementById('base64-mode').value === 'url-safe';
      const encoded = encodeToBase64(input, isUrlSafe);
      setOutput(encoded);
    } catch (e) {
      showError(e.message);
    }
  }

  function decode() {
    hideError();
    const input = getInput();
    if (!input.trim()) {
      showError('Input is empty');
      return;
    }

    try {
      const isUrlSafe = document.getElementById('base64-mode').value === 'url-safe';
      const decoded = decodeFromBase64(input, isUrlSafe);
      setOutput(decoded);
    } catch (e) {
      showError(e.message);
    }
  }

  function copyOutput() {
    const output = document.getElementById('base64-output').value;
    if (!output) {
      showError('Nothing to copy');
      return;
    }

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
    init() {
      document.getElementById('btn-encode-base64').addEventListener('click', encode);
      document.getElementById('btn-decode-base64').addEventListener('click', decode);
      document.getElementById('btn-copy-base64-output').addEventListener('click', copyOutput);
    }
  };
})();
