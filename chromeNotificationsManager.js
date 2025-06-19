;(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.chromeNotificationsManager = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  const defaultIconUrl = chrome.runtime.getURL('icons/icon48.png');
  const clickListeners = [];
  const buttonClickListeners = [];
  const validTypes = new Set(['basic', 'image', 'list', 'progress']);

  function generateNotificationId() {
    return `dm-notif-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  function createNotification({
    id,
    title = '',
    message = '',
    iconUrl = defaultIconUrl,
    type = 'basic',
    buttons = []
  } = {}) {
    if (!validTypes.has(type)) {
      return Promise.reject(new Error(`Invalid notification type: "${type}". Valid types are: ${[...validTypes].join(', ')}`));
    }
    if (!Array.isArray(buttons)) {
      return Promise.reject(new Error('Notification buttons must be an array'));
    }
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      if (typeof btn !== 'object' || btn === null) {
        return Promise.reject(new Error(`Button at index ${i} is not an object`));
      }
      if (typeof btn.title !== 'string' || !btn.title) {
        return Promise.reject(new Error(`Button at index ${i} must have a non-empty string title`));
      }
      if (btn.iconUrl !== undefined && typeof btn.iconUrl !== 'string') {
        return Promise.reject(new Error(`Button at index ${i} has invalid iconUrl; must be a string`));
      }
    }

    const notifId = id || generateNotificationId();
    const options = { type, title, message, iconUrl };
    if (buttons.length) {
      options.buttons = buttons.map(btn => ({
        title: btn.title,
        iconUrl: btn.iconUrl || defaultIconUrl
      }));
    }

    return new Promise((resolve, reject) => {
      chrome.notifications.create(notifId, options, createdId => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(createdId);
        }
      });
    });
  }

  function clearNotification(id) {
    return new Promise((resolve, reject) => {
      chrome.notifications.clear(id, wasCleared => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(wasCleared);
        }
      });
    });
  }

  function onNotificationClicked(callback) {
    if (typeof callback !== 'function') {
      throw new Error('onNotificationClicked requires a function callback');
    }
    clickListeners.push(callback);
    return () => {
      const idx = clickListeners.indexOf(callback);
      if (idx !== -1) {
        clickListeners.splice(idx, 1);
      }
    };
  }

  function onNotificationButtonClicked(callback) {
    if (typeof callback !== 'function') {
      throw new Error('onNotificationButtonClicked requires a function callback');
    }
    buttonClickListeners.push(callback);
    return () => {
      const idx = buttonClickListeners.indexOf(callback);
      if (idx !== -1) {
        buttonClickListeners.splice(idx, 1);
      }
    };
  }

  function offNotificationClicked(callback) {
    const idx = clickListeners.indexOf(callback);
    if (idx !== -1) {
      clickListeners.splice(idx, 1);
    }
  }

  function offNotificationButtonClicked(callback) {
    const idx = buttonClickListeners.indexOf(callback);
    if (idx !== -1) {
      buttonClickListeners.splice(idx, 1);
    }
  }

  chrome.notifications.onClicked.addListener(id => {
    for (const listener of [...clickListeners]) {
      try {
        listener(id);
      } catch (e) {
        console.error('Notification click listener error', e);
      }
    }
    clearNotification(id).catch(err => console.error('Failed to clear notification', err));
  });

  chrome.notifications.onButtonClicked.addListener((id, buttonIndex) => {
    for (const listener of [...buttonClickListeners]) {
      try {
        listener(id, buttonIndex);
      } catch (e) {
        console.error('Notification button listener error', e);
      }
    }
    clearNotification(id).catch(err => console.error('Failed to clear notification', err));
  });

  return {
    generateNotificationId,
    createNotification,
    clearNotification,
    onNotificationClicked,
    onNotificationButtonClicked,
    offNotificationClicked,
    offNotificationButtonClicked
  };
}));