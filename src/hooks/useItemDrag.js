import { useState } from "react";

// Our own data type, so text boxes ignore dragged items (they'd otherwise
// type the id in) and dragged files or text are never mistaken for items.
const ITEM_TYPE = "application/x-tierlist-item";

const isItemDrag = (event) => event.dataTransfer.types.includes(ITEM_TYPE);
const isFileDrag = (event) => event.dataTransfer.types.includes("Files");
const isAccepted = (event) => isItemDrag(event) || isFileDrag(event);

// Drag and drop for items between tiers and the unranked pool, including
// dropping image files from the desktop.
//
// A "zone" is a tier id, or null for the unranked pool. The drop position is
// tracked as "insert before item X" (beforeId), or null for the end.
export default function useItemDrag({ onMoveItem, onDropFiles }) {
  const [draggingId, setDraggingId] = useState(null);
  const [target, setTarget] = useState(null); // { zone, beforeId } under the pointer

  // dragover fires constantly, so only re-render when the target changes.
  const showTarget = (zone, beforeId) =>
    setTarget((prev) => (prev && prev.zone === zone && prev.beforeId === beforeId ? prev : { zone, beforeId }));

  const clear = () => {
    setDraggingId(null);
    setTarget(null);
  };

  const accept = (event) => {
    event.preventDefault(); // without this the browser refuses the drop
    event.dataTransfer.dropEffect = isItemDrag(event) ? "move" : "copy";
  };

  // Props for a row of items (a tier or the pool).
  const zoneProps = (zone) => ({
    onDragOver: (event) => {
      if (!isAccepted(event)) return;
      accept(event);
      // Over empty space in the row: drop at the end.
      showTarget(zone, null);
    },
    onDragLeave: (event) => {
      // dragleave also fires when moving onto a child; ignore those.
      if (event.currentTarget.contains(event.relatedTarget)) return;
      setTarget((prev) => (prev?.zone === zone ? null : prev));
    },
    onDrop: (event) => {
      if (!isAccepted(event)) return;
      event.preventDefault();
      const beforeId = target?.zone === zone ? target.beforeId : null;
      clear();
      if (isItemDrag(event)) {
        const itemId = Number(event.dataTransfer.getData(ITEM_TYPE));
        if (Number.isInteger(itemId)) onMoveItem(itemId, zone, beforeId);
      } else {
        const files = Array.from(event.dataTransfer.files);
        if (files.length > 0) onDropFiles(files, zone, beforeId);
      }
    },
  });

  // Props for one item. `list` is the ids in its row, `index` its position.
  const itemProps = (itemId, zone, list, index) => {
    const isTargetRow = target?.zone === zone;
    const isNoOp = target?.beforeId === draggingId && draggingId !== null;
    let dropMarker = null;
    if (isTargetRow && !isNoOp) {
      if (target.beforeId === itemId) dropMarker = "before";
      else if (target.beforeId === null && index === list.length - 1) dropMarker = "after";
    }
    return {
      dragging: itemId === draggingId,
      dropMarker,
      dragHandlers: {
        draggable: true,
        onDragStart: (event) => {
          event.dataTransfer.setData(ITEM_TYPE, String(itemId));
          event.dataTransfer.effectAllowed = "move";
          // Changing the dragged element during dragstart can cancel the
          // drag in Chrome, so fade it on the next frame.
          requestAnimationFrame(() => setDraggingId(itemId));
        },
        onDragEnd: clear,
        onDragOver: (event) => {
          if (!isAccepted(event)) return;
          accept(event);
          event.stopPropagation(); // the row would otherwise reset to "end"
          // Left half of the tile: before it. Right half: before the next one.
          const rect = event.currentTarget.getBoundingClientRect();
          const after = event.clientX > rect.left + rect.width / 2;
          showTarget(zone, after ? (list[index + 1] ?? null) : itemId);
        },
      },
    };
  };

  return { zoneProps, itemProps, isDropTarget: (zone) => target?.zone === zone, isDragging: draggingId !== null };
}
