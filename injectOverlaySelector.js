let overlay = null;
let requested = false;
let lastTarget = null;
let currentCallback = null;

function updateOverlay() {
  requested = false;
  let target = lastTarget;
  if (!(target instanceof Element)) {
    target = target && target.parentElement;
    if (!(target instanceof Element)) {
      return;
    }
  }
  const rect = target.getBoundingClientRect();
  overlay.style.top = `${rect.top + window.scrollY}px`;
  overlay.style.left = `${rect.left + window.scrollX}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
}

function onMouseMove(e) {
  lastTarget = e.target;
  if (!requested) {
    requested = true;
    requestAnimationFrame(updateOverlay);
  }
}

function onClick(e) {
  e.preventDefault();
  e.stopPropagation();
  cleanup();
  let target = e.target;
  if (!(target instanceof Element)) {
    target = target && target.parentElement;
  }
  if (typeof currentCallback === 'function') {
    currentCallback(target);
  }
}

function onKeyDown(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    cleanup();
  }
}

function cleanup() {
  document.removeEventListener('mousemove', onMouseMove, true);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('keydown', onKeyDown, true);
  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
  overlay = null;
  currentCallback = null;
  requested = false;
  lastTarget = null;
}

function injectOverlay(callback) {
  cleanup();
  currentCallback = callback;
  overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'absolute',
    background: 'rgba(0, 123, 255, 0.3)',
    pointerEvents: 'none',
    zIndex: '2147483647'
  });
  document.body.appendChild(overlay);
  requested = false;
  lastTarget = null;
  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
}

function removeOverlay() {
  cleanup();
}

window.selectorTool = window.selectorTool || {};
window.selectorTool.injectOverlay = injectOverlay;
window.selectorTool.removeOverlay = removeOverlay;