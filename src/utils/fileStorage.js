const DB_NAME = 'xpense-fs';
const STORE = 'handles';
const FILE_KEY = 'dataFile';

async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = reject;
  });
}

export async function getStoredHandle() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(FILE_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function storeHandle(handle) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(handle, FILE_KEY);
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

export async function checkPermission(handle) {
  return handle.queryPermission({ mode: 'readwrite' });
}

export async function grantPermission(handle) {
  return handle.requestPermission({ mode: 'readwrite' });
}

export async function readFromFile(handle) {
  const file = await handle.getFile();
  const text = await file.text();
  return JSON.parse(text);
}

export async function writeToFile(handle, data) {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

export async function pickFile() {
  const handle = await window.showSaveFilePicker({
    suggestedName: 'xpense-data.json',
    types: [{ description: 'JSON fajl', accept: { 'application/json': ['.json'] } }],
  });
  await storeHandle(handle);
  return handle;
}
