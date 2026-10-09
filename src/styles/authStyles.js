// src/styles/authStyles.js — the sign-in pages' fonts, global CSS and inline styles.

export const fonts = `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Cinzel:wght@400;600&display=swap');`;

export const globalStyle = `
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
  .app-page { height:100vh; height:100dvh; }
  @media (max-width: 768px) {
    input, select, textarea { font-size:16px !important; }
    .table-frame { max-height:calc(100dvh - 220px) !important; }
    .tap-target { min-width:40px; min-height:40px; }
    button, summary, select, textarea, input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]):not([type=range]) { min-height:40px; }
    button { min-width:40px; }
    .btn-ghost { font-size:11px !important; }
    .app-main-account { padding:14px !important; }
    .app-main-nutrition { padding:6px !important; display:flex !important; flex-direction:column; overflow:hidden !important; }
    .app-main-nutrition .nt-wrap { margin:0 !important; flex:1; min-height:0; display:flex; flex-direction:column; }
    .app-main-nutrition .nt-root { height:auto !important; flex:1; min-height:0; }
    .app-sidebar { width:100% !important; height:56px !important; flex-direction:row !important; padding:0 !important; border-right:none !important; border-top:1px solid rgba(212,175,55,0.15) !important; order:2; gap:0 !important; }
    .app-sidebar .sidebar-label { display:none; }
    .app-sidebar .sidebar-nav-section { display:none; }
    .app-sidebar .sidebar-delete { display:none; }
    .app-body { flex-direction:column !important; }
    .app-main { order:1; }
    .app-topbar { padding:12px 16px !important; }
    .app-topbar-name { display:none; }
  }
`;

export const inp = {
  width: "100%",
  padding: "12px 16px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(212,175,55,0.3)",
  borderRadius: "4px",
  color: "#f0ead6",
  fontSize: "14px",
  fontFamily: "'Cormorant Garamond',serif",
  letterSpacing: "0.5px",
  outline: "none",
  transition: "border-color 0.3s, box-shadow 0.3s",
};
export const lbl = {
  display: "block",
  color: "rgba(212,175,55,0.7)",
  fontSize: "10px",
  letterSpacing: "2px",
  fontFamily: "'Cinzel',serif",
  marginBottom: "8px",
  textTransform: "uppercase",
};
export const bg = {
  minHeight: "100vh",
  background: "radial-gradient(ellipse at 20% 50%,#1a1508 0%,#0d0d0f 60%,#080810 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "'Cormorant Garamond',serif",
  padding: "24px",
};
export const cardStyle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(212,175,55,0.2)",
  borderRadius: "8px",
  padding: "48px",
  width: "100%",
  maxWidth: "440px",
  backdropFilter: "blur(20px)",
  position: "relative",
};
export const hdg = {
  fontFamily: "'Cinzel',serif",
  color: "#d4af37",
  fontSize: "28px",
  fontWeight: "400",
  letterSpacing: "3px",
  marginBottom: "6px",
};
export const sub = {
  color: "rgba(240,234,214,0.4)",
  fontSize: "14px",
  letterSpacing: "0.5px",
  marginBottom: "36px",
  fontStyle: "italic",
};
