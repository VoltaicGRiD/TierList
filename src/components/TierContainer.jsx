import useSaveSlots from "../hooks/useSaveSlots";
import SlotBar from "./SlotBar";
import TierListEditor from "./TierListEditor";

// Puts the save-slot picker above the editor for whichever list is open.
export default function TierContainer() {
  const slots = useSaveSlots();

  if (slots.loading) return <p className="tier-loading">Loading…</p>;

  return (
    <>
      <SlotBar
        slots={slots.slots}
        activeId={slots.active.id}
        lockedIds={slots.lockedIds}
        onSwitch={slots.switchTo}
        onNew={slots.startNewList}
        onDelete={slots.deleteCurrentList}
        onRefresh={slots.refresh}
      />
      {slots.loadError && (
        <p className="tier-save-error" role="alert">
          Couldn't load a saved list ({slots.loadError.message || "storage error"}). Nothing saved was
          overwritten. Try refreshing, or pick a list above.
        </p>
      )}
      <TierListEditor
        key={slots.active.id}
        slotId={slots.active.id}
        initialState={slots.active.state}
        onSaved={slots.handleSaved}
      />
    </>
  );
}
