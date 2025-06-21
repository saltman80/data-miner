importScripts('convertJsonToCsv.js');

function notifyUser(message) {
  if (chrome.notifications && chrome.notifications.create) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png', // required field
      title: 'Data Miner',
      message: message
    });
  } else {
    console.log('Notification:', message);
  }
}

function startDownload(csvContent) {
  if (typeof csvContent !== 'string') {
    console.error('Invalid CSV content passed to startDownload:', csvContent);
    notifyUser('Export failed: Invalid CSV content.');
    return;
  }

  try {
    const encodedData = encodeURIComponent(csvContent);
    const dataUrl = `data:text/csv;charset=utf-8,${encodedData}`;

    if (chrome?.downloads?.download) {
      chrome.downloads.download(
        {
          url: dataUrl,
          filename: `export_${Date.now()}.csv`,
          saveAs: true
        },
        function (downloadId) {
          if (chrome.runtime.lastError) {
            console.error('Download failed:', chrome.runtime.lastError);
            notifyUser('Download failed: ' + chrome.runtime.lastError.message);
          } else {
            console.log('Download started, id:', downloadId);
          }
        }
      );
    } else {
      console.error('chrome.downloads API is not available.');
      notifyUser('Download API not available in this context.');
    }
  } catch (error) {
    console.error('Error generating data URL:', error);
    notifyUser('Export failed: Could not prepare CSV.');
  }
}

function dispatchScrapeToContentScript(mode, tabId, cb) {
  function injectAndSend(id, message, attempted) {
    chrome.tabs.sendMessage(id, message, response => {
      if (chrome.runtime.lastError) {
        if (!attempted) {
          // try injecting content scripts then resend once
          chrome.scripting.executeScript(
            {
              target: { tabId: id },
              files: ['injectOverlaySelector.js', 'scrapeSelectionManager.js']
            },
            () => {
              if (chrome.runtime.lastError) {
                console.error('Failed to inject content scripts', chrome.runtime.lastError);
                notifyUser('Failed to inject content scripts. This page may not allow scripts.');
                if (cb) cb({ success: false, error: 'Injection failed' });
              } else {
                injectAndSend(id, message, true);
              }
            }
          );
        } else {
          console.error('Failed to send message to tab', chrome.runtime.lastError);
          notifyUser('Unable to communicate with page. Content script not found.');
          if (cb) cb({ success: false, error: 'Content script not found in tab.' });
        }
      } else {
        console.log('background: sent', message, 'to tab', id);
        if (cb) cb({ success: true, response });
      }
    });
  }

  function sendMessageToTab(id) {
    let message;
    if (mode === 'cancel') {
      message = { type: 'CANCEL_SCRAPE' };
    } else if (mode === 'finalize') {
      message = { type: 'FINALIZE_SELECTION' };
    } else {
      message = { type: 'PERFORM_SCRAPE', mode };
    }
    injectAndSend(id, message, false);
  }
  if (tabId) {
    sendMessageToTab(tabId);
  } else {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs && tabs.length > 0) {
        sendMessageToTab(tabs[0].id);
      } else {
        console.error('No active tab found to perform scrape.');
        notifyUser('No active tab found to perform scrape.');
        if (cb) cb({ success: false, error: 'No active tab.' });
      }
    });
  }
}

function handleContextMenuClick(info, tab) {
  if (info.menuItemId === 'quickExport') {
    dispatchScrapeToContentScript('auto', tab && tab.id);
  }
}

chrome.runtime.onInstalled.addListener(function() {
  chrome.contextMenus.create({
    id: 'quickExport',
    title: 'Export CSV',
    contexts: ['all']
  });
});

chrome.contextMenus.onClicked.addListener(handleContextMenuClick);

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg && msg.type === 'START_SCRAPE') {
    console.log('background: START_SCRAPE received', msg);
    dispatchScrapeToContentScript(msg.mode, undefined, result => {
      sendResponse(result);
    });
    console.log('background: sendResponse \u2192', { ok: true });
    return true;
  } else if (msg && msg.type === 'CANCEL_SCRAPE') {
    console.log('background: CANCEL_SCRAPE received');
    dispatchScrapeToContentScript('cancel', undefined, result => {
      sendResponse(result);
    });
    console.log('background: sendResponse \u2192', { ok: true });
    return true;
  } else if (msg && msg.type === 'EXPORT_CSV') {
    console.log('background: EXPORT_CSV received');
    dispatchScrapeToContentScript('finalize', undefined, result => {
      sendResponse(result);
    });
    console.log('background: sendResponse \u2192', { ok: true });
    return true;
  } else if (msg && msg.type === 'SCRAPE_RESULT') {
    console.log('background: SCRAPE_RESULT received');

    if (!Array.isArray(msg.data) || !msg.data.every(item =>
      typeof item.url === 'string' && typeof item.text === 'string')) {
      console.error('Invalid scrape data format:', msg.data);
      notifyUser('Export failed: Invalid data format.');
      sendResponse({ ok: false });
      console.log('background: sendResponse \u2192', { ok: false });
      return true;
    }

    try {
      const csvContent = convertJsonToCsv(msg.data, { headers: ['url', 'text'] });
      if (typeof csvContent !== 'string' || !csvContent.trim()) {
        notifyUser('Export failed: CSV content is empty.');
        sendResponse({ ok: false });
        console.log('background: sendResponse \u2192', { ok: false });
        return true;
      }
      startDownload(csvContent); // must ONLY be called here
    } catch (error) {
      console.error('Error converting data to CSV:', error);
      notifyUser('Export failed during CSV conversion.');
    }

    chrome.runtime.sendMessage({ type: 'SCRAPE_RESULT' });
    sendResponse({ ok: true });
    console.log('background: sendResponse \u2192', { ok: true });
    return true;
  } else if (
    msg &&
    sender &&
    sender.tab &&
    (msg.type === 'ELEMENT_ADDED' || msg.type === 'SCRAPE_ERROR' || msg.type === 'SCRAPE_CANCELED')
  ) {
    // Forward messages from content script to any extension pages (e.g., popup)
    chrome.runtime.sendMessage(msg);
    sendResponse({ ok: true });
    console.log('background: sendResponse \u2192', { ok: true });
    return true;
  }
});

