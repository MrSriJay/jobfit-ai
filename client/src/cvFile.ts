const DB_NAME = "jobfit-cv";
const STORE = "files";
const KEY = "current";

export interface StoredCv {
  name: string;
  type: string;
  bytes: ArrayBuffer;
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function saveCvFile(file: File): Promise<void> {
  await withStore("readwrite", (store) => store.put({ name: file.name, type: file.type, bytes: file }, KEY));
}

export async function loadCvFile(): Promise<StoredCv | null> {
  const saved = await withStore<StoredCv | File | undefined>("readonly", (store) => store.get(KEY));
  if (!saved) return null;
  if (saved instanceof File) {
    return { name: saved.name, type: saved.type, bytes: await saved.arrayBuffer() };
  }
  const bytes = saved.bytes instanceof ArrayBuffer ? saved.bytes : await new Blob([saved.bytes]).arrayBuffer();
  return { name: saved.name, type: saved.type, bytes };
}

export async function clearCvFile(): Promise<void> {
  await withStore("readwrite", (store) => store.delete(KEY)).catch(() => undefined);
}

export function deleteCvDatabase(): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}
