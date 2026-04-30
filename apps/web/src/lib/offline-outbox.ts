/**
 * Offline-Outbox: persistente Queue für Mutationen, die ohne Netz angestoßen werden.
 *
 * Architektur:
 *  - Mutationen (POST/PUT/DELETE) werden in IndexedDB als "PendingMutation"-Records gespeichert.
 *  - Sobald `navigator.onLine` wieder true ist (oder ein 'online'-Event feuert), läuft `replay()`.
 *  - Server-Antwort gewinnt bei Konflikt — Outbox-Record wird gelöscht, UI per Realtime aktualisiert.
 *  - Retries mit exponentialem Backoff, maxAttempts = 5.
 *
 * Funktioniert in Web + Capacitor-WebView. Keine externen Deps.
 *
 * Beispiel-Aufruf:
 *   import { enqueueMutation } from "@/lib/offline-outbox";
 *   await enqueueMutation({ url: "/api/gather/start", body: { node_id: 42 } });
 *   // → wenn online: führt sofort aus.  wenn offline: queued + zeigt UI-Hinweis.
 */

const DB_NAME = "ma365-offline";
const STORE = "outbox";
const DB_VERSION = 1;

export interface PendingMutation {
  id: string;
  url: string;
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  enqueuedAt: number;
  attempts: number;
  lastError?: string | null;
  // Optional: ein Hinweis fürs UI, was diese Mutation eigentlich tut
  description?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("enqueuedAt", "enqueuedAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest | void): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const r = fn(store);
    let result: T | undefined;
    if (r) r.onsuccess = () => { result = r.result as T; };
    t.oncomplete = () => resolve(result as T);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueueMutation(input: Omit<PendingMutation, "id" | "enqueuedAt" | "attempts">): Promise<Response> {
  const mutation: PendingMutation = {
    id: uuid(),
    method: input.method ?? "POST",
    url: input.url,
    body: input.body,
    headers: input.headers,
    description: input.description,
    enqueuedAt: Date.now(),
    attempts: 0,
  };

  // Online: direkt versuchen, nur bei Fehler queuen
  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const res = await sendMutation(mutation);
      if (res.ok) return res;
      // 4xx → Server lehnt ab, NICHT requeuen (würde endlos failen)
      if (res.status >= 400 && res.status < 500) return res;
      throw new Error(`HTTP ${res.status}`);
    } catch {
      // Netz-/5xx-Fehler → queuen
    }
  }

  await tx<void>("readwrite", (store) => store.put(mutation));
  notifyListeners();
  return new Response(JSON.stringify({ queued: true, id: mutation.id }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
}

async function sendMutation(m: PendingMutation): Promise<Response> {
  return fetch(m.url, {
    method: m.method,
    headers: { "Content-Type": "application/json", ...(m.headers ?? {}) },
    body: m.body !== undefined ? JSON.stringify(m.body) : undefined,
    credentials: "same-origin",
  });
}

export async function listPending(): Promise<PendingMutation[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, "readonly");
    const idx = t.objectStore(STORE).index("enqueuedAt");
    const out: PendingMutation[] = [];
    const req = idx.openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (c) { out.push(c.value as PendingMutation); c.continue(); } else { resolve(out); }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deletePending(id: string): Promise<void> {
  await tx<void>("readwrite", (store) => store.delete(id));
  notifyListeners();
}

let replayInFlight = false;
export async function replay(): Promise<{ done: number; failed: number }> {
  if (replayInFlight) return { done: 0, failed: 0 };
  replayInFlight = true;
  let done = 0, failed = 0;
  try {
    const items = await listPending();
    for (const m of items) {
      try {
        const res = await sendMutation(m);
        if (res.ok) {
          await deletePending(m.id);
          done++;
        } else if (res.status >= 400 && res.status < 500) {
          // Permanent fail → entfernen (optional: in dead-letter-Store)
          await deletePending(m.id);
          failed++;
        } else {
          await tx<void>("readwrite", (store) => store.put({
            ...m, attempts: m.attempts + 1, lastError: `HTTP ${res.status}`,
          }));
          if (m.attempts + 1 >= 5) await deletePending(m.id);
        }
      } catch (e) {
        await tx<void>("readwrite", (store) => store.put({
          ...m, attempts: m.attempts + 1, lastError: e instanceof Error ? e.message : String(e),
        }));
        if (m.attempts + 1 >= 5) await deletePending(m.id);
      }
      // exponential backoff zwischen items: 0, 200, 400, 800ms
      await new Promise((r) => setTimeout(r, Math.min(800, m.attempts * 200)));
    }
  } finally {
    replayInFlight = false;
    notifyListeners();
  }
  return { done, failed };
}

type Listener = (count: number) => void;
const listeners = new Set<Listener>();
export function onPendingCountChange(cb: Listener): () => void {
  listeners.add(cb);
  void listPending().then((p) => cb(p.length));
  return () => { listeners.delete(cb); };
}
function notifyListeners() {
  void listPending().then((p) => { for (const l of listeners) l(p.length); });
}

export function startAutoReplay(): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => { void replay(); };
  window.addEventListener("online", handler);
  // Auch periodisch versuchen (falls online-Event nie feuert, z.B. Capacitor)
  const id = window.setInterval(() => {
    if (navigator.onLine) void replay();
  }, 30_000);
  // Initialer Replay-Versuch nach Mount
  if (navigator.onLine) void replay();
  return () => {
    window.removeEventListener("online", handler);
    window.clearInterval(id);
  };
}
