document.addEventListener('DOMContentLoaded', async function() {
  await loadSettings();
  document.getElementById('save').addEventListener('click', saveSettings);
  document.getElementById('addWhitelist').addEventListener('click', addToWhitelist);
  document.getElementById('toggle').addEventListener('change', saveSettings);
});

async function getEncryptionKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get('encryptionKey', function(result) {
      resolve(result.encryptionKey);
    });
  });
}

async function encrypt(text) {
  const keyBase64 = await getEncryptionKey();
  const keyArrayBuffer = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0)).buffer;
  const key = await crypto.subtle.importKey('raw', keyArrayBuffer, 'AES-GCM', false, ['encrypt']);
  
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    data
  );
  const encryptedArray = new Uint8Array(encrypted);
  const result = new Uint8Array(iv.length + encryptedArray.length);
  result.set(iv);
  result.set(encryptedArray, iv.length);
  return btoa(String.fromCharCode.apply(null, result));
}

async function decrypt(encryptedText) {
  const keyBase64 = await getEncryptionKey();
  const keyArrayBuffer = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0)).buffer;
  const key = await crypto.subtle.importKey('raw', keyArrayBuffer, 'AES-GCM', false, ['decrypt']);
  
  const binary = atob(encryptedText);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const iv = bytes.slice(0, 12);
  const data = bytes.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    data
  );
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

async function loadSettings() {
  chrome.storage.local.get(['experimentId', 'variationId', 'whitelist', 'isEnabled'], async function(data) {
    document.getElementById('experimentId').value = data.experimentId ? await decrypt(data.experimentId) : '';
    document.getElementById('variationId').value = data.variationId ? await decrypt(data.variationId) : '';
    document.getElementById('toggle').checked = data.isEnabled !== false;
    updateWhitelistUI(data.whitelist || []);
  });
}

async function saveSettings() {
  const experimentId = await encrypt(document.getElementById('experimentId').value.trim());
  const variationId = await encrypt(document.getElementById('variationId').value.trim());
  const isEnabled = document.getElementById('toggle').checked;

  chrome.storage.local.set({
    experimentId: experimentId,
    variationId: variationId,
    isEnabled: isEnabled
  }, function() {
    showNotification('Settings saved successfully!');
  });
}

function addToWhitelist() {
  const newSite = document.getElementById('whitelist').value.trim();
  if (newSite) {
    const sanitizedSite = newSite; // Temporarily remove DOMPurify sanitization
    chrome.storage.local.get('whitelist', function(data) {
      const whitelist = data.whitelist || [];
      if (!whitelist.includes(sanitizedSite)) {
        whitelist.push(sanitizedSite);
        chrome.storage.local.set({ whitelist: whitelist }, function() {
          document.getElementById('whitelist').value = '';
          updateWhitelistUI(whitelist);
          showNotification('Website added to whitelist!');
        });
      } else {
        showNotification('Website already in whitelist!', 'warning');
      }
    });
  }
}

function updateWhitelistUI(whitelist) {
  const container = document.getElementById('whitelistContainer');
  container.innerHTML = '';
  whitelist.forEach(function(site) {
    const div = document.createElement('div');
    div.innerHTML = `
      <span>${site}</span>
      <button class="remove-site" data-site="${site}">Remove</button>
    `;
    container.appendChild(div);
  });
  
  // Add event listeners to all remove buttons
  addRemoveEventListeners();
}

function removeFromWhitelist(site) {
  chrome.storage.local.get('whitelist', function(data) {
    const whitelist = data.whitelist || [];
    const index = whitelist.indexOf(site);
    if (index > -1) {
      whitelist.splice(index, 1);
      chrome.storage.local.set({ whitelist: whitelist }, function() {
        updateWhitelistUI(whitelist);
        showNotification('Website removed from whitelist!');
      });
    }
  });
}

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type === 'success' ? 'success' : 'warning'}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

function addRemoveEventListeners() {
  const removeButtons = document.querySelectorAll('.remove-site');
  removeButtons.forEach(button => {
    button.addEventListener('click', function() {
      const site = this.getAttribute('data-site');
      removeFromWhitelist(site);
    });
  });
}