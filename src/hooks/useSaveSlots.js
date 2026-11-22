import { useEffect, useRef, useState } from "react";
import { deleteSlot, isUsableState, listSlots, loadSlot, newSlotId, setCurrentSlot } from "../storage";
import { announceSlotsChanged, lockedSlotIds, onSlotsChanged, tryLockSlot } from "../slotLocks";
import { makeDefaultState, normalizeState } from "../tierListState";

export const slotLabel = (slot) => slot.title.trim() || "Untitled list";
const newestFirst = (slots) => [...slots].sort((a, b) => b.updatedAt - a.updatedAt);

// Manages the save slots: which lists exist, which one this tab has open,
// and which are open in other tabs.
//
// Only one tab can have a slot open at a time (see slotLocks.js). On startup
// this opens the last-used slot if it's free, otherwise the next free one,
// otherwise a new list. If a slot can't be read it's skipped rather than
// replaced, so a failed load can never overwrite a saved list.
export default function useSaveSlots() {
  const [slots, setSlots] = useState(null); // [{ id, title, updatedAt }], null while loading
  const [active, setActive] = useState(null); // { id, state } of the open list
  const [lockedIds, setLockedIds] = useState(() => new Set()); // slots locked by any tab
  const [loadError, setLoadError] = useState(null);
  const heldLock = useRef(null); // { id, release } for the slot this tab has open
  const started = useRef(false);

  // Makes `id` this tab's open slot and lets go of the previous one. Locks
  // aren't released on unmount: this lives as long as the page, and the
  // browser releases them when the page goes away.
  const takeOver = (id, release, state) => {
    const previous = heldLock.current;
    heldLock.current = { id, release };
    setActive({ id, state });
    if (previous && previous.id !== id) previous.release();
    announceSlotsChanged();
  };

  // Re-reads which slots are locked and the latest slot titles.
  const refresh = async () => {
    try {
      const [locked, index] = await Promise.all([lockedSlotIds(), listSlots()]);
      setLockedIds(locked);
      setSlots(index.slots);
    } catch (error) {
      console.error("Couldn't refresh save slots", error);
    }
  };

  const startNewList = async () => {
    const id = newSlotId();
    const release = (await tryLockSlot(id)) ?? (() => {}); // a fresh id is never taken
    takeOver(id, release, makeDefaultState());
    refresh();
  };

  // Returns "opened", "locked" (open in another tab) or "unreadable".
  // Throws on storage errors.
  const openSlot = async (id) => {
    if (heldLock.current?.id === id) return "opened";
    const release = await tryLockSlot(id);
    if (!release) return "locked";
    try {
      const saved = await loadSlot(id);
      if (!isUsableState(saved)) {
        release();
        return "unreadable";
      }
      takeOver(id, release, normalizeState(saved));
      return "opened";
    } catch (error) {
      release();
      throw error;
    }
  };

  // Opens the first of `ids` that's free and readable, or a new list.
  const openFirstAvailable = async (ids) => {
    for (const id of ids) {
      try {
        const result = await openSlot(id);
        if (result === "opened") return;
        if (result === "unreadable") setLoadError(new Error("a saved list couldn't be read, so it was skipped"));
      } catch (error) {
        console.error("Couldn't open tier list", error);
        setLoadError(error);
      }
    }
    await startNewList();
  };

  useEffect(() => {
    // Run once, even when StrictMode runs effects twice in development;
    // two overlapping runs would compete for the same slot lock.
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const [index, locked] = await Promise.all([listSlots(), lockedSlotIds()]);
        setSlots(index.slots);
        setLockedIds(locked);
        const ordered = newestFirst(index.slots).map((slot) => slot.id);
        const last = ordered.includes(index.currentSlotId) ? [index.currentSlotId] : [];
        await openFirstAvailable([...last, ...ordered.filter((id) => id !== index.currentSlotId)]);
      } catch (error) {
        console.error("Couldn't load saved tier lists", error);
        setLoadError(error);
        setSlots((prev) => prev ?? []);
        await startNewList();
      }
    })();
    // openFirstAvailable/startNewList only use refs and state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep lock greying and slot titles current when other tabs change things.
  // Closed tabs can't announce, so also re-check on focus.
  useEffect(() => {
    const unsubscribe = onSlotsChanged(refresh);
    window.addEventListener("focus", refresh);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTo = async (id) => {
    try {
      const result = await openSlot(id);
      if (result === "opened") {
        setLoadError(null);
        setCurrentSlot(id).catch((error) => console.error("Couldn't remember the open list", error));
      } else if (result === "locked") {
        window.alert("That list is open in another tab.");
      } else {
        window.alert("That list couldn't be read.");
      }
    } catch (error) {
      console.error("Couldn't open tier list", error);
      window.alert(`That list couldn't be opened (${error?.message ?? "storage error"}).`);
    }
    refresh();
  };

  const deleteCurrentList = async () => {
    const saved = slots.find((slot) => slot.id === active.id);
    const name = saved ? slotLabel(saved) : "this unsaved list";
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    let remaining = slots.filter((slot) => slot.id !== active.id);
    if (saved) {
      try {
        remaining = (await deleteSlot(active.id)).slots;
      } catch (error) {
        console.error("Couldn't delete tier list", error);
        window.alert(`Couldn't delete the list (${error?.message ?? "storage error"}).`);
        return;
      }
    }
    setSlots(remaining);
    await openFirstAvailable(newestFirst(remaining).map((slot) => slot.id));
  };

  // Call after the open list is saved, with the index saveSlot returned.
  const handleSaved = (index) => {
    setSlots(index.slots);
    announceSlotsChanged();
  };

  return {
    loading: !slots || !active,
    slots,
    active,
    lockedIds,
    loadError,
    switchTo,
    startNewList,
    deleteCurrentList,
    refresh,
    handleSaved,
  };
}
