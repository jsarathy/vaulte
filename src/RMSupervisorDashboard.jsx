// src/RMSupervisorDashboard.jsx — Relationship Supervisor Portal
import { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  doc, setDoc, getDoc, getDocs,
  collection, updateDoc, query, orderBy,
} from "firebase/firestore";

// ── Constants ──────────────────────────────────────────────────────────────────
const C = {
  navy:"#0D1B2A", blue:"#1558C0", blueLt:"#3B76D4",
  pale:"#EEF4FF", pale2:"#D9E8FF", border:"#E2E8F0",
  slate:"#475569", mist:"#F8FAFC", white:"#FFFFFF",
  text:"#1E293B", hint:"#94A3B8",
  green:"#15803D", greenBg:"#F0FDF4", greenBorder:"#BBF7D0",
  amber:"#92400E", amberBg:"#FEF3C7", amberBorder:"#FCD34D",
  red:"#991B1B", redBg:"#FEF2F2", redBorder:"#FCA5A5",
};

const PERSONA_META = {
  seller: { icon:"🏠", label:"Seller", color:"#1558C0", bg:"#EEF4FF" },
  buyer:  { icon:"🔑", label:"Buyer",  color:"#7C3AED", bg:"#F5F3FF" },
};

async function hashPassword(password) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(password));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

const supCredRef  = (uid) => doc(db, "users", uid, "re_credentials", "supervisor");
const supProfRef  = (uid) => doc(db, "users", uid, "re_profile",     "supervisor");
const rmProfRef   = (uid) => doc(db, "users", uid, "re_profile",     "rm");
const unassignedCol = (uid) => collection(db, "users", uid, "re_unassigned");
function txDocRef(uid, txId, persona) {
  return doc(db, "users", uid, "re_transactions", `${txId}_${persona}`);
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

// ── RmCard ────────────────────────────────────────────────────────────────────
function RmCard({ rm, onEdit, onRemove }) {
  return (
    <div style={{
      background:"#fff", borderRadius:12, border:`1px solid ${C.border}`,
      padding:"16px 18px", boxShadow:"0 1px 6px rgba(0,0,0,0.05)",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:"50%", background:`linear-gradient(135deg,${C.blue},${C.blueLt})`, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:15, flexShrink:0 }}>
            {(rm.name||"?")[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize:"clamp(13px,1.3vw,15px)", fontWeight:700, color:C.navy }}>{rm.name}</div>
            <div style={{ fontSize:"clamp(10px,1vw,12px)", color:C.hint }}>{rm.institution || "No institution"}</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={onEdit}
            style={{ background:C.pale, border:`1px solid ${C.pale2}`, color:C.blue, borderRadius:5, padding:"3px 9px", cursor:"pointer", fontSize:"clamp(10px,1vw,11px)", fontFamily:"inherit" }}>
            ✎ Edit
          </button>
          <button onClick={onRemove}
            style={{ background:C.redBg, border:`1px solid ${C.redBorder}`, color:C.red, borderRadius:5, padding:"3px 9px", cursor:"pointer", fontSize:"clamp(10px,1vw,11px)", fontFamily:"inherit" }}>
            ✕
          </button>
        </div>
      </div>
      <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
        {rm.phone && <span style={{ fontSize:"clamp(11px,1.1vw,12px)", color:C.slate }}>📞 {rm.phone}</span>}
        {rm.username && <span style={{ fontSize:"clamp(11px,1.1vw,12px)", color:C.hint, fontFamily:"'DM Mono',monospace" }}>@{rm.username}</span>}
        <span style={{ fontSize:"clamp(11px,1.1vw,12px)", fontWeight:600, color:C.green }}>
          {rm.txIds?.length || 0} active deal{rm.txIds?.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

// ── UnassignedCard ─────────────────────────────────────────────────────────────
function UnassignedCard({ item, rmRoster, onAssign }) {
  const [open, setOpen] = useState(false);
  const [selectedRm, setSelectedRm] = useState("");
  const meta = PERSONA_META[item.persona] || PERSONA_META.seller;

  return (
    <div style={{
      background:"#fff", borderRadius:12, border:`2px solid ${C.amberBorder}`,
      padding:"14px 18px", boxShadow:"0 2px 10px rgba(245,158,11,0.1)",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:20 }}>{meta.icon}</span>
          <div>
            <div style={{ fontSize:"clamp(12px,1.2vw,14px)", fontWeight:700, color:C.navy }}>{item.name}</div>
            <div style={{ fontSize:"clamp(10px,1vw,12px)", color:C.hint }}>
              {item.persona === "seller" ? item.propertyAddress || "No address" : `Buyer · TXN: ${item.txId || "none yet"}`}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
          <span style={{ fontSize:"clamp(9px,0.9vw,11px)", fontWeight:600, padding:"2px 8px", borderRadius:20, background:meta.bg, color:meta.color }}>
            {meta.label}
          </span>
          <span style={{ fontSize:"clamp(9px,0.9vw,10px)", color:C.hint }}>{timeAgo(item.createdAt)}</span>
        </div>
      </div>

      {item.txId && (
        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"clamp(10px,1vw,11px)", color:C.slate, marginBottom:10, padding:"4px 8px", background:C.mist, borderRadius:5, display:"inline-block" }}>
          {item.txId}
        </div>
      )}

      {!open ? (
        <button onClick={() => setOpen(true)}
          style={{ width:"100%", padding:"8px", background:C.navy, color:"#fff", border:"none", borderRadius:7, cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:"clamp(12px,1.2vw,13px)" }}>
          Assign RM →
        </button>
      ) : (
        <div style={{ marginTop:6 }}>
          <select value={selectedRm} onChange={e => setSelectedRm(e.target.value)}
            style={{ width:"100%", padding:"8px 10px", border:`1.5px solid ${selectedRm ? C.blue : C.border}`, borderRadius:7, fontSize:"clamp(12px,1.2vw,14px)", fontFamily:"inherit", background: selectedRm ? C.pale : "#fff", outline:"none", marginBottom:8, color:C.navy }}>
            <option value="">— Select a Relationship Manager —</option>
            {rmRoster.map((rm, i) => (
              <option key={i} value={i}>{rm.name}{rm.institution ? ` · ${rm.institution}` : ""}</option>
            ))}
          </select>
          {rmRoster.length === 0 && (
            <div style={{ fontSize:"clamp(11px,1vw,12px)", color:C.hint, marginBottom:8, fontStyle:"italic" }}>
              No RMs in roster yet. Add one in the RM Roster panel.
            </div>
          )}
          <div style={{ display:"flex", gap:8 }}>
            <button
              disabled={selectedRm === "" || rmRoster.length === 0}
              onClick={() => { onAssign(item, rmRoster[parseInt(selectedRm)]); setOpen(false); setSelectedRm(""); }}
              style={{ flex:1, padding:"8px", background: selectedRm !== "" ? C.green : C.hint, color:"#fff", border:"none", borderRadius:7, cursor: selectedRm !== "" ? "pointer" : "not-allowed", fontWeight:700, fontSize:"clamp(12px,1.2vw,13px)", fontFamily:"inherit" }}>
              ✓ Confirm
            </button>
            <button onClick={() => { setOpen(false); setSelectedRm(""); }}
              style={{ padding:"8px 12px", background:"transparent", border:`1px solid ${C.border}`, borderRadius:7, cursor:"pointer", fontSize:"clamp(12px,1.2vw,13px)", color:C.slate, fontFamily:"inherit" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function RMSupervisorDashboard({ userId }) {
  const [step, setStep] = useState("sup_login"); // sup_login | sup_register | sup_dashboard
  const [myName, setMyName] = useState("");
  const [showPass, setShowPass] = useState(false);

  // Login
  const [loginUser, setLoginUser]     = useState("");
  const [loginPass, setLoginPass]     = useState("");
  const [loginError, setLoginError]   = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Register
  const EMPTY_REG = { name:"", phone:"", institution:"", username:"", password:"", password2:"" };
  const [reg, setReg]         = useState(EMPTY_REG);
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);

  // Dashboard
  const [unassigned, setUnassigned]   = useState([]);
  const [assigned, setAssigned]       = useState([]);
  const [rmRoster, setRmRoster]       = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  // RM editor
  const [addRmOpen, setAddRmOpen]   = useState(false);
  const [editRmIdx, setEditRmIdx]   = useState(null);
  const EMPTY_RM = { name:"", phone:"", institution:"", username:"" };
  const [rmForm, setRmForm]         = useState(EMPTY_RM);
  const [rmFormError, setRmFormError] = useState("");

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (msg, ok=true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  // ── Load dashboard data ──
  const loadDashboard = async () => {
    setDataLoading(true);
    try {
      const profSnap = await getDoc(supProfRef(userId));
      const profData = profSnap.exists() ? profSnap.data() : {};
      setMyName(profData.name || "");
      setRmRoster(profData.rmRoster || []);

      // Load unassigned / assigned
      const snap = await getDocs(unassignedCol(userId));
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      setUnassigned(all.filter(i => !i.assignedRm));
      setAssigned(all.filter(i => !!i.assignedRm));
    } catch(e) { console.error("loadDashboard:", e); }
    setDataLoading(false);
  };

  // ── Login ──
  const handleLogin = async () => {
    if (!loginUser.trim() || !loginPass.trim()) { setLoginError("Username and password are required."); return; }
    setLoginLoading(true); setLoginError("");
    try {
      const snap = await getDoc(supCredRef(userId));
      if (!snap.exists()) { setLoginError("No supervisor account found. Please register first."); setLoginLoading(false); return; }
      const stored = snap.data();
      if (stored.username.toLowerCase() !== loginUser.trim().toLowerCase()) {
        setLoginError("Username or password incorrect."); setLoginLoading(false); return;
      }
      const hash = await hashPassword(loginPass);
      if (hash !== stored.passwordHash) { setLoginError("Username or password incorrect."); setLoginLoading(false); return; }
      const profSnap = await getDoc(supProfRef(userId));
      setMyName(profSnap.exists() ? profSnap.data().name || "" : "");
      setLoginLoading(false);
      setStep("sup_dashboard");
      loadDashboard();
    } catch(e) {
      setLoginError("Login failed: " + (e?.message || "unknown error"));
      setLoginLoading(false);
    }
  };

  // ── Register ──
  const handleRegister = async () => {
    if (!reg.name.trim() || !reg.username.trim()) { setRegError("Name and username are required."); return; }
    if (reg.password.length < 6) { setRegError("Password must be at least 6 characters."); return; }
    if (reg.password !== reg.password2) { setRegError("Passwords do not match."); return; }
    setRegLoading(true); setRegError("");
    try {
      const existing = await getDoc(supCredRef(userId));
      if (existing.exists() && existing.data().username.toLowerCase() === reg.username.trim().toLowerCase()) {
        setRegError("Username already taken."); setRegLoading(false); return;
      }
      const hash = await hashPassword(reg.password);
      await setDoc(supCredRef(userId), { username: reg.username.trim(), passwordHash: hash, createdAt: new Date().toISOString() });
      await setDoc(supProfRef(userId), { name: reg.name, phone: reg.phone, institution: reg.institution, rmRoster: [], createdAt: new Date().toISOString() });
      setMyName(reg.name);
      setRegSuccess(true);
    } catch(e) {
      setRegError("Registration failed: " + (e?.message || "unknown error"));
    }
    setRegLoading(false);
  };

  // ── RM Roster management ──
  const saveRoster = async (newRoster) => {
    setRmRoster(newRoster);
    await setDoc(supProfRef(userId), { rmRoster: newRoster }, { merge:true });
  };

  const handleAddRm = async () => {
    if (!rmForm.name.trim()) { setRmFormError("Name is required."); return; }
    setRmFormError("");
    const newRm = { ...rmForm, txIds: [] };
    let newRoster;
    if (editRmIdx !== null) {
      newRoster = rmRoster.map((r,i) => i === editRmIdx ? { ...r, ...newRm } : r);
    } else {
      newRoster = [...rmRoster, newRm];
    }
    await saveRoster(newRoster);
    setAddRmOpen(false); setEditRmIdx(null); setRmForm(EMPTY_RM);
    showToast(editRmIdx !== null ? "RM updated." : "RM added to roster.");
  };

  const handleRemoveRm = async (idx) => {
    if (!window.confirm(`Remove ${rmRoster[idx].name} from the roster?`)) return;
    await saveRoster(rmRoster.filter((_,i) => i !== idx));
    showToast("RM removed from roster.");
  };

  // ── Assign RM ──
  const handleAssign = async (item, rm) => {
    try {
      const rmContact = { name: rm.name, phone: rm.phone || "", whatsapp: rm.phone || "" };

      // 1. Update the transaction doc's rmContact
      if (item.txId) {
        await setDoc(txDocRef(userId, item.txId, item.persona), { rmContact }, { merge:true });
      }

      // 2. Add txId to RM's txIds in re_profile/rm
      if (item.txId) {
        const rmSnap = await getDoc(rmProfRef(userId));
        const existing = rmSnap.exists() ? (rmSnap.data().txIds || []) : [];
        const merged = existing.includes(item.txId) ? existing : [...existing, item.txId];
        await setDoc(rmProfRef(userId), { txIds: merged }, { merge:true });
      }

      // 3. Also update rmRoster entry's txIds
      const updatedRoster = rmRoster.map((r, i) => {
        if (r.username === rm.username && r.name === rm.name) {
          const rIds = r.txIds || [];
          return { ...r, txIds: rIds.includes(item.txId) ? rIds : [...rIds, item.txId] };
        }
        return r;
      });
      await saveRoster(updatedRoster);

      // 4. Mark unassigned item as assigned
      await setDoc(
        doc(db, "users", userId, "re_unassigned", item.id),
        { assignedRm: rm.name, assignedAt: new Date().toISOString() },
        { merge:true }
      );

      // Update local state
      setUnassigned(prev => prev.filter(i => i.id !== item.id));
      setAssigned(prev => [{ ...item, assignedRm: rm.name, assignedAt: new Date().toISOString() }, ...prev]);

      showToast(`${item.name} assigned to ${rm.name} ✓`);
    } catch(e) {
      console.error("Assign error:", e);
      showToast("Assignment failed: " + (e?.message || "error"), false);
    }
  };

  // ── Auth screens ──────────────────────────────────────────────────────────────
  if (step === "sup_login") {
    return (
      <div style={{ minHeight:"100%", background:C.mist, overflowY:"auto", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono&display=swap');
          .sup-card { background:#fff; border-radius:14px; border:1px solid ${C.border}; padding:clamp(28px,4vw,48px) clamp(24px,4vw,44px); width:100%; max-width:420px; box-shadow:0 4px 24px rgba(0,0,0,0.07); }
          .sup-input { width:100%; padding:clamp(11px,1.3vw,14px) 14px; font-size:clamp(14px,1.4vw,16px); border-radius:8px; outline:none; font-family:inherit; box-sizing:border-box; transition:border-color 0.2s; }
          .sup-btn   { width:100%; padding:clamp(13px,1.5vw,16px); font-size:clamp(14px,1.5vw,16px); font-weight:700; border:none; border-radius:10px; cursor:pointer; font-family:inherit; }
        `}</style>
        <div className="sup-card">
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
            <span style={{ fontSize:"clamp(28px,4vw,40px)" }}>🏢</span>
            <div>
              <div style={{ fontSize:"clamp(10px,1vw,11px)", fontWeight:700, color:C.hint, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>Relationship Supervisor</div>
              <h2 style={{ fontSize:"clamp(18px,2.5vw,26px)", fontWeight:700, color:C.navy }}>Sign in</h2>
            </div>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:"clamp(10px,1vw,12px)", fontWeight:700, color:C.slate, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>Username</label>
            <input className="sup-input" type="text" value={loginUser} autoFocus autoComplete="username"
              onChange={e => setLoginUser(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="supervisor username"
              style={{ border:`1.5px solid ${loginUser ? C.blue : C.border}`, background: loginUser ? C.pale : "#fff", color:C.navy }} />
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ display:"block", fontSize:"clamp(10px,1vw,12px)", fontWeight:700, color:C.slate, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>Password</label>
            <div style={{ position:"relative" }}>
              <input className="sup-input" type={showPass ? "text" : "password"} value={loginPass}
                onChange={e => setLoginPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                style={{ border:`1.5px solid ${loginPass ? C.blue : C.border}`, background: loginPass ? C.pale : "#fff", color:C.navy, paddingRight:44 }} />
              <button onClick={() => setShowPass(v => !v)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:C.hint, fontSize:14 }}>{showPass ? "🙈" : "👁"}</button>
            </div>
          </div>
          {loginError && <div style={{ padding:"9px 12px", background:C.redBg, border:`1px solid ${C.redBorder}`, borderRadius:7, fontSize:"clamp(12px,1.1vw,13px)", color:C.red, marginBottom:14 }}>{loginError}</div>}
          <button disabled={loginLoading} onClick={handleLogin} className="sup-btn"
            style={{ color:"#fff", background: loginLoading ? C.hint : C.navy, cursor: loginLoading ? "not-allowed" : "pointer", marginBottom:16 }}>
            {loginLoading ? "Signing in…" : "Sign In →"}
          </button>
          <div style={{ paddingTop:16, borderTop:`1px solid ${C.border}`, textAlign:"center" }}>
            <div style={{ fontSize:"clamp(12px,1.2vw,14px)", color:C.slate, marginBottom:10 }}>First time? Create supervisor account.</div>
            <button onClick={() => { setReg(EMPTY_REG); setRegError(""); setRegSuccess(false); setStep("sup_register"); }}
              style={{ fontSize:"clamp(13px,1.3vw,15px)", fontWeight:700, color:C.navy, background:"none", border:`1.5px solid ${C.navy}`, borderRadius:8, padding:"9px 22px", cursor:"pointer", fontFamily:"inherit" }}>
              Create Account →
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "sup_register") {
    return (
      <div style={{ minHeight:"100%", background:C.mist, overflowY:"auto", fontFamily:"'DM Sans',sans-serif" }}>
        <style>{`
          .sup-reg-wrap { padding:clamp(28px,5vw,56px) clamp(24px,8vw,100px); max-width:600px; margin:0 auto; }
          .sup-reg-label { display:block; font-size:clamp(10px,1vw,12px); font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:5px; }
          .sup-reg-input { width:100%; padding:clamp(10px,1.2vw,13px) 13px; font-size:clamp(13px,1.3vw,15px); border-radius:8px; outline:none; font-family:inherit; box-sizing:border-box; transition:border-color 0.2s; }
          .sup-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
          @media(max-width:520px){ .sup-grid { grid-template-columns:1fr; } }
        `}</style>
        <div className="sup-reg-wrap">
          <button onClick={() => setStep("sup_login")} style={{ fontSize:"clamp(12px,1.2vw,14px)", color:C.navy, background:"none", border:"none", cursor:"pointer", marginBottom:24, display:"flex", alignItems:"center", gap:6, fontFamily:"inherit", padding:0, fontWeight:500 }}>
            ← Back to Sign In
          </button>
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:"clamp(10px,1vw,12px)", fontWeight:700, color:C.hint, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>🏢 New Supervisor</div>
            <h2 style={{ fontSize:"clamp(22px,3vw,30px)", fontWeight:700, color:C.navy, marginBottom:6 }}>Create supervisor account</h2>
            <p style={{ fontSize:"clamp(13px,1.3vw,15px)", color:C.slate, lineHeight:1.6 }}>Manage your RM team, assign deals, and track the full pipeline across all three parties.</p>
          </div>
          {regSuccess ? (
            <div style={{ background:C.greenBg, border:`2px solid ${C.greenBorder}`, borderRadius:12, padding:"28px 32px", textAlign:"center" }}>
              <div style={{ fontSize:36, marginBottom:10 }}>🎉</div>
              <div style={{ fontSize:"clamp(15px,1.6vw,18px)", fontWeight:700, color:C.green, marginBottom:10 }}>Account created!</div>
              <div style={{ fontSize:"clamp(13px,1.3vw,15px)", color:C.green, marginBottom:20 }}>Welcome, {myName}.</div>
              <button onClick={() => { setStep("sup_dashboard"); loadDashboard(); }}
                style={{ fontSize:"clamp(14px,1.4vw,16px)", fontWeight:700, color:"#fff", background:C.green, border:"none", borderRadius:8, padding:"12px 28px", cursor:"pointer", fontFamily:"inherit" }}>
                Open Dashboard →
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize:"clamp(11px,1vw,12px)", fontWeight:700, color:C.blue, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>Personal Details</div>
              <div className="sup-grid" style={{ marginBottom:14 }}>
                <div style={{ marginBottom:14, gridColumn:"1/-1" }}>
                  <label className="sup-reg-label">Full Name *</label>
                  <input className="sup-reg-input" type="text" value={reg.name} placeholder="e.g. Suresh Iyer"
                    onChange={e => setReg(p => ({...p, name:e.target.value}))}
                    style={{ border:`1.5px solid ${reg.name ? C.blue : C.border}`, background: reg.name ? C.pale : "#fff", color:C.navy }} />
                </div>
                <div style={{ marginBottom:14 }}>
                  <label className="sup-reg-label">Phone</label>
                  <input className="sup-reg-input" type="tel" value={reg.phone} placeholder="+91 98400 XXXXX"
                    onChange={e => setReg(p => ({...p, phone:e.target.value}))}
                    style={{ border:`1.5px solid ${reg.phone ? C.blue : C.border}`, background: reg.phone ? C.pale : "#fff", color:C.navy }} />
                </div>
                <div style={{ marginBottom:14 }}>
                  <label className="sup-reg-label">Institution</label>
                  <input className="sup-reg-input" type="text" value={reg.institution} placeholder="e.g. PropTrack Realty"
                    onChange={e => setReg(p => ({...p, institution:e.target.value}))}
                    style={{ border:`1.5px solid ${reg.institution ? C.blue : C.border}`, background: reg.institution ? C.pale : "#fff", color:C.navy }} />
                </div>
              </div>
              <hr style={{ border:"none", borderTop:`1px solid ${C.border}`, margin:"4px 0 16px" }} />
              <div style={{ fontSize:"clamp(11px,1vw,12px)", fontWeight:700, color:C.blue, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>Login Credentials</div>
              <div className="sup-grid" style={{ marginBottom:14 }}>
                <div style={{ gridColumn:"1/-1", marginBottom:14 }}>
                  <label className="sup-reg-label">Username *</label>
                  <input className="sup-reg-input" type="text" value={reg.username} placeholder="e.g. suresh_sup" autoComplete="new-username"
                    onChange={e => setReg(p => ({...p, username:e.target.value}))}
                    style={{ border:`1.5px solid ${reg.username ? C.blue : C.border}`, background: reg.username ? C.pale : "#fff", color:C.navy }} />
                </div>
                <div style={{ marginBottom:14 }}>
                  <label className="sup-reg-label">Password * <span style={{ fontWeight:400, textTransform:"none" }}>(min 6)</span></label>
                  <div style={{ position:"relative" }}>
                    <input className="sup-reg-input" type={showPass ? "text" : "password"} value={reg.password} placeholder="••••••••" autoComplete="new-password"
                      onChange={e => setReg(p => ({...p, password:e.target.value}))}
                      style={{ border:`1.5px solid ${reg.password ? C.blue : C.border}`, background: reg.password ? C.pale : "#fff", color:C.navy, paddingRight:40 }} />
                    <button onClick={() => setShowPass(v => !v)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:C.hint, fontSize:13 }}>{showPass ? "🙈" : "👁"}</button>
                  </div>
                </div>
                <div style={{ marginBottom:14 }}>
                  <label className="sup-reg-label">Confirm Password *</label>
                  <input className="sup-reg-input" type={showPass ? "text" : "password"} value={reg.password2} placeholder="••••••••" autoComplete="new-password"
                    onChange={e => setReg(p => ({...p, password2:e.target.value}))}
                    style={{ border:`1.5px solid ${reg.password2 ? (reg.password2 === reg.password ? "#22C55E" : "#EF4444") : C.border}`, background: reg.password2 ? (reg.password2 === reg.password ? C.greenBg : C.redBg) : "#fff", color:C.navy }} />
                </div>
              </div>
              {regError && <div style={{ padding:"9px 12px", background:C.redBg, border:`1px solid ${C.redBorder}`, borderRadius:7, fontSize:"clamp(12px,1.1vw,13px)", color:C.red, marginBottom:14 }}>{regError}</div>}
              <button disabled={regLoading} onClick={handleRegister}
                style={{ width:"100%", padding:"clamp(13px,1.5vw,16px)", fontSize:"clamp(14px,1.5vw,16px)", fontWeight:700, color:"#fff", background: regLoading ? C.hint : C.navy, border:"none", borderRadius:10, cursor: regLoading ? "not-allowed" : "pointer", fontFamily:"inherit" }}>
                {regLoading ? "Creating account…" : "Create Supervisor Account →"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:0, flex:1, fontFamily:"'DM Sans',sans-serif", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono&display=swap');
        .sup-main { flex:1; overflow-y:auto; padding:clamp(20px,3vw,36px) clamp(20px,4vw,48px) 60px; background:#F0F4FF; }
        .sup-col-header { font-size:clamp(12px,1.2vw,14px); font-weight:700; color:${C.navy}; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; }
        .sup-empty { text-align:center; padding:32px 16px; color:${C.hint}; font-size:clamp(12px,1.2vw,13px); font-style:italic; border:1.5px dashed ${C.border}; border-radius:12px; }
        .sup-assigned-row { display:flex; align-items:center; gap:10px; padding:10px 14px; background:#fff; border-radius:8px; border:1px solid ${C.border}; margin-bottom:8px; }
      `}</style>

      {/* Header */}
      <div style={{ background:C.navy, padding:"clamp(12px,1.5vw,18px) clamp(20px,4vw,48px)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:"clamp(22px,2.5vw,30px)" }}>🏢</span>
          <div>
            <div style={{ fontSize:"clamp(10px,1vw,12px)", color:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:"0.06em" }}>Relationship Supervisor</div>
            <div style={{ fontSize:"clamp(14px,1.6vw,18px)", fontWeight:700, color:"#fff" }}>{myName || "Supervisor Dashboard"}</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {/* Summary pills */}
          <div style={{ display:"flex", gap:8 }}>
            {[
              { label:"Pending", count:unassigned.length, bg:"#FEF3C7", color:C.amber },
              { label:"RMs",     count:rmRoster.length,   bg:C.pale,    color:C.blue  },
              { label:"Assigned", count:assigned.length,  bg:C.greenBg, color:C.green },
            ].map(({ label, count, bg, color }) => (
              <div key={label} style={{ background:bg, border:`1px solid rgba(0,0,0,0.08)`, borderRadius:20, padding:"4px 12px", display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ fontSize:"clamp(14px,1.5vw,17px)", fontWeight:700, color }}>{count}</span>
                <span style={{ fontSize:"clamp(9px,0.9vw,11px)", color, fontWeight:500 }}>{label}</span>
              </div>
            ))}
          </div>
          <button onClick={() => { setStep("sup_login"); }}
            style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", color:"rgba(255,255,255,0.7)", borderRadius:6, padding:"5px 12px", cursor:"pointer", fontSize:"clamp(11px,1.1vw,13px)", fontFamily:"inherit" }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", top:20, right:24, zIndex:9999, padding:"12px 20px", borderRadius:8, background: toast.ok ? "#15803D" : C.red, color:"#fff", fontSize:"clamp(12px,1.2vw,14px)", fontWeight:600, boxShadow:"0 4px 20px rgba(0,0,0,0.2)", fontFamily:"'DM Sans',sans-serif" }}>
          {toast.msg}
        </div>
      )}

      <div className="sup-main">
        {dataLoading ? (
          <div style={{ textAlign:"center", padding:"48px", color:C.hint, fontSize:"clamp(13px,1.3vw,15px)" }}>Loading dashboard…</div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:clamp(16,28), alignItems:"start" }}
            ref={el => el && (el.style.gap = "clamp(16px,2vw,28px)")}>

            {/* ── LEFT: Unassigned Inbox ── */}
            <div>
              <div className="sup-col-header">
                <span>📬 Unassigned Inbox</span>
                <span style={{ fontSize:"clamp(10px,1vw,12px)", fontWeight:400, color:C.hint }}>{unassigned.length} pending</span>
              </div>
              {unassigned.length === 0 ? (
                <div className="sup-empty">No unassigned transactions.<br/>New seller/buyer registrations will appear here.</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {unassigned.map(item => (
                    <UnassignedCard key={item.id} item={item} rmRoster={rmRoster} onAssign={handleAssign} />
                  ))}
                </div>
              )}

              {/* Recently assigned */}
              {assigned.length > 0 && (
                <div style={{ marginTop:28 }}>
                  <div className="sup-col-header">
                    <span>✅ Recently Assigned</span>
                    <span style={{ fontSize:"clamp(10px,1vw,12px)", fontWeight:400, color:C.hint }}>{assigned.length} total</span>
                  </div>
                  {assigned.slice(0,5).map(item => {
                    const meta = PERSONA_META[item.persona] || PERSONA_META.seller;
                    return (
                      <div key={item.id} className="sup-assigned-row">
                        <span style={{ fontSize:16 }}>{meta.icon}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:"clamp(12px,1.2vw,14px)", fontWeight:600, color:C.navy, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.name}</div>
                          <div style={{ fontSize:"clamp(10px,1vw,11px)", color:C.hint }}>{item.txId || "—"}</div>
                        </div>
                        <div style={{ textAlign:"right", flexShrink:0 }}>
                          <div style={{ fontSize:"clamp(11px,1.1vw,12px)", fontWeight:600, color:C.green }}>→ {item.assignedRm}</div>
                          <div style={{ fontSize:"clamp(9px,0.9vw,10px)", color:C.hint }}>{timeAgo(item.assignedAt)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── RIGHT: RM Roster ── */}
            <div>
              <div className="sup-col-header">
                <span>👔 RM Roster</span>
                <button onClick={() => { setAddRmOpen(true); setEditRmIdx(null); setRmForm(EMPTY_RM); setRmFormError(""); }}
                  style={{ padding:"5px 14px", background:C.blue, color:"#fff", border:"none", borderRadius:7, cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:"clamp(11px,1.1vw,13px)" }}>
                  + Add RM
                </button>
              </div>
              {rmRoster.length === 0 ? (
                <div className="sup-empty">No RMs added yet.<br/>Click "+ Add RM" to build your team.</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {rmRoster.map((rm, i) => (
                    <RmCard key={i} rm={rm}
                      onEdit={() => { setEditRmIdx(i); setRmForm({ name:rm.name||"", phone:rm.phone||"", institution:rm.institution||"", username:rm.username||"" }); setAddRmOpen(true); setRmFormError(""); }}
                      onRemove={() => handleRemoveRm(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Add/Edit RM Modal ── */}
      {addRmOpen && (
        <div onClick={e => e.target === e.currentTarget && setAddRmOpen(false)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:"#fff", borderRadius:14, padding:"28px 32px", maxWidth:460, width:"100%", boxShadow:"0 8px 40px rgba(0,0,0,0.25)", fontFamily:"'DM Sans',sans-serif" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div style={{ fontSize:"clamp(14px,1.5vw,17px)", fontWeight:700, color:C.navy }}>
                {editRmIdx !== null ? "Edit Relationship Manager" : "Add Relationship Manager"}
              </div>
              <button onClick={() => setAddRmOpen(false)} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.hint }}>×</button>
            </div>
            {[
              ["name",        "Full Name *",    "text", "e.g. Priya Krishnamurthy"],
              ["phone",       "Phone",          "tel",  "+91 98400 XXXXX"],
              ["institution", "Institution",    "text", "e.g. PropTrack Realty"],
              ["username",    "Username (for RM portal)", "text", "e.g. priya_rm"],
            ].map(([field, lbl, type, ph]) => (
              <div key={field} style={{ marginBottom:14 }}>
                <label style={{ display:"block", fontSize:"clamp(10px,1vw,12px)", fontWeight:700, color:C.slate, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:5 }}>{lbl}</label>
                <input type={type} value={rmForm[field]} placeholder={ph}
                  onChange={e => setRmForm(p => ({...p, [field]: e.target.value}))}
                  style={{ width:"100%", padding:"10px 13px", fontSize:"clamp(13px,1.3vw,15px)", border:`1.5px solid ${rmForm[field] ? C.blue : C.border}`, borderRadius:8, outline:"none", fontFamily:"inherit", background: rmForm[field] ? C.pale : "#fff", color:C.navy, boxSizing:"border-box" }} />
              </div>
            ))}
            {rmFormError && <div style={{ padding:"9px 12px", background:C.redBg, border:`1px solid ${C.redBorder}`, borderRadius:7, fontSize:"clamp(12px,1.1vw,13px)", color:C.red, marginBottom:14 }}>{rmFormError}</div>}
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={handleAddRm}
                style={{ flex:1, padding:"11px", fontSize:"clamp(13px,1.3vw,15px)", fontWeight:700, color:"#fff", background:C.blue, border:"none", borderRadius:8, cursor:"pointer", fontFamily:"inherit" }}>
                {editRmIdx !== null ? "Save Changes" : "Add to Roster"}
              </button>
              <button onClick={() => setAddRmOpen(false)}
                style={{ padding:"11px 18px", fontSize:"clamp(12px,1.2vw,14px)", color:C.slate, background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, cursor:"pointer", fontFamily:"inherit" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// tiny helper to avoid CSS clamp in JS
function clamp(min, max) { return `${min}px`; }
