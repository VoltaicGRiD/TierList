// Saves tier lists in IndexedDB, one save slot per list.
//
// IndexedDB is used instead of localStorage because localStorage is capped at
// roughly 5 MB per site, which a few dozen images can fill. IndexedDB allows
// hundreds of MB and stores objects directly, without JSON.stringify.
//
// Stores:
//   "slots": slot id -> the full tier list state (title, tiers, items, ...)
//   "meta":  "index" -> { slots: [{ id, title, updatedAt }], currentSlotId }
//   "previews": [slot id, preview key] -> full-size preview image (Blob)
// The index is kept separately so listing slots doesn't load every image.
// Previews are kept out of the list itself because the list is rewritten on
// every change; they're only read when one is shown.

const DB_NAME = "tierlist";
const DB_VERSION = 3;
const SLOTS = "slots";
const META = "meta";
const PREVIEWS = "previews";
const INDEX_KEY = "index";

// Version 1 kept a single list here; it becomes the first slot.
const V1_STORE = "state";
const V1_KEY = "current";

// Before IndexedDB, the app saved here; it's migrated on first load.
const LEGACY_LOCAL_STORAGE_KEY = "tierlist.state";

const emptyIndex = () => ({ slots: [], currentSlotId: null });

export const isUsableState = (state) =>
  Boolean(state) && typeof state.title === "string" && Array.isArray(state.tiers);

export function newSlotId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const summarize = (id, state) => ({ id, title: state.title, updatedAt: Date.now() });

function upgrade(request, oldVersion) {
  const db = request.result;
  if (oldVersion < 2) {
    db.createObjectStore(SLOTS);
    db.createObjectStore(META);
  }
  if (oldVersion === 1) {
    // Move the single v1 list into a slot, then drop the old store. All of
    // this happens in the upgrade transaction, so it's all-or-nothing.
    const transaction = request.transaction;
    const read = transaction.objectStore(V1_STORE).get(V1_KEY);
    read.onsuccess = () => {
      const old = read.result;
      if (isUsableState(old)) {
        const id = newSlotId();
        transaction.objectStore(SLOTS).put(old, id);
        transaction.objectStore(META).put({ slots: [summarize(id, old)], currentSlotId: id }, INDEX_KEY);
      }
      db.deleteObjectStore(V1_STORE);
    };
  }
  if (oldVersion < 3) {
    db.createObjectStore(PREVIEWS);
  }
}

// Every preview key of one slot: [slotId, anything]. Arrays sort after
// strings, so [slotId, []] is above every [slotId, "<key>"].
const slotPreviewRange = (slotId) => IDBKeyRange.bound([slotId], [slotId, []]);

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB is not available in this browser"));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => upgrade(request, event.oldVersion);
      request.onsuccess = () => {
        const db = request.result;
        // If another tab opens a newer version, step aside so its upgrade
        // isn't blocked; the next call here reopens the database.
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error ?? new Error("Couldn't open the database"));
      request.onblocked = () => reject(new Error("The database is blocked by another open tab"));
    });
    // Let a later call try again instead of reusing a failed open.
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

// Runs `work(stores)` in one transaction and resolves with whatever it
// returns once the transaction has committed. `work` may return a function,
// which is called after commit to compute the result (for values produced by
// request callbacks).
async function transact(storeNames, mode, work) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    const stores = Object.fromEntries(storeNames.map((name) => [name, transaction.objectStore(name)]));
    let failure = null;
    // A failed request bubbles its error event up to the transaction before
    // transaction.error is set, so take the error from the request itself.
    transaction.addEventListener("error", (event) => { failure ??= event.target.error; });
    let result;
    try {
      result = work(stores);
    } catch (error) {
      transaction.abort();
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(typeof result === "function" ? result() : result);
    transaction.onabort = () =>
      reject(failure ?? transaction.error ?? new Error("The save was cancelled by the browser"));
  });
}

const readIndex = () =>
  transact([META], "readonly", ({ meta }) => {
    const request = meta.get(INDEX_KEY);
    return () => request.result ?? emptyIndex();
  });

function readLegacyLocalStorage() {
  try {
    return JSON.parse(localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY));
  } catch {
    return null;
  }
}

// Returns { slots: [{ id, title, updatedAt }], currentSlotId }.
// Throws if IndexedDB can't be read.
export async function listSlots() {
  const index = await readIndex();
  if (index.slots.length > 0) return index;

  // Nothing saved yet: carry over the pre-IndexedDB localStorage save, if it
  // looks valid. It's only deleted from localStorage once it's safely saved.
  const legacy = readLegacyLocalStorage();
  if (!isUsableState(legacy)) return index;
  const id = newSlotId();
  await saveSlot(id, legacy);
  try {
    localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
  } catch {
    // Not worth failing over; it'll be ignored from now on.
  }
  return readIndex();
}

// Returns the slot's saved state, or undefined if there isn't one.
export const loadSlot = (id) =>
  transact([SLOTS], "readonly", ({ slots }) => {
    const request = slots.get(id);
    return () => request.result;
  });

// Saves the state into the slot (creating it if needed), updates its entry
// in the index and makes it the current slot. Returns the new index.
// Throws if the write fails (e.g. storage quota exceeded).
export const saveSlot = (id, state) =>
  transact([SLOTS, META], "readwrite", ({ slots, meta }) => {
    slots.put(state, id);
    let index;
    const read = meta.get(INDEX_KEY);
    read.onsuccess = () => {
      const previous = read.result ?? emptyIndex();
      const summary = summarize(id, state);
      const exists = previous.slots.some((slot) => slot.id === id);
      index = {
        slots: exists
          ? previous.slots.map((slot) => (slot.id === id ? summary : slot))
          : [...previous.slots, summary],
        currentSlotId: id,
      };
      meta.put(index, INDEX_KEY);
    };
    return () => index;
  });

// Deletes a slot and its index entry. Returns the new index.
export const deleteSlot = (id) =>
  transact([SLOTS, META, PREVIEWS], "readwrite", ({ slots, meta, previews }) => {
    slots.delete(id);
    previews.delete(slotPreviewRange(id));
    let index;
    const read = meta.get(INDEX_KEY);
    read.onsuccess = () => {
      const previous = read.result ?? emptyIndex();
      index = {
        slots: previous.slots.filter((slot) => slot.id !== id),
        currentSlotId: previous.currentSlotId === id ? null : previous.currentSlotId,
      };
      meta.put(index, INDEX_KEY);
    };
    return () => index;
  });

// Remembers which slot to open next time.
export const setCurrentSlot = (id) =>
  transact([META], "readwrite", ({ meta }) => {
    const read = meta.get(INDEX_KEY);
    read.onsuccess = () => meta.put({ ...(read.result ?? emptyIndex()), currentSlotId: id }, INDEX_KEY);
  });

export const newPreviewKey = newSlotId;

// Saves full-size previews for a slot: [{ key, blob }].
export const savePreviews = (slotId, entries) =>
  transact([PREVIEWS], "readwrite", ({ previews }) => {
    for (const { key, blob } of entries) previews.put(blob, [slotId, key]);
  });

// Returns the preview Blob, or undefined if there isn't one.
export const loadPreview = (slotId, key) =>
  transact([PREVIEWS], "readonly", ({ previews }) => {
    const request = previews.get([slotId, key]);
    return () => request.result;
  });

// Deletes every preview belonging to a slot (e.g. when it's reset).
export const deleteSlotPreviews = (slotId) =>
  transact([PREVIEWS], "readwrite", ({ previews }) => {
    previews.delete(slotPreviewRange(slotId));
  });
