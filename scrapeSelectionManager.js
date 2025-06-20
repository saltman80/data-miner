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
  chrome.runtime.sendMessage(message, () => {
    if (chrome.runtime.lastError) {
      console.error('chrome.runtime.sendMessage error:', chrome.runtime.lastError);
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

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'PERFORM_SCRAPE') return;
  if (msg.mode === 'auto') {
    processScrape(autoDetectTables);
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
});