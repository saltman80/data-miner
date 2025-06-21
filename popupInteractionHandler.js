document.addEventListener('DOMContentLoaded', () => {
  const autoBtn = document.getElementById('autoBtn');
  const manualBtn = document.getElementById('manualBtn');
  const exportBtn = document.getElementById('exportBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const statusDiv = document.getElementById('status');
  let manualModeActive = false;

  function updateExportButton() {
    if (!exportBtn) return;
    if (manualModeActive) {
      exportBtn.disabled = true;
      exportBtn.textContent = 'Press Enter to Export';
    } else {
      exportBtn.disabled = false;
      exportBtn.textContent = 'Export to CSV';
    }
  }

  function updateStatus(message, isError = false) {
    if (!statusDiv) return;
    statusDiv.textContent = message;
    statusDiv.classList.toggle('status-error', isError);
  }

  function setButtonsEnabled(enabled) {
    [autoBtn, manualBtn, cancelBtn].forEach(btn => {
      if (btn) btn.disabled = !enabled;
    });
    if (!manualModeActive && exportBtn) {
      exportBtn.disabled = !enabled;
    }
  }

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) {
          const msg = chrome.runtime.lastError.message || '';
          if (msg.includes('Receiving end does not exist')) {
            reject(new Error('No active scrape session. Try reloading the page.'));
          } else {
            reject(chrome.runtime.lastError);
          }
        } else {
          resolve(response);
        }
      });
    });
  }

  async function handleAutoClick() {
    try {
      setButtonsEnabled(false);
      updateStatus('Starting auto scrape...');
      console.log('popup: requesting auto scrape');
      await sendMessage({ type: 'START_SCRAPE', mode: 'auto' });
    } catch (err) {
      updateStatus(err.message || 'Error starting auto scrape', true);
    } finally {
      setButtonsEnabled(true);
    }
  }

  async function handleManualClick() {
    try {
      setButtonsEnabled(false);
      updateStatus('Entering manual selection mode...');
      console.log('popup: requesting manual scrape');
      await sendMessage({ type: 'START_SCRAPE', mode: 'manual' });
      manualModeActive = true;
      updateExportButton();
      updateStatus('Manual mode: select headings then press Enter on the page.');
    } catch (err) {
      updateStatus(err.message || 'Error starting manual selection', true);
    } finally {
      setButtonsEnabled(true);
    }
  }

  async function handleExportClick() {
    if (manualModeActive) {
      updateStatus('Press Enter on the page to export.', true);
      return;
    }
    try {
      setButtonsEnabled(false);
      updateStatus('Exporting CSV...');
      console.log('popup: export requested');
      await sendMessage({ type: 'EXPORT_CSV' });
      updateStatus('Export initiated.');
    } catch (err) {
      updateStatus(err.message || 'Error exporting CSV', true);
    } finally {
      setButtonsEnabled(true);
    }
  }

  async function handleCancelClick() {
    try {
      setButtonsEnabled(false);
      updateStatus('Cancelling scrape...');
      console.log('popup: cancel requested');
      await sendMessage({ type: 'CANCEL_SCRAPE' });
      manualModeActive = false;
      updateExportButton();
      updateStatus('Scrape cancelled.');
    } catch (err) {
      updateStatus(err.message || 'Error cancelling scrape', true);
    } finally {
      setButtonsEnabled(true);
    }
  }

  function handleRuntimeMessage(message) {
    console.log('popup: received runtime message', message);
    switch (message.type) {
      case 'SCRAPE_PROGRESS':
        updateStatus(`Progress: ${message.progress}%`);
        break;
      case 'SCRAPE_COMPLETE':
        updateStatus('Scrape complete.');
        break;
      case 'SCRAPE_ERROR':
        updateStatus(`Error: ${message.error}`, true);
        manualModeActive = false;
        updateExportButton();
        break;
      case 'SCRAPE_CANCELED':
        updateStatus('Scrape cancelled.');
        manualModeActive = false;
        updateExportButton();
        break;
      case 'ELEMENT_ADDED':
        updateStatus(`Added element #${message.count} for export.`);
        break;
    }
  }

  if (autoBtn) autoBtn.addEventListener('click', handleAutoClick);
  if (manualBtn) manualBtn.addEventListener('click', handleManualClick);
  if (exportBtn) exportBtn.addEventListener('click', handleExportClick);
  if (cancelBtn) cancelBtn.addEventListener('click', handleCancelClick);

  chrome.runtime.onMessage.addListener(handleRuntimeMessage);

  updateExportButton();
});
