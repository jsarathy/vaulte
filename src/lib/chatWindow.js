// src/lib/chatWindow.js — the chat's floating window geometry: its size and position clamped to
// the visible display (with a margin), where it opens beside the bubble, the stored size, and
// what a drag on an edge / corner handle does to it.

export const MIN = { w: 340, h: 420 }; // smallest size
export const MARGIN = 8; // kept from the display's edges
export const DEFAULT_SIZE = { w: 540, h: 680 };
export const ABOVE_BUBBLE = 14; // gap between the window and the bubble
export const STORAGE_KEY = "vaulte_chat_size";

const between = (v, lo, hi) => Math.round(Math.min(Math.max(v, lo), Math.max(lo, hi)));

/** A size within the minimum and the display less the margins; view = { w, h }. */
export const clampSize = ({ w, h }, view) => ({
  w: between(w, MIN.w, view.w - 2 * MARGIN),
  h: between(h, MIN.h, view.h - 2 * MARGIN),
});

/** A top-left corner keeping a window of `size` inside the display's margins. */
export const clampPos = ({ x, y }, size, view) => ({
  x: between(x, MARGIN, view.w - size.w - MARGIN),
  y: between(y, MARGIN, view.h - size.h - MARGIN),
});

/** The remembered size (JSON text, may be missing or broken), clamped; else the default. */
export function storedSize(raw, view) {
  try {
    const v = JSON.parse(raw || "null");
    if (v?.w && v?.h) return clampSize(v, view);
  } catch {
    /* unreadable — use the default size */
  }
  return clampSize(DEFAULT_SIZE, view);
}

/** Where the window opens: just above the bubble (its rect), right edges aligned; else bottom-right. */
export function openingPos(bubble, size, view) {
  const wanted = bubble
    ? { x: bubble.right - size.w, y: bubble.top - ABOVE_BUBBLE - size.h }
    : { x: view.w - size.w - 24, y: view.h - size.h - 90 };
  return clampPos(wanted, size, view);
}

/**
 * Resizing by a handle: dx / dy are -1 (left / top), 0 (none) or 1 (right / bottom); `from` is
 * { size, pos } at the start and `drag` the pointer's movement { delta } within the { view }.
 * The dragged side moves, the opposite side stays put, and nothing grows past the display's
 * margin on the dragged side.
 */
export function resizedBox({ dx, dy }, from, { delta, view }) {
  const right = from.pos.x + from.size.w;
  const bottom = from.pos.y + from.size.h;
  const want = { w: from.size.w + dx * delta.x, h: from.size.h + dy * delta.y };
  if (dx < 0) want.w = Math.min(want.w, right - MARGIN);
  if (dx > 0) want.w = Math.min(want.w, view.w - MARGIN - from.pos.x);
  if (dy < 0) want.h = Math.min(want.h, bottom - MARGIN);
  if (dy > 0) want.h = Math.min(want.h, view.h - MARGIN - from.pos.y);
  const size = clampSize(want, view);
  return {
    size,
    pos: { x: dx < 0 ? right - size.w : from.pos.x, y: dy < 0 ? bottom - size.h : from.pos.y },
  };
}

const EDGE = 6; // edge handle thickness
const CORNER = 14; // corner handle size

/** The eight resize handles: [dx, dy, box, cursor]. */
export const HANDLES = [
  [0, -1, { top: 0, left: CORNER, right: CORNER, height: EDGE }, "ns-resize"],
  [0, 1, { bottom: 0, left: CORNER, right: CORNER, height: EDGE }, "ns-resize"],
  [-1, 0, { left: 0, top: CORNER, bottom: CORNER, width: EDGE }, "ew-resize"],
  [1, 0, { right: 0, top: CORNER, bottom: CORNER, width: EDGE }, "ew-resize"],
  [-1, -1, { top: 0, left: 0, width: CORNER, height: CORNER }, "nwse-resize"],
  [1, 1, { bottom: 0, right: 0, width: CORNER, height: CORNER }, "nwse-resize"],
  [1, -1, { top: 0, right: 0, width: CORNER, height: CORNER }, "nesw-resize"],
  [-1, 1, { bottom: 0, left: 0, width: CORNER, height: CORNER }, "nesw-resize"],
];
