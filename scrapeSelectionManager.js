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