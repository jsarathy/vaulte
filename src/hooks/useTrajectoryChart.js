// src/hooks/useTrajectoryChart.js — the Trajectory chart's view state: which metric, expanded or
// not (double-click toggles, Esc collapses), the hovered tab / reading, the expanded drawing's
// measured size, and scrolling the latest reading into view when it opens.
import { useEffect, useRef, useState } from "react";
import { scrollLeftFor } from "../lib/trajectoryChart.js";

function useEscapeToCollapse(full, setFull) {
  useEffect(() => {
    if (!full) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setFull(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full, setFull]);
}

// On opening (or switching metric) bring the latest reading into view. latestXRef is set by
// the chart as it draws.
function useScrollToLatest(full, metric) {
  const scrollRef = useRef(null);
  const latestXRef = useRef(null);
  useEffect(() => {
    if (!full) return;
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el && latestXRef.current != null)
        el.scrollLeft = scrollLeftFor(latestXRef.current, el.clientWidth);
    });
  }, [full, metric]);
  return { scrollRef, latestXRef };
}

// Measure the expanded area so the drawing fits its height exactly (otherwise the date axis is
// clipped) and re-flows when the window is resized.
function useBoxSize(full, scrollRef) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = scrollRef.current;
    if (!full || !el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [full, scrollRef]);
  return box;
}

function useHover(full, metric) {
  const [hoverMetric, setHoverMetric] = useState(null); // metric tab being hovered
  const [hoverPt, setHoverPt] = useState(null); // expanded view only: { t, v }
  useEffect(() => {
    if (!full) setHoverPt(null);
  }, [full, metric]);
  return { hoverMetric, setHoverMetric, hoverPt, setHoverPt };
}

export default function useTrajectoryChart() {
  const [full, setFull] = useState(false);
  const [metric, setMetric] = useState("weight"); // "weight" | a Renpho metric key
  useEscapeToCollapse(full, setFull);
  const refs = useScrollToLatest(full, metric);
  const box = useBoxSize(full, refs.scrollRef);
  const hover = useHover(full, metric);
  const toggleFull = () => setFull((v) => !v);
  return { full, toggleFull, metric, setMetric, box, ...refs, ...hover };
}
