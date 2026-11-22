import { useEffect, useState } from "react";
import { loadPreview } from "../storage";

// Loads an item's full-size preview from storage and returns a URL for it,
// or null until it's loaded (or if it has none). The URL is released again
// when the item changes or the preview closes.
export default function usePreviewUrl(slotId, previewKey) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    setUrl(null);
    if (!previewKey) return undefined;
    let objectUrl = null;
    let current = true;
    loadPreview(slotId, previewKey)
      .then((blob) => {
        if (!current || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((error) => console.error("Couldn't load preview", error));
    return () => {
      current = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [slotId, previewKey]);

  return url;
}
