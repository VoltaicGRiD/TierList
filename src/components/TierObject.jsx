import { useLayoutEffect, useRef } from "react";

const MAX_FONT_SIZE = 24; // px
const MIN_FONT_SIZE = 10; // px

function fitFontSize(box, content) {
  const style = getComputedStyle(box);
  const availableWidth = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const availableHeight = box.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const fits = (size) => {
    box.style.fontSize = `${size}px`;
    return content.offsetWidth <= availableWidth && content.offsetHeight <= availableHeight;
  };

  if (fits(MAX_FONT_SIZE)) return true;
  if (!fits(MIN_FONT_SIZE)) return false;
  // Binary search: `low` always fits, `high` never does.
  let low = MIN_FONT_SIZE;
  let high = MAX_FONT_SIZE;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (fits(mid)) low = mid;
    else high = mid;
  }
  fits(low); // leave the box at the winning size, not the last one tried
  return true;
}

function FittedText({ text, placeholder = false }) {
  const boxRef = useRef(null);
  const contentRef = useRef(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const content = contentRef.current;
    if (!box || !content) return;

    const fit = () => {
      box.classList.remove("tier-object-text-overflow");
      if (!fitFontSize(box, content)) {
        box.classList.add("tier-object-text-overflow");
      }
    };

    fit();
    let cancelled = false;
    document.fonts?.ready.then(() => !cancelled && fit());
    return () => { cancelled = true; };
  }, [text]);

  return (
    <p
      ref={boxRef}
      className={`tier-object-text${placeholder ? " tier-object-text-placeholder" : ""}`}
      title={text}
    >
      <span ref={contentRef}>{text}</span>
    </p>
  );
}

export default function TierObject({ text = "", image = "", name = "" }) {
  const showText = text || !image;
  return (
    <div>
      {image && <img src={image} alt={text || name} title={name || undefined} className="tier-object-image" draggable={false} />}
      {showText && <FittedText text={text || "[empty]"} placeholder={!text} />}
    </div>
  );
}
