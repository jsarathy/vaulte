import { useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser,
  updatePassword,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from "firebase/auth";
import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { auth, db, storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

const VERCEL_URL = "https://vaulte-roan.vercel.app";
const actionCodeSettings = {
  url: VERCEL_URL,
  handleCodeInApp: true,
};

// ── Helpers ──────────────────────────────────────────────────
const generateUID = () => "USR-" + Math.random().toString(36).substr(2, 9).toUpperCase();

const saveProfile = async (uid, data) => {
  await setDoc(doc(db, "users", uid), data, { merge: true });
};

const fetchProfile = async (uid) => {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
};

// ── Styles ────────────────────────────────────────────────────
const fonts = `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Cinzel:wght@400;600&display=swap');`;

const globalStyle = `
  ${fonts}
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body { background: #0d0d0f; }
  input::placeholder { color: rgba(240,234,214,0.3); }
  input:focus { border-color: rgba(212,175,55,0.8) !important; box-shadow: 0 0 0 3px rgba(212,175,55,0.08); }
  @keyframes fadeUp  { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
  @keyframes modalIn { from { opacity:0; transform:scale(0.96) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  @keyframes spin    { to { transform:rotate(360deg); } }
  .fade-up   { animation:fadeUp 0.7s ease forwards; }
  .fade-up-2 { animation:fadeUp 0.7s 0.12s ease forwards; opacity:0; }
  .fade-up-3 { animation:fadeUp 0.7s 0.24s ease forwards; opacity:0; }
  .fade-up-4 { animation:fadeUp 0.7s 0.36s ease forwards; opacity:0; }
  .modal-in  { animation:modalIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards; }
  .btn-primary { background:linear-gradient(135deg,#c9a84c,#d4af37,#b8962e); color:#0d0d0f; border:none; padding:13px 28px; font-family:'Cinzel',serif; font-size:12px; letter-spacing:2px; cursor:pointer; width:100%; border-radius:3px; font-weight:600; transition:all 0.3s; text-transform:uppercase; }
  .btn-primary:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 8px 24px rgba(212,175,55,0.3); }
  .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
  .btn-ghost { background:transparent; color:rgba(212,175,55,0.7); border:1px solid rgba(212,175,55,0.3); padding:11px 28px; font-family:'Cinzel',serif; font-size:11px; letter-spacing:2px; cursor:pointer; border-radius:3px; transition:all 0.3s; text-transform:uppercase; }
  .btn-ghost:hover { border-color:rgba(212,175,55,0.8); color:#d4af37; }
  .btn-danger { background:transparent; color:rgba(200,80,80,0.7); border:1px solid rgba(200,80,80,0.3); padding:11px 28px; font-family:'Cinzel',serif; font-size:11px; letter-spacing:2px; cursor:pointer; border-radius:3px; transition:all 0.3s; text-transform:uppercase; }
  .btn-danger:hover { border-color:rgba(200,80,80,0.8); color:#e07070; }
  .divider { display:flex; align-items:center; gap:16px; margin:20px 0; color:rgba(240,234,214,0.3); font-family:'Cormorant Garamond',serif; font-size:12px; letter-spacing:2px; }
  .divider::before,.divider::after { content:''; flex:1; height:1px; background:rgba(212,175,55,0.2); }
  .spinner { width:18px; height:18px; border:2px solid rgba(0,0,0,0.2); border-top-color:#0d0d0f; border-radius:50%; animation:spin 0.7s linear infinite; display:inline-block; vertical-align:middle; margin-right:8px; }
  .spinner-gold { width:18px; height:18px; border:2px solid rgba(212,175,55,0.2); border-top-color:#d4af37; border-radius:50%; animation:spin 0.7s linear infinite; display:inline-block; vertical-align:middle; margin-right:8px; }
  .info-card { padding:20px 24px; background:rgba(255,255,255,0.03); border:1px solid rgba(212,175,55,0.15); border-radius:6px; display:flex; gap:16px; align-items:flex-start; transition:border-color 0.3s; }
  .info-card:hover { border-color:rgba(212,175,55,0.3); }
  .toast { position:fixed; bottom:32px; right:32px; background:rgba(30,28,20,0.95); border:1px solid rgba(212,175,55,0.4); border-radius:6px; padding:14px 20px; color:#d4af37; font-family:'Cinzel',serif; font-size:11px; letter-spacing:2px; animation:fadeUp 0.4s ease; z-index:999; box-shadow:0 8px 32px rgba(0,0,0,0.4); }
  .overlay { position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(6px); z-index:100; display:flex; align-items:center; justify-content:center; padding:24px; }
  ::-webkit-scrollbar { width:4px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:rgba(212,175,55,0.3); border-radius:2px; }
`;

const inp = { width:"100%", padding:"12px 16px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(212,175,55,0.3)", borderRadius:"4px", color:"#f0ead6", fontSize:"14px", fontFamily:"'Cormorant Garamond',serif", letterSpacing:"0.5px", outline:"none", transition:"border-color 0.3s, box-shadow 0.3s" };
const lbl = { display:"block", color:"rgba(212,175,55,0.7)", fontSize:"10px", letterSpacing:"2px", fontFamily:"'Cinzel',serif", marginBottom:"8px", textTransform:"uppercase" };
const bg  = { minHeight:"100vh", background:"radial-gradient(ellipse at 20% 50%,#1a1508 0%,#0d0d0f 60%,#080810 100%)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cormorant Garamond',serif", padding:"24px" };
const cardStyle = { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(212,175,55,0.2)", borderRadius:"8px", padding:"48px", width:"100%", maxWidth:"440px", backdropFilter:"blur(20px)", position:"relative" };
const hdg = { fontFamily:"'Cinzel',serif", color:"#d4af37", fontSize:"28px", fontWeight:"400", letterSpacing:"3px", marginBottom:"6px" };
const sub = { color:"rgba(240,234,214,0.4)", fontSize:"14px", letterSpacing:"0.5px", marginBottom:"36px", fontStyle:"italic" };

// ── Reusable Components ───────────────────────────────────────
const EyeIcon = ({ show }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {show
      ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
    }
  </svg>
);

const Field = ({ label, type="text", value, onChange, placeholder }) => {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div style={{ marginBottom:"18px" }}>
      <label style={lbl}>{label}</label>
      <div style={{ position:"relative" }}>
        <input
          type={isPassword ? (show ? "text" : "password") : type}
          value={value} placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          style={{ ...inp, paddingRight: isPassword ? "44px" : "16px" }}
        />
        {isPassword && (
          <button onClick={() => setShow(s => !s)}
            style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"rgba(212,175,55,0.5)", padding:"0", display:"flex", alignItems:"center" }}>
            <EyeIcon show={show} />
          </button>
        )}
      </div>
    </div>
  );
};

const Row = ({ children }) => (
  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>{children}</div>
);

const DecorLines = () => (
  <>
    <div style={{ position:"absolute",top:0,left:0,right:0,height:"1px",background:"linear-gradient(90deg,transparent,rgba(212,175,55,0.5),transparent)" }} />
    <div style={{ position:"absolute",bottom:0,left:0,right:0,height:"1px",background:"linear-gradient(90deg,transparent,rgba(212,175,55,0.3),transparent)" }} />
  </>
);

const ErrorBox = ({ msg }) => msg ? (
  <div style={{ background:"rgba(180,50,50,0.15)", border:"1px solid rgba(180,50,50,0.4)", borderRadius:"4px", padding:"10px 14px", color:"#e07070", fontSize:"13px", marginBottom:"20px", letterSpacing:"0.3px" }}>{msg}</div>
) : null;

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [page, setPage]               = useState("loading");
  const [profile, setProfile]         = useState(null);
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [toast, setToast]             = useState("");
  const [editing, setEditing]         = useState(false);
  const [editData, setEditData]       = useState({});
  const [savingEdit, setSavingEdit]   = useState(false);
  const [activePanel, setActivePanel]   = useState("home");
  const [signupData, setSignupData]   = useState({ firstName:"", lastName:"", email:"", password:"", phone:"", address:"", city:"", postcode:"" });
  const [loginData, setLoginData]     = useState({ email:"", password:"" });
  const [magicEmail, setMagicEmail]   = useState("");
  const [magicSent, setMagicSent]     = useState(false);
  const [loginMode, setLoginMode]     = useState("password");

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const go = (p) => { setError(""); setPage(p); };

  // Handle magic link redirect + normal auth state
  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem("vaulte:magicEmail");
      if (!email) email = window.prompt("Please enter your email to confirm sign in:");
      if (email) {
        signInWithEmailLink(auth, email, window.location.href)
          .then(async (cred) => {
            window.localStorage.removeItem("vaulte:magicEmail");
            window.history.replaceState({}, document.title, "/");
            const prof = await fetchProfile(cred.user.uid);
            if (prof) { setProfile(prof); setPage("account"); showToast("WELCOME BACK"); }
            else { setSignupData(s => ({ ...s, email })); setPage("signup"); }
          })
          .catch(e => { setError(e.message); setPage("login"); });
      }
      return;
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const prof = await fetchProfile(user.uid);
        if (prof) { setProfile(prof); setPage("account"); }
        else { setPage("landing"); }
      } else {
        setProfile(null);
        setPage("landing");
      }
    });
    return () => unsub();
  }, []);

  // ── Sign Up ──
  const handleSignup = async () => {
    const { firstName, lastName, email, password, phone, address, city, postcode } = signupData;
    if (!firstName || !lastName || !email || !password) { setError("Please fill in all required fields."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const newProfile = {
        firstName, lastName, email, phone, address, city, postcode,
        uid: generateUID(),
        firebaseUid: cred.user.uid,
        createdAt: new Date().toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" }),
      };
      await saveProfile(cred.user.uid, newProfile);
      setProfile(newProfile);
      showToast("ACCOUNT CREATED");
      setPage("account");
    } catch (e) {
      setError(e.code === "auth/email-already-in-use"
        ? "An account with this email already exists."
        : e.message);
    }
    setLoading(false);
  };

  // ── Login ──
  const handleLogin = async () => {
    if (!loginData.email || !loginData.password) { setError("Please enter your email and password."); return; }
    setLoading(true); setError("");
    try {
      const cred = await signInWithEmailAndPassword(auth, loginData.email, loginData.password);
      const prof = await fetchProfile(cred.user.uid);
      setProfile(prof);
      showToast("WELCOME BACK");
      setPage("account");
    } catch (e) {
      setError(e.code === "auth/invalid-credential"
        ? "Invalid email or password."
        : e.message);
    }
    setLoading(false);
  };

  // ── Magic Link ──
  const handleMagicLink = async () => {
    if (!magicEmail) { setError("Please enter your email address."); return; }
    setLoading(true); setError("");
    try {
      await sendSignInLinkToEmail(auth, magicEmail, actionCodeSettings);
      window.localStorage.setItem("vaulte:magicEmail", magicEmail);
      setMagicSent(true);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };
  const handleLogout = async () => {
    await signOut(auth);
    setProfile(null);
    setLoginData({ email:"", password:"" });
    go("landing");
  };

  // ── Edit Profile ──
  const openEdit = () => { setEditData({ ...profile }); setEditing(true); };
  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      const updated = { ...profile, ...editData };
      // Update password in Firebase Auth if changed
      if (editData.password && editData.password !== profile.password) {
        await updatePassword(auth.currentUser, editData.password);
      }
      // Save to Firestore (don't store password in DB)
      const { password, ...safeProfile } = updated;
      await saveProfile(auth.currentUser.uid, safeProfile);
      setProfile(safeProfile);
      showToast("PROFILE UPDATED");
      setEditing(false);
    } catch (e) {
      setError(e.message);
    }
    setSavingEdit(false);
  };

  // ── Delete Account ──
  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "users", auth.currentUser.uid));
      await deleteUser(auth.currentUser);
      setProfile(null);
      go("landing");
    } catch (e) {
      alert("Error deleting account: " + e.message);
    }
  };

  // ── Loading screen ──
  if (page === "loading") return (
    <div style={{ ...bg, flexDirection:"column", gap:"16px" }}>
      <style>{globalStyle}</style>
      <div style={{ fontFamily:"'Cinzel',serif", color:"#d4af37", fontSize:"32px", letterSpacing:"8px" }}>VAULTE</div>
      <span className="spinner-gold" />
    </div>
  );

  // ── Landing ──
  if (page === "landing") return (
    <div style={bg}>
      <style>{globalStyle}</style>
      {toast && <div className="toast">✦ {toast}</div>}
      <div style={{ textAlign:"center" }} className="fade-up">
        <div style={{ color:"rgba(212,175,55,0.5)", fontFamily:"'Cinzel',serif", fontSize:"11px", letterSpacing:"4px", marginBottom:"8px" }}>WELCOME TO</div>
        <h1 style={{ fontFamily:"'Cinzel',serif", fontSize:"56px", color:"#d4af37", fontWeight:"400", letterSpacing:"8px", lineHeight:"1", marginBottom:"16px" }}>VAULTE</h1>
        <p style={{ color:"rgba(240,234,214,0.4)", fontSize:"16px", fontStyle:"italic", marginBottom:"52px", letterSpacing:"1px" }}>Your personal account, secured.</p>
        <div style={{ display:"flex", gap:"16px", justifyContent:"center" }}>
          <button className="btn-primary" style={{ width:"auto", padding:"14px 44px" }} onClick={() => go("signup")}>Create Account</button>
          <button className="btn-ghost" onClick={() => go("login")}>Sign In</button>
        </div>
      </div>
    </div>
  );

  // ── Sign Up ──
  if (page === "signup") return (
    <div style={{ ...bg, alignItems:"flex-start", paddingTop:"40px" }}>
      <style>{globalStyle}</style>
      {toast && <div className="toast">✦ {toast}</div>}
      <div style={cardStyle}>
        <DecorLines />
        <div className="fade-up">
          <div style={{ color:"rgba(212,175,55,0.5)", fontFamily:"'Cinzel',serif", fontSize:"10px", letterSpacing:"3px", marginBottom:"4px" }}>VAULTE</div>
          <h2 style={hdg}>Create Account</h2>
          <p style={sub}>Join us — it only takes a moment</p>
        </div>
        <ErrorBox msg={error} />
        <div className="fade-up-2">
          <Row>
            <Field label="First Name *" value={signupData.firstName} onChange={v => setSignupData({...signupData,firstName:v})} placeholder="Jane" />
            <Field label="Last Name *"  value={signupData.lastName}  onChange={v => setSignupData({...signupData,lastName:v})}  placeholder="Smith" />
          </Row>
          <Field label="Email Address *" type="email"    value={signupData.email}    onChange={v => setSignupData({...signupData,email:v})}    placeholder="jane@example.com" />
          <Field label="Password *"      type="password" value={signupData.password} onChange={v => setSignupData({...signupData,password:v})} placeholder="Min. 6 characters" />
        </div>
        <div className="fade-up-3">
          <Field label="Phone Number"   value={signupData.phone}    onChange={v => setSignupData({...signupData,phone:v})}    placeholder="+44 7700 000000" />
          <Field label="Street Address" value={signupData.address}  onChange={v => setSignupData({...signupData,address:v})}  placeholder="123 High Street" />
          <Row>
            <Field label="City"     value={signupData.city}     onChange={v => setSignupData({...signupData,city:v})}     placeholder="London" />
            <Field label="Postcode" value={signupData.postcode} onChange={v => setSignupData({...signupData,postcode:v})} placeholder="SW1A 1AA" />
          </Row>
        </div>
        <div className="fade-up-4">
          <button className="btn-primary" onClick={handleSignup} disabled={loading}>
            {loading && <span className="spinner" />}Create My Account
          </button>
          <div className="divider">or</div>
          <button className="btn-ghost" style={{ width:"100%" }} onClick={() => go("login")}>Sign In Instead</button>
        </div>
      </div>
    </div>
  );

  // ── Login ──
  if (page === "login") return (
    <div style={bg}>
      <style>{globalStyle}</style>
      {toast && <div className="toast">✦ {toast}</div>}
      <div style={cardStyle}>
        <DecorLines />
        <div className="fade-up">
          <div style={{ color:"rgba(212,175,55,0.5)", fontFamily:"'Cinzel',serif", fontSize:"10px", letterSpacing:"3px", marginBottom:"4px" }}>VAULTE</div>
          <h2 style={hdg}>Welcome Back</h2>
          <p style={sub}>Sign in to your account</p>
        </div>

        {/* Toggle tabs */}
        <div style={{ display:"flex", gap:"0", marginBottom:"28px", border:"1px solid rgba(212,175,55,0.2)", borderRadius:"4px", overflow:"hidden" }}>
          <button onClick={() => { setLoginMode("password"); setError(""); setMagicSent(false); }}
            style={{ flex:1, padding:"10px", fontFamily:"'Cinzel',serif", fontSize:"10px", letterSpacing:"2px", cursor:"pointer", border:"none", transition:"all 0.3s", textTransform:"uppercase",
              background: loginMode === "password" ? "rgba(212,175,55,0.15)" : "transparent",
              color: loginMode === "password" ? "#d4af37" : "rgba(212,175,55,0.4)" }}>
            Password
          </button>
          <button onClick={() => { setLoginMode("magic"); setError(""); setMagicSent(false); }}
            style={{ flex:1, padding:"10px", fontFamily:"'Cinzel',serif", fontSize:"10px", letterSpacing:"2px", cursor:"pointer", border:"none", borderLeft:"1px solid rgba(212,175,55,0.2)", transition:"all 0.3s", textTransform:"uppercase",
              background: loginMode === "magic" ? "rgba(212,175,55,0.15)" : "transparent",
              color: loginMode === "magic" ? "#d4af37" : "rgba(212,175,55,0.4)" }}>
            Magic Link
          </button>
        </div>

        <ErrorBox msg={error} />

        {/* Password login */}
        {loginMode === "password" && (
          <div className="fade-up-2">
            <Field label="Email Address" type="email"    value={loginData.email}    onChange={v => setLoginData({...loginData,email:v})}    placeholder="jane@example.com" />
            <Field label="Password"      type="password" value={loginData.password} onChange={v => setLoginData({...loginData,password:v})} placeholder="••••••••" />
            <button className="btn-primary" onClick={handleLogin} disabled={loading}>
              {loading && <span className="spinner" />}Sign In
            </button>
          </div>
        )}

        {/* Magic link login */}
        {loginMode === "magic" && !magicSent && (
          <div className="fade-up-2">
            <p style={{ color:"rgba(240,234,214,0.45)", fontSize:"14px", fontStyle:"italic", marginBottom:"20px", lineHeight:"1.6" }}>
              Enter your email and we'll send you a sign-in link — no password needed.
            </p>
            <Field label="Email Address" type="email" value={magicEmail} onChange={setMagicEmail} placeholder="jane@example.com" />
            <button className="btn-primary" onClick={handleMagicLink} disabled={loading}>
              {loading && <span className="spinner" />}Send Me a Link
            </button>
          </div>
        )}

        {/* Magic link sent confirmation */}
        {loginMode === "magic" && magicSent && (
          <div className="fade-up-2" style={{ textAlign:"center", padding:"16px 0" }}>
            <div style={{ fontSize:"40px", marginBottom:"16px" }}>✉️</div>
            <div style={{ fontFamily:"'Cinzel',serif", color:"#d4af37", fontSize:"14px", letterSpacing:"2px", marginBottom:"12px" }}>CHECK YOUR INBOX</div>
            <p style={{ color:"rgba(240,234,214,0.45)", fontSize:"14px", fontStyle:"italic", lineHeight:"1.6" }}>
              We sent a sign-in link to<br />
              <span style={{ color:"#d4af37" }}>{magicEmail}</span><br /><br />
              Click the link in the email to sign in.
            </p>
            <button className="btn-ghost" style={{ marginTop:"24px", width:"100%" }} onClick={() => { setMagicSent(false); setMagicEmail(""); }}>
              Use a different email
            </button>
          </div>
        )}

        {!magicSent && (
          <>
            <div className="divider">or</div>
            <button className="btn-ghost" style={{ width:"100%" }} onClick={() => go("signup")}>Create an Account</button>
          </>
        )}
      </div>
    </div>
  );

  // ── Account Page ──
  if (page === "account" && profile) {

    const InfoCard = ({ icon, label, value }) => (
      <div className="info-card">
        <div style={{ fontSize:"20px", marginTop:"2px", flexShrink:0 }}>{icon}</div>
        <div style={{ flex:1 }}>
          <div style={{ color:"rgba(212,175,55,0.6)", fontSize:"10px", letterSpacing:"2px", fontFamily:"'Cinzel',serif", marginBottom:"5px" }}>{label}</div>
          <div style={{ color:"#f0ead6", fontSize:"15px", letterSpacing:"0.3px" }}>
            {value || <span style={{ color:"rgba(240,234,214,0.25)", fontStyle:"italic" }}>Not provided</span>}
          </div>
        </div>
      </div>
    );

    const navItem = (id, label, icon) => (
      <button onClick={() => setActivePanel(id)} style={{
        display:"flex", alignItems:"center", gap:"12px", width:"100%",
        padding:"12px 16px", background: activePanel === id ? "rgba(212,175,55,0.12)" : "transparent",
        border:"none", borderLeft: activePanel === id ? "2px solid #d4af37" : "2px solid transparent",
        color: activePanel === id ? "#d4af37" : "rgba(240,234,214,0.45)",
        fontFamily:"'Cinzel',serif", fontSize:"11px", letterSpacing:"2px",
        cursor:"pointer", transition:"all 0.25s", textTransform:"uppercase", textAlign:"left",
      }}>
        <span style={{ fontSize:"16px" }}>{icon}</span>{label}
      </button>
    );

    return (
      <div style={{ minHeight:"100vh", background:"radial-gradient(ellipse at 20% 50%,#1a1508 0%,#0d0d0f 60%,#080810 100%)", display:"flex", flexDirection:"column", fontFamily:"'Cormorant Garamond',serif" }}>
        <style>{globalStyle}</style>
        {toast && <div className="toast">✦ {toast}</div>}

        {/* Edit Modal */}
        {editing && (
          <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setEditing(false); }}>
            <div style={{ ...cardStyle, maxWidth:"520px", maxHeight:"90vh", overflowY:"auto" }} className="modal-in">
              <DecorLines />
              <div style={{ marginBottom:"28px" }}>
                <h2 style={{ ...hdg, fontSize:"22px", marginBottom:"4px" }}>Edit Profile</h2>
                <p style={{ color:"rgba(240,234,214,0.4)", fontSize:"13px", fontStyle:"italic" }}>Update your personal information</p>
              </div>
              <ErrorBox msg={error} />
              <Row>
                <Field label="First Name" value={editData.firstName||""} onChange={v => setEditData({...editData,firstName:v})} placeholder="Jane" />
                <Field label="Last Name"  value={editData.lastName||""}  onChange={v => setEditData({...editData,lastName:v})}  placeholder="Smith" />
              </Row>
              <Field label="Phone Number"   value={editData.phone||""}    onChange={v => setEditData({...editData,phone:v})}    placeholder="+44 7700 000000" />
              <Field label="Street Address" value={editData.address||""}  onChange={v => setEditData({...editData,address:v})}  placeholder="123 High Street" />
              <Row>
                <Field label="City"     value={editData.city||""}     onChange={v => setEditData({...editData,city:v})}     placeholder="London" />
                <Field label="Postcode" value={editData.postcode||""} onChange={v => setEditData({...editData,postcode:v})} placeholder="SW1A 1AA" />
              </Row>
              <Field label="New Password (optional)" type="password" value={editData.password||""} onChange={v => setEditData({...editData,password:v})} placeholder="Leave blank to keep current" />
              <div style={{ display:"flex", gap:"12px", marginTop:"8px" }}>
                <button className="btn-primary" onClick={handleSaveEdit} disabled={savingEdit}>
                  {savingEdit && <span className="spinner" />}Save Changes
                </button>
                <button className="btn-ghost" style={{ whiteSpace:"nowrap" }} onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Top bar */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 32px", borderBottom:"1px solid rgba(212,175,55,0.1)", background:"rgba(0,0,0,0.2)" }}>
          <div style={{ fontFamily:"'Cinzel',serif", color:"#d4af37", fontSize:"20px", letterSpacing:"6px" }}>VAULTE</div>
          <div style={{ display:"flex", alignItems:"center", gap:"16px" }}>
            <div style={{ fontFamily:"'Cinzel',serif", color:"rgba(212,175,55,0.5)", fontSize:"10px", letterSpacing:"2px" }}>
              {profile.firstName} {profile.lastName}
            </div>
            <button className="btn-ghost" style={{ padding:"8px 20px", fontSize:"10px" }} onClick={handleLogout}>Sign Out</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ display:"flex", flex:1 }}>

          {/* Left Sidebar */}
          <div style={{ width:"220px", flexShrink:0, borderRight:"1px solid rgba(212,175,55,0.1)", padding:"32px 0", display:"flex", flexDirection:"column", gap:"4px" }}>
            <div style={{ padding:"0 16px 16px", color:"rgba(212,175,55,0.3)", fontSize:"9px", letterSpacing:"3px", fontFamily:"'Cinzel',serif" }}>NAVIGATION</div>
            {navItem("home",    "Home",       "⌂")}
            {navItem("account", "My Account", "◈")}
            <div style={{ marginTop:"auto", padding:"24px 16px 0", borderTop:"1px solid rgba(212,175,55,0.1)" }}>
              <button className="btn-danger" style={{ width:"100%", padding:"10px", fontSize:"10px" }} onClick={handleDeleteAccount}>Delete Account</button>
            </div>
          </div>

          {/* Main Content */}
          <div style={{ flex:1, padding:"48px", overflowY:"auto" }}>

            {/* HOME panel */}
            {activePanel === "home" && (
              <div className="fade-up" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                {/* Left: welcome text */}
                <div>
                  <div style={{ color:"rgba(212,175,55,0.4)", fontFamily:"'Cinzel',serif", fontSize:"11px", letterSpacing:"4px", marginBottom:"16px" }}>
                    {new Date().toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}
                  </div>
                  <h1 style={{ fontFamily:"'Cinzel',serif", color:"#d4af37", fontSize:"42px", fontWeight:"400", letterSpacing:"4px", lineHeight:"1.2", marginBottom:"16px" }}>
                    Welcome,<br />{profile.firstName}.
                  </h1>
                  <p style={{ color:"rgba(240,234,214,0.35)", fontSize:"16px", fontStyle:"italic", letterSpacing:"0.5px" }}>
                    Good to have you back.
                  </p>
                </div>
                {/* Right: profile photo */}
                <div style={{ flexShrink:0, marginLeft:"40px" }}>
                  {profile.photoURL
                    ? <div style={{
                        width:"200px", height:"200px", flexShrink:0,
                        borderRadius:"12px",
                        backgroundImage:`url(${profile.photoURL})`,
                        backgroundSize:"cover",
                        backgroundPosition:"center",
                        border:"2px solid rgba(212,175,55,0.4)",
                        boxShadow:"0 8px 32px rgba(0,0,0,0.5)"
                      }} />
                    : <div style={{ width:"200px", height:"200px", borderRadius:"12px", border:"2px dashed rgba(212,175,55,0.25)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"12px", background:"rgba(212,175,55,0.03)" }}>
                        <span style={{ fontSize:"48px", opacity:0.3 }}>👤</span>
                        <span style={{ fontFamily:"'Cinzel',serif", fontSize:"9px", letterSpacing:"2px", color:"rgba(212,175,55,0.3)", textAlign:"center" }}>NO PHOTO YET</span>
                      </div>
                  }
                </div>
              </div>
            )}

            {/* MY ACCOUNT panel */}
            {activePanel === "account" && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"32px" }} className="fade-up">
                  <div>
                    <div style={{ color:"rgba(212,175,55,0.4)", fontFamily:"'Cinzel',serif", fontSize:"10px", letterSpacing:"3px", marginBottom:"8px" }}>PROFILE</div>
                    <h2 style={{ ...hdg, fontSize:"26px", marginBottom:0 }}>My Account</h2>
                  </div>
                  <button className="btn-ghost" onClick={openEdit}>Edit Profile</button>
                </div>

                {/* Avatar + name + photo upload */}
                <div style={{ padding:"24px 28px", background:"linear-gradient(135deg,rgba(212,175,55,0.1),rgba(212,175,55,0.03))", border:"1px solid rgba(212,175,55,0.25)", borderRadius:"8px", marginBottom:"20px", display:"flex", alignItems:"center", gap:"20px" }} className="fade-up-2">
                  {/* Left: initials avatar */}
                  <div style={{ width:"60px", height:"60px", borderRadius:"50%", background:"linear-gradient(135deg,#c9a84c,#b8962e)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cinzel',serif", fontSize:"20px", color:"#0d0d0f", fontWeight:"600", flexShrink:0 }}>
                    {profile.firstName?.[0]}{profile.lastName?.[0]}
                  </div>
                  {/* Centre: name, uid, member since */}
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:"'Cinzel',serif", color:"#d4af37", fontSize:"18px", letterSpacing:"2px" }}>{profile.firstName} {profile.lastName}</div>
                    <div style={{ display:"inline-flex", alignItems:"center", gap:"6px", background:"rgba(212,175,55,0.1)", border:"1px solid rgba(212,175,55,0.25)", borderRadius:"20px", padding:"3px 10px", margin:"6px 0" }}>
                      <span style={{ color:"rgba(212,175,55,0.5)", fontSize:"9px" }}>◆</span>
                      <span style={{ fontFamily:"'Cinzel',serif", fontSize:"9px", letterSpacing:"2px", color:"rgba(212,175,55,0.7)" }}>{profile.uid}</span>
                    </div>
                    <div style={{ color:"rgba(240,234,214,0.4)", fontSize:"13px", fontStyle:"italic" }}>Member since {profile.createdAt}</div>
                  </div>
                  {/* Right: photo upload */}
                  <div style={{ flexShrink:0, textAlign:"center" }}>
                    <input type="file" accept="image/*" id="photo-upload" style={{ display:"none" }} onChange={async e => {
                      const file = e.target.files[0];
                      if (!file) return;
                      try {
                        const uid = auth.currentUser?.uid;
                        if (!uid) { alert("Not logged in"); return; }
                        showToast("UPLOADING...");
                        const storageRef = ref(storage, "profile-photos/" + uid + ".jpg");
                        await uploadBytes(storageRef, file);
                        const downloadURL = await getDownloadURL(storageRef);
                        const updated = { ...profile, photoURL: downloadURL };
                        await saveProfile(uid, updated);
                        setProfile(updated);
                        showToast("PHOTO UPDATED");
                      } catch(err) {
                        console.error("Photo upload error:", err);
                        alert("Could not upload photo: " + err.message);
                      }
                    }} />
                    <label htmlFor="photo-upload" style={{ cursor:"pointer", display:"block" }}>
                      {profile.photoURL
                        ? <div style={{
                            width:"200px", height:"200px",
                            borderRadius:"12px",
                            backgroundImage:`url(${profile.photoURL})`,
                            backgroundSize:"cover",
                            backgroundPosition:"center",
                            border:"2px solid rgba(212,175,55,0.4)",
                            boxShadow:"0 4px 16px rgba(0,0,0,0.3)"
                          }} />
                        : <div style={{ width:"200px", height:"200px", borderRadius:"12px", border:"2px dashed rgba(212,175,55,0.3)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"8px", transition:"border-color 0.3s", background:"rgba(212,175,55,0.03)" }}>
                            <span style={{ fontSize:"40px" }}>📷</span>
                            <span style={{ fontFamily:"'Cinzel',serif", fontSize:"9px", letterSpacing:"1px", color:"rgba(212,175,55,0.4)", textAlign:"center" }}>CLICK TO<br/>ADD PHOTO</span>
                          </div>
                      }
                    </label>
                    {profile.photoURL && (
                      <button onClick={async () => {
                        try {
                          const storageRef = ref(storage, "profile-photos/" + auth.currentUser.uid + ".jpg");
                          await deleteObject(storageRef).catch(() => {});
                          const u = {...profile}; delete u.photoURL;
                          await saveProfile(auth.currentUser.uid, u);
                          setProfile(u);
                          showToast("PHOTO REMOVED");
                        } catch(err) { console.error(err); }
                      }}
                        style={{ marginTop:"8px", background:"none", border:"none", color:"rgba(200,80,80,0.5)", fontFamily:"'Cinzel',serif", fontSize:"9px", letterSpacing:"1px", cursor:"pointer", textTransform:"uppercase" }}>
                        Remove Photo
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display:"grid", gap:"12px" }} className="fade-up-3">
                  <InfoCard icon="✉️" label="Email Address" value={profile.email} />
                  <InfoCard icon="📞" label="Telephone"     value={profile.phone} />
                  <InfoCard icon="🏠" label="Address"       value={[profile.address, profile.city, profile.postcode].filter(Boolean).join(", ")} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
