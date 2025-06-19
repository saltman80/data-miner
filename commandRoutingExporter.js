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

function dispatchScrapeToContentScript(mode, tabId) {
  function sendMessageToTab(id) {
    chrome.tabs.sendMessage(id, { type: 'PERFORM_SCRAPE', mode: mode });
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

chrome.runtime.onMessage.addListener(function(msg, sender) {
  if (msg && msg.type === 'START_SCRAPE') {
    dispatchScrapeToContentScript(msg.mode);
  } else if (msg && msg.type === 'SCRAPE_RESULT') {
    if (msg.data) {
      try {
        let csvContent;
        if (typeof convertJsonToCsv === 'function') {
          csvContent = convertJsonToCsv(msg.data);
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