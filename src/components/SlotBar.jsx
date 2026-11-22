import { slotLabel } from "../hooks/useSaveSlots";

// The list picker plus New list / Delete list. Slots open in other tabs are
// shown but can't be picked.
export default function SlotBar({ slots, activeId, lockedIds, onSwitch, onNew, onDelete, onRefresh }) {
  const activeIsSaved = slots.some((slot) => slot.id === activeId);
  const isOpenElsewhere = (id) => id !== activeId && lockedIds.has(id);

  return (
    <div className="slot-bar">
      <label>
        List{" "}
        <select
          className="slot-select"
          value={activeId}
          onChange={(event) => onSwitch(event.target.value)}
          onPointerDown={onRefresh}
          onFocus={onRefresh}
        >
          {slots.map((slot) => (
            <option key={slot.id} value={slot.id} disabled={isOpenElsewhere(slot.id)}>
              {slotLabel(slot)}{isOpenElsewhere(slot.id) ? " (open in another tab)" : ""}
            </option>
          ))}
          {!activeIsSaved && <option value={activeId}>New list (not saved yet)</option>}
        </select>
      </label>
      <button className="tier-button" onClick={onNew}>New list</button>
      <button className="tier-button tier-button-danger" onClick={onDelete}>Delete list</button>
    </div>
  );
}
