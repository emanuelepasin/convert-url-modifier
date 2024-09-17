let lastUrl = location.href;

async function getEncryptionKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get('encryptionKey', function(result) {
      resolve(result.encryptionKey);
    });
  });
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

async function applyParameters() {
  chrome.storage.local.get(['experimentId', 'variationId', 'whitelist', 'isEnabled'], async function(data) {
    if (data.isEnabled && data.experimentId && data.variationId) {
      const currentHost = window.location.hostname;
      const isWhitelisted = data.whitelist && data.whitelist.some(site => currentHost.includes(site));

      if (isWhitelisted) {
        const url = new URL(window.location.href);
        if (!url.searchParams.has('convert_action')) {
          url.searchParams.set('convert_action', 'convert_vpreview');
        }
        if (!url.searchParams.has('convert_e')) {
          const decryptedExperimentId = await decrypt(data.experimentId);
          url.searchParams.set('convert_e', decryptedExperimentId);
        }
        if (!url.searchParams.has('convert_v')) {
          const decryptedVariationId = await decrypt(data.variationId);
          url.searchParams.set('convert_v', decryptedVariationId);
        }
        if (url.href !== window.location.href) {
          window.history.replaceState({}, '', url);
        }
      }
    }
  });
}

function checkForUrlChange() {
  if (lastUrl !== location.href) {
    lastUrl = location.href;
    applyParameters();
  }
}

// Apply parameters on initial load
applyParameters();

// Check for URL changes every 500ms
setInterval(checkForUrlChange, 500);

// Listen for popstate events (back/forward navigation)
window.addEventListener('popstate', applyParameters);