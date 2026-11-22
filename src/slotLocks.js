const PREFIX = "tierlist-slot:";
const CHANNEL = "tierlist";

const locksSupported = () => typeof navigator !== "undefined" && Boolean(navigator.locks);

// Tries to lock the slot without waiting. Resolves with a release function
// if this tab now holds the lock, or null if another tab already has it.
export function tryLockSlot(id) {
  if (!locksSupported()) return Promise.resolve(() => {});
  return new Promise((resolve) => {
    navigator.locks
      .request(PREFIX + id, { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(null);
          return undefined;
        }
        // The lock is held until the promise returned here settles.
        return new Promise((release) => resolve(release));
      })
      .catch((error) => {
        console.error("Couldn't lock save slot", error);
        resolve(null);
      });
  });
}

export async function lockedSlotIds() {
  if (!locksSupported()) return new Set();
  const { held = [] } = await navigator.locks.query();
  return new Set(held.filter((lock) => lock.name?.startsWith(PREFIX)).map((lock) => lock.name.slice(PREFIX.length)));
}

let channel = null;
const getChannel = () => {
  if (!channel && typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel(CHANNEL);
  return channel;
};

// Tells other tabs that locks or saved slots have changed.
export function announceSlotsChanged() {
  getChannel()?.postMessage("slots-changed");
}

export function onSlotsChanged(onChange) {
  const shared = getChannel();
  if (!shared) return () => {};
  const listener = () => onChange();
  shared.addEventListener("message", listener);
  return () => shared.removeEventListener("message", listener);
}
