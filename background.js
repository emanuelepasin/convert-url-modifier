async function generateEncryptionKey() {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const exportedKey = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode.apply(null, new Uint8Array(exportedKey)));
}

async function getOrCreateEncryptionKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get('encryptionKey', async function(result) {
      if (result.encryptionKey) {
        resolve(result.encryptionKey);
      } else {
        const newKey = await generateEncryptionKey();
        chrome.storage.local.set({ encryptionKey: newKey }, function() {
          resolve(newKey);
        });
      }
    });
  });
}

async function encrypt(text) {
  const keyBase64 = await getOrCreateEncryptionKey();
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

chrome.runtime.onInstalled.addListener(async function() {
  const encryptedExperimentId = await encrypt('');
  const encryptedVariationId = await encrypt('');
  chrome.storage.local.set({
    experimentId: encryptedExperimentId,
    variationId: encryptedVariationId,
    whitelist: [],
    isEnabled: true
  }, function() {
    console.log('Default settings initialized');
  });
});