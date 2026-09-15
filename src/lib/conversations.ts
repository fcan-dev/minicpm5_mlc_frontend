import type { Conversation } from "../types";
import { en } from "../i18n/en";

const DB_NAME = "minicpm5-chat";
const STORE = "conversations";
const DB_VERSION = 1;

/** In-memory mirror, also the fallback when IndexedDB is unavailable (SSR/tests). */
const memory = new Map<string, Conversation>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE, { keyPath: "id" });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

/** Run one request against the store; resolves null when IndexedDB is absent. */
function request<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const req = fn(db.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result as T);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      })
  );
}

export async function listConversations(): Promise<Conversation[]> {
  const all = (await request<Conversation[]>("readonly", (s) => s.getAll())) ?? [...memory.values()];
  return all.slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  const found = await request<Conversation>("readonly", (s) => s.get(id));
  return found ?? memory.get(id);
}

export async function putConversation(conv: Conversation): Promise<void> {
  memory.set(conv.id, conv);
  await request("readwrite", (s) => s.put(conv));
}

export async function deleteConversation(id: string): Promise<void> {
  memory.delete(id);
  await request("readwrite", (s) => s.delete(id));
}

/** Test hook: clear the memory fallback and close the cached connection. */
export function resetStore(): void {
  memory.clear();
  dbPromise = null;
}

export function newConversation(): Conversation {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: en.untitledChat,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}
