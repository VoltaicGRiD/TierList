import { useEffect, useRef, useState } from "react";
import { saveSlot } from "../storage";

// Saves `state` into the slot after every change and returns the last save
// error (or null). Nothing is written until the state differs from
// `initialState`, so just opening a list never writes anything. IndexedDB
// runs the writes in the order they're made, so the last change always wins.
export default function useAutosave(slotId, state, initialState, onSaved) {
  const [saveError, setSaveError] = useState(null);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  useEffect(() => {
    if (state === initialState) return;
    let current = true;
    saveSlot(slotId, state)
      .then((index) => {
        onSavedRef.current?.(index);
        if (current) setSaveError(null);
      })
      .catch((error) => {
        console.error("Couldn't save tier list", error);
        if (current) setSaveError(error);
      });
    return () => { current = false; };
  }, [slotId, state, initialState]);

  return saveError;
}
