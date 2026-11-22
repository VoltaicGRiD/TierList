import { useLayoutEffect, useState } from "react";
import usePreviewUrl from "../hooks/usePreviewUrl";

const MAX_SIZE = 500; // px
const GAP = 10; // px between the tile and the preview, and from screen edges

// Works out where to put the preview: to the right of the tile if it fits,
// otherwise to the left, and always kept on screen.
function placeBeside(rect, size) {
  const fitsRight = rect.right + GAP + size <= window.innerWidth - GAP;
  const left = fitsRight ? rect.right + GAP : rect.left - GAP - size;
  const top = rect.top + rect.height / 2 - size / 2;
  const clamp = (value, max) => Math.min(Math.max(value, GAP), max);
  return {
    left: clamp(left, window.innerWidth - size - GAP),
    top: clamp(top, window.innerHeight - size - GAP),
  };
}

// A large view of an item's image, shown beside its tile. It finds the tile
// by its data-item-id and follows it on scroll or resize. It ignores the
// mouse, so it never gets in the way of clicks or drops underneath it.
//
// Shows the stored full-size preview once it's loaded, and the tile image
// until then (or for items imported before previews existed).
export default function FullSizePreview({ itemId, slotId, previewKey, thumbnail, name }) {
  const [layout, setLayout] = useState(null); // { left, top, size }
  const previewUrl = usePreviewUrl(slotId, previewKey);

  useLayoutEffect(() => {
    const place = () => {
      const tile = document.querySelector(`[data-item-id="${itemId}"]`);
      if (!tile) {
        setLayout(null);
        return;
      }
      const size = Math.min(MAX_SIZE, window.innerWidth - 2 * GAP, window.innerHeight - 2 * GAP);
      setLayout({ ...placeBeside(tile.getBoundingClientRect(), size), size });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [itemId]);

  if (!layout) return null;

  return (
    <figure
      className="full-size-preview"
      style={{ left: layout.left, top: layout.top, width: layout.size, height: layout.size }}
      aria-hidden="true"
    >
      <img src={previewUrl ?? thumbnail} alt="" />
      {name && <figcaption>{name}</figcaption>}
    </figure>
  );
}
