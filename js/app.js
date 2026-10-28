document.addEventListener('DOMContentLoaded', () => {
  const navButtons = document.querySelectorAll('[data-tool]');
  const panels = document.querySelectorAll('[data-panel]');

  function showPanel(toolName) {
    panels.forEach(panel => {
      if (panel.dataset.panel === toolName) {
        panel.classList.remove('hidden');

        if (toolName === 'viewer' && DevTools.JSONViewer.onShow) {
          DevTools.JSONViewer.onShow();
        } else if (toolName === 'transform' && DevTools.JSONTransform.onShow) {
          DevTools.JSONTransform.onShow();
        }
      } else {
        if (panel.dataset.panel === 'transform' && DevTools.JSONTransform.onHide) {
          DevTools.JSONTransform.onHide();
        }
        panel.classList.add('hidden');
      }
    });

    navButtons.forEach(btn => {
      if (btn.dataset.tool === toolName) {
        btn.classList.add('bg-blue-600', 'text-white');
        btn.classList.remove('text-gray-700', 'dark:text-gray-300', 'hover:bg-gray-100', 'dark:hover:bg-gray-800');
      } else {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('text-gray-700', 'dark:text-gray-300', 'hover:bg-gray-100', 'dark:hover:bg-gray-800');
      }
    });

    localStorage.setItem('activeTool', toolName);
  }

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      showPanel(btn.dataset.tool);
    });
  });

  const activeTool = localStorage.getItem('activeTool') || 'viewer';
  showPanel(activeTool);

  DevTools.JSONViewer.init();
  DevTools.JSONTransform.init();
  DevTools.PyToJson.init?.();
  DevTools.Base64Converter.init?.();
  DevTools.ImageAnnotator.init?.();
});
