const defaultPrefs = {
  delimiter: ',',
  includeHeaders: true,
  autoDetect: true,
  fileNamePrefix: 'data',
  promptOnDownload: false
};

function loadOptions() {
  chrome.storage.sync.get(defaultPrefs, prefs => {
    if (chrome.runtime.lastError) {
      console.error('Error loading preferences:', chrome.runtime.lastError);
      return;
    }
    Object.entries(prefs).forEach(([key, value]) => {
      const el = document.getElementById(key);
      if (!el) return;
      if (el.type === 'checkbox') {
        el.checked = Boolean(value);
      } else {
        el.value = value;
      }
    });
  });
}

function validatePrefs(raw) {
  const illegalFilenameChars = /[\\\/:*?"<>|]/;
  const validated = {};

  // Delimiter: single character
  if (typeof raw.delimiter === 'string' && raw.delimiter.length === 1) {
    validated.delimiter = raw.delimiter;
  } else {
    validated.delimiter = defaultPrefs.delimiter;
  }

  // Boolean prefs
  validated.includeHeaders = Boolean(raw.includeHeaders);
  validated.autoDetect = Boolean(raw.autoDetect);
  validated.promptOnDownload = Boolean(raw.promptOnDownload);

  // File name prefix: non-empty, no illegal chars
  const prefix = typeof raw.fileNamePrefix === 'string' ? raw.fileNamePrefix.trim() : '';
  if (prefix.length > 0 && !illegalFilenameChars.test(prefix)) {
    validated.fileNamePrefix = prefix;
  } else {
    validated.fileNamePrefix = defaultPrefs.fileNamePrefix;
  }

  return validated;
}

function saveOptions() {
  const rawPrefs = {};
  Object.keys(defaultPrefs).forEach(key => {
    const el = document.getElementById(key);
    if (!el) return;
    if (el.type === 'checkbox') {
      rawPrefs[key] = el.checked;
    } else {
      rawPrefs[key] = el.value.trim();
    }
  });
  const prefs = validatePrefs(rawPrefs);

  chrome.storage.sync.set(prefs, () => {
    const status = document.getElementById('status');
    if (chrome.runtime.lastError) {
      console.error('Error saving preferences:', chrome.runtime.lastError);
      if (status) {
        status.textContent = 'Error saving options.';
        status.style.color = 'red';
      }
    } else {
      if (status) {
        status.textContent = 'Options saved.';
        status.style.color = '';
        setTimeout(() => { status.textContent = ''; }, 2000);
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadOptions();
  const saveBtn = document.getElementById('save');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveOptions);
  }
});