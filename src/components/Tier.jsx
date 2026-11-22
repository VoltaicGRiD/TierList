export default function Tier({ letter, backgroundColor, textColor, onChange, onDelete, onItemsAreaClick, dropZone, isDropTarget, children }) {
  return (
    <div className="tier">
      <div className="tier-controls">
        <input type="color" className="tier-background" value={backgroundColor} onChange={(event) => onChange({ backgroundColor: event.target.value })} />
        <input type="color" className="tier-text" value={textColor} onChange={(event) => onChange({ textColor: event.target.value })} />
        {onDelete && (
          <button type="button" className="tier-delete" title="Delete tier" aria-label={`Delete tier ${letter}`} onClick={onDelete}>
            ×
          </button>
        )}
      </div>
      <input type="text" className="tier-letter" style={{ backgroundColor, color: textColor }} value={letter} onChange={(event) => onChange({ letter: event.target.value })} />
      <div
        className={`tier-items${isDropTarget ? " tier-items-drop-target" : ""}`}
        onClick={onItemsAreaClick}
        {...dropZone}
      >
        {children}
      </div>
    </div>
  );
}
