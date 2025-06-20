document.addEventListener('DOMContentLoaded', () => {
  const autoBtn = document.getElementById('autoBtn');
  const manualBtn = document.getElementById('manualBtn');
  const exportBtn = document.getElementById('exportBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const statusDiv = document.getElementById('status');

  function updateStatus(message, isError = false) {
    if (!statusDiv) return;
    statusDiv.textContent = message;
    statusDiv.classList.toggle('status-error', isError);
  }

  function setButtonsEnabled(enabled) {
    [autoBtn, manualBtn, exportBtn, cancelBtn].forEach(btn => {
      if (btn) btn.disabled = !enabled;
    });
  }

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
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
      await sendMessage({ type: 'START_SCRAPE', mode: 'manual' });
    } catch (err) {
      updateStatus(err.message || 'Error starting manual selection', true);
    } finally {
      setButtonsEnabled(true);
    }
  }

  async function handleExportClick() {
    try {
      setButtonsEnabled(false);
      updateStatus('Exporting CSV...');
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
      await sendMessage({ type: 'CANCEL_SCRAPE' });
      updateStatus('Scrape cancelled.');
    } catch (err) {
      updateStatus(err.message || 'Error cancelling scrape', true);
    } finally {
      setButtonsEnabled(true);
    }
  }

  function handleRuntimeMessage(message) {
    switch (message.type) {
      case 'SCRAPE_PROGRESS':
        updateStatus(`Progress: ${message.progress}%`);
        break;
      case 'SCRAPE_COMPLETE':
        updateStatus('Scrape complete.');
        break;
      case 'SCRAPE_ERROR':
        updateStatus(`Error: ${message.error}`, true);
        break;
    }
  }

  if (autoBtn) autoBtn.addEventListener('click', handleAutoClick);
  if (manualBtn) manualBtn.addEventListener('click', handleManualClick);
  if (exportBtn) exportBtn.addEventListener('click', handleExportClick);
  if (cancelBtn) cancelBtn.addEventListener('click', handleCancelClick);

  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
});
