import TierObject from "./TierObject";

// One item tile, in a tier or the unranked pool. It can be clicked to select
// it or dragged (see useItemDrag); dropMarker shows where a drop would land.
// onHoverChange(true/false) reports the pointer entering and leaving it.
export default function TierItem({ item, selected, onSelect, onHoverChange, dragging, dropMarker, dragHandlers }) {
  const classes = [
    "tier-item",
    selected && "tier-item-selected",
    dragging && "tier-item-dragging",
    dropMarker && `tier-item-drop-${dropMarker}`,
  ].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      data-item-id={item.id}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      onClick={(event) => {
        event.stopPropagation(); // don't also count as a click on the row
        onSelect();
      }}
      {...dragHandlers}
      onDragStart={(event) => {
        dragHandlers?.onDragStart?.(event);
        // Mouse events stop during a drag, so mouseleave may never arrive.
        onHoverChange?.(false);
      }}
    >
      <TierObject text={item.text} image={item.image} name={item.name} />
    </div>
  );
}
