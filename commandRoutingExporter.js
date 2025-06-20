function notifyUser(message) {
  if (chrome.notifications && chrome.notifications.create) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Data Miner',
      message: message
    });
  } else {
    console.log('Notification:', message);
  }
}

function startDownload(csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  if (chrome && chrome.downloads && chrome.downloads.download) {
    try {
      chrome.downloads.download({
        url: url,
        filename: `export_${Date.now()}.csv`,
        saveAs: true
      }, function(downloadId) {
        if (chrome.runtime.lastError) {
          console.error('Download failed:', chrome.runtime.lastError);
          notifyUser('Download failed: ' + chrome.runtime.lastError.message);
        } else {
          console.log('Download started, id:', downloadId);
        }
        URL.revokeObjectURL(url);
      });
    } catch (error) {
      console.error('Error initiating download:', error);
      notifyUser('Error initiating download: ' + error.message);
      URL.revokeObjectURL(url);
    }
  } else {
    console.error('chrome.downloads API is not available.');
    notifyUser('Download API not available in this context.');
    URL.revokeObjectURL(url);
  }
}

function dispatchScrapeToContentScript(mode, tabId, cb) {
  function sendMessageToTab(id) {
    let message;
    if (mode === 'cancel') {
      message = { type: 'CANCEL_SCRAPE' };
    } else if (mode === 'finalize') {
      message = { type: 'FINALIZE_SELECTION' };
    } else {
      message = { type: 'PERFORM_SCRAPE', mode };
    }
    chrome.tabs.sendMessage(id, message, response => {
      if (chrome.runtime.lastError) {
        console.error('Failed to send message to tab', chrome.runtime.lastError);
        if (cb) cb({ success: false, error: 'Content script not found in tab.' });
      } else {
        console.log('background: sent', message, 'to tab', id);
        if (cb) cb({ success: true, response });
      }
    });
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
    return true;
  } else if (msg && msg.type === 'CANCEL_SCRAPE') {
    console.log('background: CANCEL_SCRAPE received');
    dispatchScrapeToContentScript('cancel', undefined, result => {
      sendResponse(result);
    });
    return true;
  } else if (msg && msg.type === 'EXPORT_CSV') {
    console.log('background: EXPORT_CSV received');
    dispatchScrapeToContentScript('finalize', undefined, result => {
      sendResponse(result);
    });
    return true;
  } else if (msg && msg.type === 'SCRAPE_RESULT') {
    console.log('background: SCRAPE_RESULT received');
    if (msg.data) {
      try {
        let csvContent;
        if (typeof convertJsonToCsv === 'function') {
          csvContent = convertJsonToCsv(msg.data, { headers: ['url', 'text'] });
        } else {
          csvContent = msg.data;
        }
        startDownload(csvContent);
      } catch (error) {
        console.error('Error converting data to CSV:', error);
        notifyUser('Error converting data to CSV: ' + error.message);
      }
    } else {
      console.error('SCRAPE_RESULT received with no data.');
      notifyUser('No data received for export.');
    }
  }
});

