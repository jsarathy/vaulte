// src/components/PhotoLogCard.jsx — "Log from Photo" card on Add Entry. Render only; state and
// actions in usePhotoLog.
import { identifiedText, itemSummary } from "../lib/photoLog.js";

const S = {
  card: {
    background: "#fff",
    borderRadius: "8px",
    border: "0.5px solid #e5e7eb",
    padding: "14px",
    marginBottom: "12px",
  },
  title: { fontWeight: "bold", color: "#185FA5", marginBottom: "10px", fontSize: "13px" },
  choose: (busy) => ({
    width: "100%",
    background: busy ? "#ccc" : "#378ADD",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "9px",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: busy ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  }),
  photo: {
    width: "100%",
    maxHeight: "160px",
    objectFit: "cover",
    borderRadius: "6px",
    marginBottom: "10px",
  },
  item: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 8px",
    borderBottom: "1px solid #F0F4F8",
    fontSize: "12px",
  },
  load: {
    background: "#E6F1FB",
    border: "none",
    color: "#185FA5",
    borderRadius: "4px",
    padding: "3px 8px",
    fontSize: "11px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  wide: (marginTop) => ({
    marginTop,
    width: "100%",
    borderRadius: "6px",
    padding: "8px",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
  }),
};

function FoundItem({ item, onLoad }) {
  return (
    <div style={S.item}>
      <div>
        <div style={{ fontWeight: "bold", color: "#185FA5" }}>{item.name}</div>
        <div style={{ fontSize: "10px", color: "#6b7280" }}>{itemSummary(item)}</div>
      </div>
      <button onClick={() => onLoad(item)} style={S.load}>
        ↑ Load
      </button>
    </div>
  );
}

function FoundItems({ photo }) {
  return (
    <div style={{ marginTop: "12px" }}>
      <img src={photo.preview} alt="food" style={S.photo} />
      <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "6px" }}>
        {identifiedText(photo.items.length)}
      </div>
      {photo.items.map((item, i) => (
        <FoundItem key={i} item={item} onLoad={photo.load} />
      ))}
      <button
        onClick={photo.logAll}
        style={{ ...S.wide("10px"), background: "#2E7D32", color: "#fff", border: "none" }}
      >
        ✓ Log All {photo.items.length} Items
      </button>
      <button
        onClick={photo.saveAsRecipe}
        style={{
          ...S.wide("6px"),
          background: "transparent",
          color: "#185FA5",
          border: "1px solid #185FA5",
        }}
      >
        📖 Save as Recipe
      </button>
    </div>
  );
}

/** photo: usePhotoLog(). */
export default function PhotoLogCard({ photo }) {
  return (
    <div style={S.card}>
      <div style={S.title}>📸 Log from Photo</div>
      <input
        ref={photo.inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={photo.onFile}
      />
      <button onClick={photo.choose} disabled={photo.loading} style={S.choose(photo.loading)}>
        {photo.loading ? "⏳ Analysing…" : "📷 Take / Choose Photo"}
      </button>
      {photo.error && (
        <div style={{ marginTop: "8px", color: "#c62828", fontSize: "12px" }}>{photo.error}</div>
      )}
      {photo.preview && photo.items.length > 0 && <FoundItems photo={photo} />}
    </div>
  );
}
