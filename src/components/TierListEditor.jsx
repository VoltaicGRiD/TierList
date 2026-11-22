import { useRef, useState } from "react";
import Tier from "./Tier";
import TierItem from "./TierItem";
import UnrankedPool from "./UnrankedPool";
import { importImages } from "../importImages";
import useAutosave from "../hooks/useAutosave";
import useItemDrag from "../hooks/useItemDrag";
import * as tierList from "../tierListState";
import FullSizePreview from "./FullSizePreview";
import { deleteSlotPreviews, newPreviewKey, savePreviews } from "../storage";

// Edits one tier list (one save slot) and saves every change to it.
export default function TierListEditor({ slotId, initialState, onSaved }) {
  const [state, setState] = useState(initialState);
  const [selectedItem, setSelectedItem] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [importProgress, setImportProgress] = useState(null); // { done, total } while importing
  // Item ids are handed out here rather than inside a state update because
  // image items are added asynchronously and are selected as soon as they're
  // added.
  const nextItemId = useRef(tierList.nextIdAfter(Object.keys(initialState.items)));
  const saveError = useAutosave(slotId, state, initialState, onSaved);

  const { title, tiers, items, unrankedIds } = state;
  const update = (change, ...args) => setState((prev) => change(prev, ...args));

  const reset = () => {
    if (!window.confirm("Reset the tier list? This clears your saved changes.")) return;
    nextItemId.current = 0;
    setSelectedItem(null);
    setState(tierList.makeDefaultState());
    deleteSlotPreviews(slotId).catch((error) => console.error("Couldn't delete previews", error));
  };

  // Clicking an item selects it (clicking it again deselects it).
  const selectItem = (id) => setSelectedItem((prev) => (prev === id ? null : id));

  const moveSelectedItemTo = (tierId) => {
    if (selectedItem === null) return;
    update(tierList.moveItem, selectedItem, tierId);
    setSelectedItem(null);
  };

  const addItem = (fields) => {
    const id = nextItemId.current++;
    update(tierList.insertItem, { id, ...fields });
    setSelectedItem(id);
  };

  // Imports images into the unranked pool, or into `tierId` before
  // `beforeId` when they were dropped there. Everything is added in one
  // update once processed, so autosave writes once, not once per image.
  const importFiles = async (files, tierId = null, beforeId = null) => {
    if (files.length === 0) return;
    setImportProgress({ done: 0, total: files.length });
    try {
      const { images, failed } = await importImages(files, (done, total) => setImportProgress({ done, total }));
      if (images.length === 0 && failed.length === 0) {
        window.alert("No images found there.");
        return;
      }
      // Save the full-size previews first, then add the items pointing at
      // them. If saving fails the images still get added, just without a
      // full-size preview (the tile image is shown instead).
      const withKeys = images.map((entry) => ({ ...entry, previewKey: newPreviewKey() }));
      const previewsSaved = await savePreviews(
        slotId,
        withKeys.map(({ previewKey, preview }) => ({ key: previewKey, blob: preview }))
      ).then(
        () => true,
        (error) => {
          console.error("Couldn't save full-size previews", error);
          return false;
        }
      );
      const newItems = withKeys.map(({ name, image, previewKey }) => ({
        id: nextItemId.current++,
        type: "image",
        image,
        name,
        ...(previewsSaved && { previewKey }),
      }));
      const ids = newItems.map((item) => item.id);
      update((prev) => tierList.moveItems(tierList.insertItems(prev, newItems), ids, tierId, beforeId));
      setSelectedItem(newItems.length === 1 ? newItems[0].id : null);
      if (failed.length > 0) {
        const list = failed.slice(0, 10).join("\n");
        const more = failed.length > 10 ? `\n…and ${failed.length - 10} more` : "";
        window.alert(`Couldn't load ${failed.length} image(s). Try PNG, JPEG or WebP.\n\n${list}${more}`);
      }
    } finally {
      setImportProgress(null);
    }
  };

  // Opens the file picker: several images, or (with `folder`) every image
  // in a folder and its subfolders.
  const pickImages = ({ folder = false } = {}) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    if (folder) input.webkitdirectory = true;
    input.onchange = () => importFiles(Array.from(input.files ?? []));
    input.click();
  };

  const drag = useItemDrag({
    onMoveItem: (itemId, tierId, beforeId) => {
      if (!(itemId in items)) return; // e.g. dragged from another tab's list
      update(tierList.moveItem, itemId, tierId, beforeId);
      setSelectedItem(null);
    },
    onDropFiles: (files, tierId, beforeId) => {
      if (importProgress === null) importFiles(files, tierId, beforeId);
    },
  });

  const selected = selectedItem !== null ? items[selectedItem] : undefined;
  const canEditText = selected?.type === "text";

  // Show the hovered image large, or else the selected one (so it works on
  // touch screens, which can't hover). Hidden while dragging.
  const isImage = (id) => id !== null && items[id]?.image;
  const previewId = drag.isDragging ? null : isImage(hoveredItem) ? hoveredItem : isImage(selectedItem) ? selectedItem : null;
  const previewItem = previewId !== null ? items[previewId] : null;

  // `zone` is the tier id, or null for the unranked pool.
  const renderItems = (itemIds, zone) =>
    itemIds.map((itemId, index) => (
      <TierItem
        key={itemId}
        item={items[itemId]}
        selected={itemId === selectedItem}
        onSelect={() => selectItem(itemId)}
        onHoverChange={(hovering) => setHoveredItem((prev) => (hovering ? itemId : prev === itemId ? null : prev))}
        {...drag.itemProps(itemId, zone, itemIds, index)}
      />
    ));

  return (
    <>
      {previewItem && (
        <FullSizePreview
          itemId={previewId}
          slotId={slotId}
          previewKey={previewItem.previewKey}
          thumbnail={previewItem.image}
          name={previewItem.name}
        />
      )}
      {saveError && (
        <p className="tier-save-error" role="alert">
          Your changes aren't being saved ({saveError.message || "storage unavailable"}).
          They'll be lost if you close or refresh this page.
        </p>
      )}
      <input
        className="tier-title"
        type="text"
        placeholder="Tier List Title"
        value={title}
        onChange={(event) => update(tierList.setTitle, event.target.value)}
      />
      <div>
        {tiers.map((tier) => (
          <Tier
            key={tier.id}
            letter={tier.letter}
            backgroundColor={tier.backgroundColor}
            textColor={tier.textColor}
            onChange={(changes) => update(tierList.updateTier, tier.id, changes)}
            onDelete={() => update(tierList.deleteTier, tier.id)}
            onItemsAreaClick={() => moveSelectedItemTo(tier.id)}
            dropZone={drag.zoneProps(tier.id)}
            isDropTarget={drag.isDropTarget(tier.id)}
          >
            {renderItems(tier.itemIds, tier.id)}
          </Tier>
        ))}
        <UnrankedPool
          onAreaClick={() => moveSelectedItemTo(null)}
          dropZone={drag.zoneProps(null)}
          isDropTarget={drag.isDropTarget(null)}
        >
          {renderItems(unrankedIds, null)}
        </UnrankedPool>
        <input
          type="text"
          value={canEditText ? selected.text : ""}
          onFocus={(event) => event.target.select()}
          onChange={(event) => update(tierList.updateItem, selectedItem, { text: event.target.value })}
          disabled={!canEditText}
        />
        <br/>
        <button
          className="tier-button"
          onClick={() => update(tierList.addTier, { letter: "S", backgroundColor: "#ff0000", textColor: "#ffffff" })}
        >
          Add Tier
        </button>
        <button className="tier-button" onClick={() => addItem({ type: "text", text: "New item" })}>Add Text Object</button>
        <button className="tier-button" onClick={() => pickImages()} disabled={importProgress !== null}>
          Add Images
        </button>
        <button className="tier-button" onClick={() => pickImages({ folder: true })} disabled={importProgress !== null}>
          Add Folder
        </button>
        <button className="tier-button tier-button-danger" onClick={reset} disabled={importProgress !== null}>Reset</button>
        {importProgress && (
          <p className="tier-import-progress" role="status">
            Importing images… {importProgress.done} of {importProgress.total}
          </p>
        )}
      </div>
    </>
  );
}
