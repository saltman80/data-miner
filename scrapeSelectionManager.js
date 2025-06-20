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

function autoDetectTables() {
  const table = document.querySelector('table');
  if (!table) throw new Error('No table found on page');
  return extractTableData(table);
}

function scrapeDOMData(selection) {
  let elem = selection;
  if (Array.isArray(selection) || selection instanceof NodeList) {
    elem = selection[0];
  }
  if (!elem) throw new Error('Invalid selection');
  if (elem.tagName && elem.tagName.toLowerCase() === 'table') {
    return extractTableData(elem);
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
  const rect = el.getBoundingClientRect();
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

function cancelManualSelection() {
  selectorTool.removeOverlay();
  clearHighlights();
  selectedElements = [];
  if (keyListener) {
    document.removeEventListener('keydown', keyListener, true);
    keyListener = null;
  }
  manualSelecting = false;
  safeSendMessage({ type: 'SCRAPE_CANCELED' });
}

function finalizeManualSelection() {
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
  const data = selectedElements.map(el => ({ url, text: el.textContent.trim() }));
  clearHighlights();
  selectedElements = [];
  manualSelecting = false;
  safeSendMessage({ type: 'SCRAPE_RESULT', data });
}

function beginManualSelection() {
  if (manualSelecting) return;
  manualSelecting = true;
  selectedElements = [];
  selectionHighlights = [];

  function onSelect(el) {
    if (el) {
      selectedElements.push(el);
      highlightElement(el);
      safeSendMessage({ type: 'ELEMENT_ADDED', count: selectedElements.length });
      alert(`Element added to export list (#${selectedElements.length}).`);
      selectorTool.injectOverlay(onSelect);
    }
  }

  keyListener = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finalizeManualSelection();
    } else if (e.key === 'Escape') {
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
    processScrape(autoDetectTables);
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