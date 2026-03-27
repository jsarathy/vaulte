// src/RMDashboard.jsx — Relationship Manager Portal
import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { doc, setDoc, getDoc, getDocs, collection } from "firebase/firestore";
import RealEstateLifecycle from "./RealEstateLifecycle";

// ── Constants ──────────────────────────────────────────────────────────────────
const ITEM_TOTALS = { seller: 36, buyer: 43, lender: 22 };

const PERSONA_META = {
  seller: { icon:"🏠", label:"Seller",  color:"#1558C0", bg:"#EEF4FF", border:"#D9E8FF" },
  buyer:  { icon:"🔑", label:"Buyer",   color:"#7C3AED", bg:"#F5F3FF", border:"#DDD6FE" },
  lender: { icon:"🏦", label:"Lender",  color:"#1E6B35", bg:"#F0FDF4", border:"#BBF7D0" },
};

const C = {
  navy:"#0D1B2A", blue:"#1558C0", blueLt:"#3B76D4",
  pale:"#EEF4FF", pale2:"#D9E8FF", border:"#E2E8F0",
  slate:"#475569", mist:"#F8FAFC", white:"#FFFFFF",
  text:"#1E293B", hint:"#94A3B8",
};

// ── Firestore helpers ──────────────────────────────────────────────────────────
async function hashPassword(password) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(password));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

function rmCredRef(uid)  { return doc(db, "users", uid, "re_credentials", "rm"); }
function rmProfRef(uid)  { return doc(db, "users", uid, "re_profile",     "rm"); }
function txRef(uid, txId, persona) {
  return doc(db, "users", uid, "re_transactions", `${txId}_${persona}`);
}

// ── DealCard ──────────────────────────────────────────────────────────────────
function ProgressBar({ validated, total, color }) {
  const pct = total > 0 ? Math.round(validated / total * 100) : 0;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
      <div style={{ flex:1, height:6, background:"#E2E8F0", borderRadius:3, overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:3, transition:"width 0.4s" }} />
      </div>
      <span style={{ fontSize:"clamp(10px,1vw,12px)", fontFamily:"'DM Mono',monospace", color:C.slate, flexShrink:0, minWidth:44, textAlign:"right" }}>
        {validated}/{total}
      </span>
      <span style={{ fontSize:"clamp(10px,1vw,11px)", color:C.hint, flexShrink:0, minWidth:30 }}>{pct}%</span>
    </div>
  );
}

function DealCard({ txId, userId, onViewChecklist }) {
  const [details, setDetails]   = useState(null);
  const [progress, setProgress] = useState({ seller:0, buyer:0, lender:0 });
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Load seller doc for property address
        const sellerSnap  = await getDoc(txRef(userId, txId, "seller"));
        const buyerSnap   = await getDoc(txRef(userId, txId, "buyer"));
        const lenderSnap  = await getDoc(txRef(userId, txId, "lender"));
        const sellerData  = sellerSnap.exists() ? sellerSnap.data() : {};
        const buyerData   = buyerSnap.exists()  ? buyerSnap.data()  : {};
        const lenderData  = lenderSnap.exists() ? lenderSnap.data() : {};

        const address = sellerData.sellerProfile?.propertyAddress
          || buyerData.buyerProfile?.propertyAddress
          || "Address not on record yet.";
        const status  = sellerData.status || buyerData.status || "active";
        const sellerName = sellerData.myContact?.name || null;
        const buyerName  = buyerData.myContact?.name  || null;
        const lenderName = lenderData.myContact?.name || null;

        const countValidated = (items) =>
          Object.values(items || {}).filter(v => v?.status === "validated").length;

        setDetails({ address, status, sellerName, buyerName, lenderName });
        setProgress({
          seller: countValidated(sellerData.items),
          buyer:  countValidated(buyerData.items),
          lender: countValidated(lenderData.items),
        });
      } catch(e) { console.error("DealCard load error:", e); }
      setLoading(false);
    })();
  }, [txId, userId]);

  const overallPct = details ? Math.round(
    (progress.seller + progress.buyer + progress.lender) /
    (ITEM_TOTALS.seller + ITEM_TOTALS.buyer + ITEM_TOTALS.lender) * 100
  ) : 0;

  return (
    <div style={{
      background:"#fff", borderRadius:14, border:`1px solid ${C.border}`,
      boxShadow:"0 2px 12px rgba(0,0,0,0.06)", overflow:"hidden",
      transition:"box-shadow 0.2s",
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow="0 6px 24px rgba(0,0,0,0.1)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,0.06)"}
    >
      {/* Card header */}
      <div style={{ background:C.navy, padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"clamp(13px,1.4vw,16px)", fontWeight:700, color:"#fff", marginBottom:4 }}>{txId}</div>
          {!loading && details && (
            <div style={{ fontSize:"clamp(10px,1vw,12px)", color:"rgba(255,255,255,0.6)", lineHeight:1.4, maxWidth:260 }}>{details.address}</div>
          )}
        </div>
        {!loading && details && (
          <span style={{
            flexShrink:0, fontSize:"clamp(9px,0.9vw,11px)", fontWeight:600,
            padding:"3px 10px", borderRadius:20, marginLeft:10,
            background: details.status === "sold" ? "#FEF3C7" : "#F0FDF4",
            color: details.status === "sold" ? "#92400E" : "#15803D",
            border: `1px solid ${details.status === "sold" ? "#F59E0B" : "#22C55E"}`,
          }}>
            {details.status === "sold" ? "⚠️ Sold" : "✓ Active"}
          </span>
        )}
      </div>

      {/* Overall progress strip */}
      {!loading && (
        <div style={{ height:4, background:"#E2E8F0" }}>
          <div style={{ width:`${overallPct}%`, height:"100%", background:"linear-gradient(90deg,#34D399,#10B981)", transition:"width 0.4s" }} />
        </div>
      )}

      {/* Progress rows */}
      <div style={{ padding:"16px 18px" }}>
        {loading ? (
          <div style={{ textAlign:"center", padding:"16px 0", color:C.hint, fontSize:"clamp(12px,1.2vw,13px)" }}>Loading…</div>
        ) : (
          <>
            {(["seller","buyer","lender"]).map(p => {
              const meta = PERSONA_META[p];
              const val  = progress[p];
              const tot  = ITEM_TOTALS[p];
              const name = details?.[`${p}Name`];
              return (
                <div key={p} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:14 }}>{meta.icon}</span>
                      <span style={{ fontSize:"clamp(11px,1.1vw,13px)", fontWeight:600, color:C.navy }}>{meta.label}</span>
                      {name && <span style={{ fontSize:"clamp(9px,0.9vw,11px)", color:C.hint }}>· {name}</span>}
                    </div>
                    <button
                      onClick={() => onViewChecklist(txId, p)}
                      style={{
                        padding:"3px 10px", borderRadius:6,
                        border:`1px solid ${meta.color}`, background:meta.bg,
                        color:meta.color, cursor:"pointer", fontFamily:"inherit",
                        fontSize:"clamp(9px,0.9vw,11px)", fontWeight:700,
                        transition:"all 0.15s", whiteSpace:"nowrap",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background=meta.color; e.currentTarget.style.color="#fff"; }}
                      onMouseLeave={e => { e.currentTarget.style.background=meta.bg; e.currentTarget.style.color=meta.color; }}
                    >
                      View →
                    </button>
                  </div>
                  <ProgressBar validated={val} total={tot} color={meta.color} />
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function RMDashboard({ userId }) {
  const [step, setStep]         = useState("rm_login"); // rm_login | rm_register | rm_dashboard | rm_checklist
  const [myName, setMyName]     = useState("");
  const [txIds, setTxIds]       = useState([]);
  const [showPass, setShowPass] = useState(false);

  // Login state
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Register state
  const EMPTY_REG = { name:"", phone:"", institution:"", username:"", password:"", password2:"" };
  const [reg, setReg]         = useState(EMPTY_REG);
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);

  // Dashboard state
  const [addTxInput, setAddTxInput] = useState("");
  const [addTxLoading, setAddTxLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Checklist view state
  const [viewPersona, setViewPersona] = useState(null);
  const [viewTxId, setViewTxId]       = useState(null);

  // ── Handlers ──
  const handleLogin = async () => {
    if (!loginUser.trim() || !loginPass.trim()) { setLoginError("Username and password are required."); return; }
    setLoginLoading(true); setLoginError("");
    try {
      const snap = await getDoc(rmCredRef(userId));
      if (!snap.exists()) { setLoginError("No RM account found. Please register first."); setLoginLoading(false); return; }
      const stored = snap.data();
      if (stored.username.toLowerCase() !== loginUser.trim().toLowerCase()) {
        setLoginError("Username or password incorrect."); setLoginLoading(false); return;
      }
      const hash = await hashPassword(loginPass);
      if (hash !== stored.passwordHash) { setLoginError("Username or password incorrect."); setLoginLoading(false); return; }
      const profSnap = await getDoc(rmProfRef(userId));
      const profData = profSnap.exists() ? profSnap.data() : {};
      setMyName(profData.name || "");
      setTxIds(profData.txIds || []);
      setLoginLoading(false);
      setStep("rm_dashboard");
    } catch(e) {
      console.error("RM login error:", e);
      setLoginError("Login failed: " + (e?.message || "unknown error"));
      setLoginLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!reg.name.trim() || !reg.username.trim()) { setRegError("Name and username are required."); return; }
    if (reg.password.length < 6) { setRegError("Password must be at least 6 characters."); return; }
    if (reg.password !== reg.password2) { setRegError("Passwords do not match."); return; }
    setRegLoading(true); setRegError("");
    try {
      const existing = await getDoc(rmCredRef(userId));
      if (existing.exists() && existing.data().username.toLowerCase() === reg.username.trim().toLowerCase()) {
        setRegError("Username already taken."); setRegLoading(false); return;
      }
      const hash = await hashPassword(reg.password);
      await setDoc(rmCredRef(userId), { username: reg.username.trim(), passwordHash: hash, createdAt: new Date().toISOString() });
      await setDoc(rmProfRef(userId), { name: reg.name, phone: reg.phone, institution: reg.institution, txIds: [], createdAt: new Date().toISOString() });
      setMyName(reg.name);
      setTxIds([]);
      setRegSuccess(true);
    } catch(e) {
      console.error("RM register error:", e);
      setRegError("Registration failed: " + (e?.message || "unknown error"));
    }
    setRegLoading(false);
  };

  const handleAddTx = async () => {
    const id = addTxInput.trim().toUpperCase();
    if (!id || txIds.includes(id)) { setAddTxInput(""); return; }
    setAddTxLoading(true);
    try {
      const merged = [...txIds, id];
      await setDoc(rmProfRef(userId), { txIds: merged }, { merge:true });
      setTxIds(merged);
      setAddTxInput("");
    } catch(e) { console.error("Add TX error:", e); }
    setAddTxLoading(false);
  };

  const handleRemoveTx = async (id) => {
    if (!window.confirm(`Remove ${id} from your deal board?`)) return;
    const merged = txIds.filter(t => t !== id);
    await setDoc(rmProfRef(userId), { txIds: merged }, { merge:true });
    setTxIds(merged);
  };

  // ── Checklist view ──
  if (step === "rm_checklist") {
    return (
      <RealEstateLifecycle
        userId={userId}
        rmPersona={viewPersona}
        rmTxId={viewTxId}
        onRmBack={() => { setViewPersona(null); setViewTxId(null); setStep("rm_dashboard"); }}
      />
    );
  }

  // ── Login ──
  if (step === "rm_login") {
    return (
      <div style={{ minHeight:"100%", background:C.mist, overflowY:"auto", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono&display=swap');
          .rm-card { background:#fff; border-radius:14px; border:1px solid ${C.border}; padding:clamp(28px,4vw,48px) clamp(24px,4vw,44px); width:100%; max-width:420px; box-shadow:0 4px 24px rgba(0,0,0,0.07); }
          .rm-input { width:100%; padding:clamp(11px,1.3vw,14px) 14px; font-size:clamp(14px,1.4vw,16px); border-radius:8px; outline:none; font-family:inherit; box-sizing:border-box; transition:border-color 0.2s; }
          .rm-btn   { width:100%; padding:clamp(13px,1.5vw,16px); font-size:clamp(14px,1.5vw,16px); font-weight:700; border:none; border-radius:10px; cursor:pointer; font-family:inherit; }
        `}</style>
        <div className="rm-card">
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
            <span style={{ fontSize:"clamp(28px,4vw,40px)" }}>👔</span>
            <div>
              <div style={{ fontSize:"clamp(10px,1vw,11px)", fontWeight:700, color:C.hint, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>Relationship Manager</div>
              <h2 style={{ fontSize:"clamp(18px,2.5vw,26px)", fontWeight:700, color:C.navy }}>Sign in</h2>
            </div>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:"clamp(10px,1vw,12px)", fontWeight:700, color:C.slate, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>Username</label>
            <input className="rm-input" type="text" value={loginUser} autoFocus autoComplete="username"
              onChange={e => setLoginUser(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="your username"
              style={{ border:`1.5px solid ${loginUser ? C.blue : C.border}`, background: loginUser ? C.pale : "#fff", color:C.navy }} />
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ display:"block", fontSize:"clamp(10px,1vw,12px)", fontWeight:700, color:C.slate, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>Password</label>
            <div style={{ position:"relative" }}>
              <input className="rm-input" type={showPass ? "text" : "password"} value={loginPass} autoComplete="current-password"
                onChange={e => setLoginPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                style={{ border:`1.5px solid ${loginPass ? C.blue : C.border}`, background: loginPass ? C.pale : "#fff", color:C.navy, paddingRight:44 }} />
              <button onClick={() => setShowPass(v => !v)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:C.hint, fontSize:14 }}>
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>
          {loginError && <div style={{ padding:"9px 12px", background:"#FEF2F2", border:"1px solid #FCA5A5", borderRadius:7, fontSize:"clamp(12px,1.1vw,13px)", color:"#991B1B", marginBottom:14 }}>{loginError}</div>}
          <button disabled={loginLoading} onClick={handleLogin} className="rm-btn"
            style={{ color:"#fff", background: loginLoading ? C.hint : C.blue, cursor: loginLoading ? "not-allowed" : "pointer", marginBottom:16 }}>
            {loginLoading ? "Signing in…" : "Sign In →"}
          </button>
          <div style={{ paddingTop:16, borderTop:`1px solid ${C.border}`, textAlign:"center" }}>
            <div style={{ fontSize:"clamp(12px,1.2vw,14px)", color:C.slate, marginBottom:10 }}>New relationship manager?</div>
            <button onClick={() => { setReg(EMPTY_REG); setRegError(""); setRegSuccess(false); setStep("rm_register"); }}
              style={{ fontSize:"clamp(13px,1.3vw,15px)", fontWeight:700, color:C.blue, background:"none", border:`1.5px solid ${C.blue}`, borderRadius:8, padding:"9px 22px", cursor:"pointer", fontFamily:"inherit" }}>
              Create Account →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Register ──
  if (step === "rm_register") {
    return (
      <div style={{ minHeight:"100%", background:C.mist, overflowY:"auto", fontFamily:"'DM Sans',sans-serif" }}>
        <style>{`
          .rm-reg-wrap { padding: clamp(28px,5vw,56px) clamp(24px,8vw,100px); max-width:620px; margin:0 auto; }
          .rm-reg-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
          @media(max-width:520px){ .rm-reg-grid { grid-template-columns:1fr; } }
          .rm-reg-label { display:block; font-size:clamp(10px,1vw,12px); font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:5px; }
          .rm-reg-input { width:100%; padding:clamp(10px,1.2vw,13px) 13px; font-size:clamp(13px,1.3vw,15px); border-radius:8px; outline:none; font-family:inherit; box-sizing:border-box; transition:border-color 0.2s, background 0.2s; }
          .rm-section   { font-size:clamp(10px,1vw,12px); font-weight:700; color:${C.blue}; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:12px; margin-top:8px; }
          .rm-rule      { border:none; border-top:1px solid ${C.border}; margin:18px 0 16px; }
        `}</style>
        <div className="rm-reg-wrap">
          <button onClick={() => setStep("rm_login")}
            style={{ fontSize:"clamp(12px,1.2vw,14px)", color:C.blue, background:"none", border:"none", cursor:"pointer", marginBottom:24, display:"flex", alignItems:"center", gap:6, fontFamily:"inherit", padding:0, fontWeight:500 }}>
            ← Back to Sign In
          </button>
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:"clamp(10px,1vw,12px)", fontWeight:700, color:C.hint, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>👔 New Relationship Manager</div>
            <h2 style={{ fontSize:"clamp(22px,3vw,30px)", fontWeight:700, color:C.navy, marginBottom:6 }}>Create your account</h2>
            <p style={{ fontSize:"clamp(13px,1.3vw,15px)", color:C.slate, lineHeight:1.6 }}>
              Register to access your full deal board — tracking seller, buyer and lender progress across all your transactions.
            </p>
          </div>

          {regSuccess ? (
            <div style={{ background:"#F0FDF4", border:"2px solid #22C55E", borderRadius:12, padding:"28px 32px", textAlign:"center" }}>
              <div style={{ fontSize:36, marginBottom:10 }}>🎉</div>
              <div style={{ fontSize:"clamp(15px,1.6vw,18px)", fontWeight:700, color:"#15803D", marginBottom:10 }}>Account created!</div>
              <div style={{ fontSize:"clamp(13px,1.3vw,15px)", color:"#166534", marginBottom:20 }}>
                Welcome, {myName}. Your deal board is ready.
              </div>
              <button onClick={() => setStep("rm_dashboard")}
                style={{ fontSize:"clamp(14px,1.4vw,16px)", fontWeight:700, color:"#fff", background:"#15803D", border:"none", borderRadius:8, padding:"12px 28px", cursor:"pointer", fontFamily:"inherit" }}>
                Open Deal Board →
              </button>
            </div>
          ) : (
            <>
              <div className="rm-section">Personal Details</div>
              <div className="rm-reg-grid" style={{ marginBottom:0 }}>
                <div style={{ marginBottom:14, gridColumn:"1 / -1" }}>
                  <label className="rm-reg-label">Full Name *</label>
                  <input className="rm-reg-input" type="text" value={reg.name} placeholder="e.g. Priya Krishnamurthy"
                    onChange={e => setReg(p => ({...p, name:e.target.value}))}
                    style={{ border:`1.5px solid ${reg.name ? C.blue : C.border}`, background: reg.name ? C.pale : "#fff", color:C.navy }} />
                </div>
                <div style={{ marginBottom:14 }}>
                  <label className="rm-reg-label">Phone</label>
                  <input className="rm-reg-input" type="tel" value={reg.phone} placeholder="+91 98400 XXXXX"
                    onChange={e => setReg(p => ({...p, phone:e.target.value}))}
                    style={{ border:`1.5px solid ${reg.phone ? C.blue : C.border}`, background: reg.phone ? C.pale : "#fff", color:C.navy }} />
                </div>
                <div style={{ marginBottom:14 }}>
                  <label className="rm-reg-label">Institution</label>
                  <input className="rm-reg-input" type="text" value={reg.institution} placeholder="e.g. PropTrack Realty"
                    onChange={e => setReg(p => ({...p, institution:e.target.value}))}
                    style={{ border:`1.5px solid ${reg.institution ? C.blue : C.border}`, background: reg.institution ? C.pale : "#fff", color:C.navy }} />
                </div>
              </div>

              <hr className="rm-rule" />
              <div className="rm-section">Login Credentials</div>
              <div className="rm-reg-grid">
                <div style={{ marginBottom:14, gridColumn:"1 / -1" }}>
                  <label className="rm-reg-label">Choose a Username *</label>
                  <input className="rm-reg-input" type="text" value={reg.username} placeholder="e.g. priya_rm" autoComplete="new-username"
                    onChange={e => setReg(p => ({...p, username:e.target.value}))}
                    style={{ border:`1.5px solid ${reg.username ? C.blue : C.border}`, background: reg.username ? C.pale : "#fff", color:C.navy }} />
                </div>
                <div style={{ marginBottom:14 }}>
                  <label className="rm-reg-label">Password * <span style={{ fontWeight:400, textTransform:"none" }}>(min 6)</span></label>
                  <div style={{ position:"relative" }}>
                    <input className="rm-reg-input" type={showPass ? "text" : "password"} value={reg.password} placeholder="••••••••" autoComplete="new-password"
                      onChange={e => setReg(p => ({...p, password:e.target.value}))}
                      style={{ border:`1.5px solid ${reg.password ? C.blue : C.border}`, background: reg.password ? C.pale : "#fff", color:C.navy, paddingRight:40 }} />
                    <button onClick={() => setShowPass(v => !v)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:C.hint, fontSize:13 }}>{showPass ? "🙈" : "👁"}</button>
                  </div>
                </div>
                <div style={{ marginBottom:14 }}>
                  <label className="rm-reg-label">Confirm Password *</label>
                  <input className="rm-reg-input" type={showPass ? "text" : "password"} value={reg.password2} placeholder="••••••••" autoComplete="new-password"
                    onChange={e => setReg(p => ({...p, password2:e.target.value}))}
                    style={{ border:`1.5px solid ${reg.password2 ? (reg.password2 === reg.password ? "#22C55E" : "#EF4444") : C.border}`, background: reg.password2 ? (reg.password2 === reg.password ? "#F0FDF4" : "#FEF2F2") : "#fff", color:C.navy }} />
                </div>
              </div>

              {regError && <div style={{ padding:"9px 12px", background:"#FEF2F2", border:"1px solid #FCA5A5", borderRadius:7, fontSize:"clamp(12px,1.1vw,13px)", color:"#991B1B", marginBottom:14 }}>{regError}</div>}
              <button disabled={regLoading} onClick={handleRegister}
                style={{ width:"100%", padding:"clamp(13px,1.5vw,16px)", fontSize:"clamp(14px,1.5vw,16px)", fontWeight:700, color:"#fff", background: regLoading ? C.hint : C.blue, border:"none", borderRadius:10, cursor: regLoading ? "not-allowed" : "pointer", fontFamily:"inherit" }}>
                {regLoading ? "Creating account…" : "Create RM Account →"}
              </button>
              <div style={{ marginTop:10, fontSize:"clamp(10px,1vw,12px)", color:C.hint, textAlign:"center" }}>* Required fields</div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Dashboard ──
  const filtered = txIds.filter(id => id.includes(searchTerm.toUpperCase()));

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:0, flex:1, fontFamily:"'DM Sans',sans-serif", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono&display=swap');
        .rm-dash-content { flex:1; overflow-y:auto; padding:clamp(20px,3vw,36px) clamp(20px,4vw,56px) 60px; background:#F8FAFC; }
        .rm-deal-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:clamp(14px,2vw,24px); }
        @media(max-width:480px){ .rm-deal-grid { grid-template-columns:1fr; } }
      `}</style>

      {/* Header */}
      <div style={{ background:C.navy, padding:"clamp(12px,1.5vw,18px) clamp(20px,4vw,56px)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:"clamp(22px,2.5vw,30px)" }}>👔</span>
          <div>
            <div style={{ fontSize:"clamp(10px,1vw,12px)", color:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:"0.06em" }}>Relationship Manager</div>
            <div style={{ fontSize:"clamp(14px,1.6vw,18px)", fontWeight:700, color:"#fff" }}>{myName || "Deal Board"}</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:20, padding:"5px 14px", fontSize:"clamp(11px,1.1vw,13px)", color:"rgba(255,255,255,0.8)", fontWeight:500 }}>
            {txIds.length} deal{txIds.length !== 1 ? "s" : ""}
          </div>
          <button onClick={() => setStep("rm_login")}
            style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", color:"rgba(255,255,255,0.7)", borderRadius:6, padding:"5px 12px", cursor:"pointer", fontSize:"clamp(11px,1.1vw,13px)", fontFamily:"inherit" }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ background:"#fff", borderBottom:`1px solid ${C.border}`, padding:"10px clamp(20px,4vw,56px)", display:"flex", alignItems:"center", gap:12, flexShrink:0, flexWrap:"wrap" }}>
        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search TX IDs…"
          style={{ flex:"1 1 180px", padding:"8px 12px", fontFamily:"'DM Mono',monospace", fontSize:"clamp(12px,1.2vw,14px)", border:`1px solid ${C.border}`, borderRadius:8, outline:"none", color:C.navy }} />
        <div style={{ display:"flex", gap:8, flex:"0 0 auto" }}>
          <input type="text" value={addTxInput} onChange={e => setAddTxInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && handleAddTx()}
            placeholder="Add TX ID…"
            style={{ padding:"8px 12px", fontFamily:"'DM Mono',monospace", fontSize:"clamp(12px,1.2vw,14px)", border:`1.5px solid ${addTxInput ? C.blue : C.border}`, borderRadius:8, outline:"none", background: addTxInput ? C.pale : "#fff", color:C.navy, width:"clamp(140px,18vw,220px)" }} />
          <button disabled={!addTxInput.trim() || addTxLoading} onClick={handleAddTx}
            style={{ padding:"8px 16px", background: addTxInput ? C.blue : C.hint, color:"#fff", border:"none", borderRadius:8, cursor: addTxInput ? "pointer" : "not-allowed", fontWeight:700, fontSize:"clamp(12px,1.2vw,14px)", fontFamily:"inherit", whiteSpace:"nowrap" }}>
            {addTxLoading ? "…" : "+ Add Deal"}
          </button>
        </div>
      </div>

      {/* Deal grid */}
      <div className="rm-dash-content">
        {txIds.length === 0 ? (
          <div style={{ textAlign:"center", padding:"64px 24px", maxWidth:480, margin:"0 auto" }}>
            <div style={{ fontSize:56, marginBottom:16 }}>📋</div>
            <div style={{ fontSize:"clamp(16px,2vw,20px)", fontWeight:700, color:C.navy, marginBottom:8 }}>No deals yet</div>
            <div style={{ fontSize:"clamp(13px,1.3vw,15px)", color:C.hint, lineHeight:1.6 }}>
              Add a Transaction ID above to start tracking a deal — you'll see Seller, Buyer and Lender progress in one place.
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"48px 24px", color:C.hint, fontSize:"clamp(13px,1.3vw,15px)" }}>
            No deals match "{searchTerm}"
          </div>
        ) : (
          <div className="rm-deal-grid">
            {filtered.map(id => (
              <div key={id} style={{ position:"relative" }}>
                <DealCard txId={id} userId={userId}
                  onViewChecklist={(txId, p) => {
                    setViewTxId(txId);
                    setViewPersona(p);
                    setStep("rm_checklist");
                  }}
                />
                {/* Remove button */}
                <button
                  onClick={() => handleRemoveTx(id)}
                  title="Remove deal"
                  style={{ position:"absolute", top:10, right:10, background:"rgba(0,0,0,0.35)", border:"none", color:"rgba(255,255,255,0.7)", borderRadius:"50%", width:22, height:22, cursor:"pointer", fontSize:11, display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
