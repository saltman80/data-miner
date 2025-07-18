const sanitizeData = (input) => {
  if (input == null) return input;
  const type = typeof input;
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeData);
  }
  if (typeof Node !== 'undefined' && input instanceof Node) {
    if (input.tagName && input.tagName.toUpperCase() === 'IMG') {
      return '';
    }
    return input.textContent;
  }
  if (type === 'object') {
    const output = {};
    for (const key in input) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        output[key] = sanitizeData(input[key]);
      }
    }
    return output;
  }
  return String(input);
};

function extractTableData(table) {
  const rows = Array.from(table.querySelectorAll('tr'));
  if (!rows.length) return [];
  const headers = Array.from(rows.shift().cells).map(c => c.textContent.trim() || '');
  return rows.map(row => {
    const obj = {};
    const cells = Array.from(row.cells);
    headers.forEach((h, i) => {
      obj[h || `col${i+1}`] = cells[i] ? cells[i].textContent.trim() : '';
    });
    return obj;
  });
}

function autoDetectHeadings() {
  const url = window.location.href || document.URL;
  const headings = Array.from(document.querySelectorAll('h1, h2'));
  const data = headings.map(h => ({ url, text: h.textContent.trim() }));
  if (!data.length) {
    throw new Error('No H1 or H2 elements found on page');
  }
  return data;
}

function scrapeDOMData(selection) {
  let elem = selection;
  if (Array.isArray(selection) || selection instanceof NodeList) {
    elem = selection[0];
  }
  if (!elem || !(elem instanceof Element)) throw new Error('Invalid selection');
  if (!['H1', 'H2'].includes(elem.tagName)) {
    throw new Error('Only H1 and H2 elements can be scraped');
  }
  return { text: elem.textContent.trim() };
}

const safeSendMessage = (message) => {
  console.log('content: sending', message);
  chrome.runtime.sendMessage(message, () => {
    if (chrome.runtime.lastError) {
      const errMsg = chrome.runtime.lastError && chrome.runtime.lastError.message ?
        chrome.runtime.lastError.message : chrome.runtime.lastError;
      console.error('chrome.runtime.sendMessage error:', errMsg);
    }
  });
};

const processScrape = (scrapeFn) => {
  try {
    const rawData = scrapeFn();
    const data = sanitizeData(rawData);
    safeSendMessage({ type: 'SCRAPE_RESULT', data });
  } catch (error) {
    safeSendMessage({ type: 'SCRAPE_ERROR', error: error.message });
  }
};

let manualSelecting = false;
let selectedElements = [];
let selectionHighlights = [];
let keyListener = null;

function highlightElement(el) {
  if (!(el instanceof Element)) return;
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const div = document.createElement('div');
  Object.assign(div.style, {
    position: 'absolute',
    top: `${rect.top + window.scrollY}px`,
    left: `${rect.left + window.scrollX}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    background: 'rgba(0, 123, 255, 0.3)',
    pointerEvents: 'none',
    zIndex: '2147483646'
  });
  document.body.appendChild(div);
  selectionHighlights.push(div);
}

function clearHighlights() {
  while (selectionHighlights.length) {
    const div = selectionHighlights.pop();
    if (div && div.parentNode) div.parentNode.removeChild(div);
  }
}

let confirmationPopup = null;

function showConfirmationPopup(onAddMore, onExportNow) {
  if (confirmationPopup && confirmationPopup.parentNode) {
    confirmationPopup.parentNode.removeChild(confirmationPopup);
  }
  const popup = document.createElement('div');
  popup.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #fff;
    color: #000;
    padding: 10px;
    z-index: 2147483647;
    border-radius: 8px;
    box-shadow: 0 0 10px rgba(0,0,0,0.3);
  `;
  popup.innerHTML = `
    <div style="margin-bottom: 8px;">Add more elements?</div>
    <button id="addMoreBtn">Yes</button>
    <button id="exportNowBtn">Export</button>
  `;
  document.body.appendChild(popup);

  document.getElementById('addMoreBtn').onclick = () => {
    if (popup.parentNode) popup.parentNode.removeChild(popup);
    confirmationPopup = null;
    if (typeof onAddMore === 'function') onAddMore();
  };

  document.getElementById('exportNowBtn').onclick = () => {
    if (popup.parentNode) popup.parentNode.removeChild(popup);
    confirmationPopup = null;
    if (typeof onExportNow === 'function') onExportNow();
  };

  confirmationPopup = popup;
}

function finalizeMultiSelection() {
  if (confirmationPopup && confirmationPopup.parentNode) {
    confirmationPopup.parentNode.removeChild(confirmationPopup);
    confirmationPopup = null;
  }
  selectorTool.removeOverlay();
  if (keyListener) {
    document.removeEventListener('keydown', keyListener, true);
    keyListener = null;
  }
  const url = window.location.href || document.URL;
  if (!url) {
    clearHighlights();
    manualSelecting = false;
    safeSendMessage({ type: 'SCRAPE_ERROR', error: 'Unable to retrieve page URL.' });
    return;
  }
  if (!selectedElements.length) {
    clearHighlights();
    manualSelecting = false;
    safeSendMessage({ type: 'SCRAPE_ERROR', error: 'No elements selected.' });
    return;
  }
  const data = selectedElements
    .filter(el => el instanceof Element && ['H1', 'H2'].includes(el.tagName))
    .map(el => ({ url, text: el.textContent.trim() }));
  clearHighlights();
  selectedElements = [];
  manualSelecting = false;
  safeSendMessage({ type: 'SCRAPE_RESULT', data });
}

function cancelManualSelection() {
  selectorTool.removeOverlay();
  clearHighlights();
  selectedElements = [];
  if (confirmationPopup && confirmationPopup.parentNode) {
    confirmationPopup.parentNode.removeChild(confirmationPopup);
    confirmationPopup = null;
  }
  if (keyListener) {
    document.removeEventListener('keydown', keyListener, true);
    keyListener = null;
  }
  manualSelecting = false;
  safeSendMessage({ type: 'SCRAPE_CANCELED' });
}

function finalizeManualSelection() {
  finalizeMultiSelection();
}

function beginManualSelection() {
  if (manualSelecting) return;
  manualSelecting = true;
  selectedElements = [];
  selectionHighlights = [];

  function onSelect(el) {
    if (!el || !(el instanceof Element)) return;

    const tag = el.tagName && el.tagName.toLowerCase();
    if (!['h1', 'h2'].includes(tag)) {
      alert('Only H1 or H2 elements allowed');
      return;
    }

    if (selectedElements.includes(el)) {
      alert('You already selected this element.');
      return;
    }

    selectedElements.push(el);
    highlightElement(el);
    safeSendMessage({ type: 'ELEMENT_ADDED', count: selectedElements.length });
    selectorTool.removeOverlay();
    showConfirmationPopup(
      () => selectorTool.injectOverlay(onSelect),
      finalizeMultiSelection
    );
  }

  keyListener = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelManualSelection();
    }
  };
  document.addEventListener('keydown', keyListener, true);
  selectorTool.injectOverlay(onSelect);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CANCEL_SCRAPE') {
    console.log('content: CANCEL_SCRAPE received');
    if (manualSelecting) {
      cancelManualSelection();
    } else {
      selectorTool.removeOverlay();
    }
    sendResponse({ canceled: true });
    return;
  }

  if (msg.type === 'FINALIZE_SELECTION') {
    finalizeManualSelection();
    sendResponse({ finalized: true });
    return;
  }

  if (msg.type !== 'PERFORM_SCRAPE') return;
  console.log('content: PERFORM_SCRAPE received', msg);
  if (msg.mode === 'auto') {
    processScrape(autoDetectHeadings);
  } else if (msg.mode === 'manual') {
    beginManualSelection();
  } else {
    selectorTool.injectOverlay((selection) => {
      selectorTool.removeOverlay();
      if (!selection || selection.length === 0) {
        safeSendMessage({ type: 'SCRAPE_CANCELED' });
        return;
      }
      processScrape(() => scrapeDOMData(selection));
    });
  }
  sendResponse({ started: true });
});