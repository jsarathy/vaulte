// src/components/HomePanel.jsx — the Home panel: the profile photo as a backdrop, today's date
// and a welcome.

const panelStyle = {
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  background: "linear-gradient(160deg,#0d0d0f 60%,#1a1408)",
};
const photoStyle = (photoURL) => ({
  position: "absolute",
  top: "32px",
  right: "32px",
  width: "2in",
  height: "2in",
  backgroundImage: `url(${photoURL})`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  borderRadius: "8px",
  border: "1px solid rgba(212,175,55,0.3)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
});
const textStyle = {
  position: "relative",
  zIndex: 1,
  padding: "56px 56px 48px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  height: "100%",
};
const dateStyle = {
  color: "rgba(212,175,55,0.5)",
  fontFamily: "'Cinzel',serif",
  fontSize: "10px",
  letterSpacing: "4px",
  marginBottom: "20px",
  textTransform: "uppercase",
};
const titleStyle = {
  fontFamily: "'Cinzel',serif",
  color: "#d4af37",
  fontSize: "52px",
  fontWeight: "400",
  letterSpacing: "4px",
  lineHeight: "1.1",
  marginBottom: "16px",
  textShadow: "0 4px 24px rgba(0,0,0,0.8)",
};
const taglineStyle = {
  color: "rgba(240,234,214,0.45)",
  fontSize: "15px",
  fontStyle: "italic",
  letterSpacing: "1px",
  textShadow: "0 2px 8px rgba(0,0,0,0.8)",
};

/** Today as "Sunday, 4 October 2026". */
const today = () =>
  new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function HomePanel({ profile }) {
  return (
    <div className="fade-up" style={panelStyle}>
      {profile.photoURL && <div style={photoStyle(profile.photoURL)} />}
      <div style={textStyle}>
        <div style={dateStyle}>{today()}</div>
        <h1 style={titleStyle}>Welcome, {profile.firstName}.</h1>
        <p style={taglineStyle}>Good to have you back.</p>
      </div>
    </div>
  );
}
