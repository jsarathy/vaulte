// src/hooks/useChatWindow.js — the chat's floating window: while open it floats over the whole
// app (fixed to the browser window, not clipped by the panel), can be dragged by its header and
// resized from any edge / corner. When closed it collapses back to the bubble; the next open
// starts beside the bubble again. Size is remembered (localStorage), position is not.
import { useEffect, useRef, useState } from "react";
import {
  STORAGE_KEY,
  clampPos,
  clampSize,
  openingPos,
  resizedBox,
  storedSize,
} from "../lib/chatWindow.js";

// Bounds = the visible display (visual viewport when available, e.g. with pinch-zoom / on-screen keyboard).
const view = () => ({
  w: Math.floor(
    window.visualViewport?.width || document.documentElement.clientWidth || window.innerWidth,
  ),
  h: Math.floor(
    window.visualViewport?.height || document.documentElement.clientHeight || window.innerHeight,
  ),
});

const readStoredSize = () => {
  try {
    return storedSize(localStorage.getItem(STORAGE_KEY), view());
  } catch {
    return storedSize(null, view()); // storage unavailable — use the default size
  }
};

const rememberSize = (size) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(size));
  } catch {
    /* storage unavailable — size not remembered */
  }
};

/** Follow the pointer until it is released: onMove(event) per move, then onUp(). */
function track(onMove, onUp) {
  const move = (ev) => onMove(ev);
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    document.body.style.userSelect = "";
    onUp?.();
  };
  document.body.style.userSelect = "none";
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

/** On open: place the window beside the bubble (wrapRef); on close: forget the position. */
function useOpening(chatOpen, wrapRef, box) {
  useEffect(() => {
    if (!chatOpen) return box.setPos(null);
    const size = clampSize(box.sizeRef.current, view());
    box.setSize(size);
    box.setPos(openingPos(wrapRef.current?.getBoundingClientRect(), size, view()));
  }, [chatOpen]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Keep the window on screen when the browser window is resized. */
function useRefit(chatOpen, box) {
  useEffect(() => {
    if (!chatOpen) return;
    const onResize = () => {
      const size = clampSize(box.sizeRef.current, view());
      box.setSize(size);
      if (box.posRef.current) box.setPos(clampPos(box.posRef.current, size, view()));
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, [chatOpen]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** The window's size and position as state, with refs holding the latest values for handlers. */
function useBox() {
  const [size, setSize] = useState(readStoredSize);
  const [pos, setPos] = useState(null); // top-left of the floating window; null until placed
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const posRef = useRef(pos);
  posRef.current = pos;
  return { size, setSize, pos, setPos, sizeRef, posRef };
}

/** Drag by the header (buttons in the header still click normally). */
const dragStarter = (box) => (e) => {
  if (e.button !== 0 || e.target.closest("button,select,input,textarea")) return;
  e.preventDefault();
  const start = { x: e.clientX, y: e.clientY };
  const p0 = box.posRef.current;
  const size = box.sizeRef.current;
  track((ev) => {
    const moved = { x: p0.x + ev.clientX - start.x, y: p0.y + ev.clientY - start.y };
    box.setPos(clampPos(moved, size, view()));
  });
};

/** Resize from an edge / corner: dx / dy = -1 (left / top), 0 (none), 1 (right / bottom). */
const resizeStarter = (box) => (dx, dy) => (e) => {
  e.preventDefault();
  e.stopPropagation();
  const start = { x: e.clientX, y: e.clientY };
  const from = { size: box.sizeRef.current, pos: box.posRef.current };
  track(
    (ev) => {
      const delta = { x: ev.clientX - start.x, y: ev.clientY - start.y };
      const next = resizedBox({ dx, dy }, from, { delta, view: view() });
      box.setSize(next.size);
      box.setPos(next.pos);
    },
    () => rememberSize(box.sizeRef.current),
  );
};

export function useChatWindow(chatOpen) {
  const wrapRef = useRef(null);
  const box = useBox();
  useOpening(chatOpen, wrapRef, box);
  useRefit(chatOpen, box);
  return {
    wrapRef,
    size: box.size,
    pos: box.pos,
    startDrag: dragStarter(box),
    startResize: resizeStarter(box),
  };
}
