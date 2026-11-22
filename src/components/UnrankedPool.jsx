// Where new items land before being placed in a tier. Clicking or dropping
// on it moves items back into the pool; image files can be dropped here too.
export default function UnrankedPool({ onAreaClick, dropZone, isDropTarget, children }) {
  const isEmpty = !children || children.length === 0;
  return (
    <section className="tier-pool">
      <h2 className="tier-pool-label">Unranked</h2>
      <div
        className={`tier-items${isDropTarget ? " tier-items-drop-target" : ""}`}
        onClick={onAreaClick}
        {...dropZone}
      >
        {isEmpty
          ? <p className="tier-pool-empty">New items appear here. Drag them into a tier, or click one and then click a tier. You can also drop image files here.</p>
          : children}
      </div>
    </section>
  );
}
