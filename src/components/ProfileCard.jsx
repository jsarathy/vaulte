// src/components/ProfileCard.jsx — My Account's profile card: initials, name, account id,
// member-since date and the photo column.
import ProfilePhoto from "./ProfilePhoto.jsx";

const cardStyle = {
  padding: "24px 28px",
  background: "linear-gradient(135deg,rgba(212,175,55,0.1),rgba(212,175,55,0.03))",
  border: "1px solid rgba(212,175,55,0.25)",
  borderRadius: "8px",
  marginBottom: "20px",
  display: "flex",
  alignItems: "center",
  gap: "20px",
};
const initialsStyle = {
  width: "60px",
  height: "60px",
  borderRadius: "50%",
  background: "linear-gradient(135deg,#c9a84c,#b8962e)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "'Cinzel',serif",
  fontSize: "20px",
  color: "#0d0d0f",
  fontWeight: "600",
  flexShrink: 0,
};
const nameStyle = {
  fontFamily: "'Cinzel',serif",
  color: "#d4af37",
  fontSize: "18px",
  letterSpacing: "2px",
};
const idBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  background: "rgba(212,175,55,0.1)",
  border: "1px solid rgba(212,175,55,0.25)",
  borderRadius: "20px",
  padding: "3px 10px",
  margin: "6px 0",
};
const idStyle = {
  fontFamily: "'Cinzel',serif",
  fontSize: "9px",
  letterSpacing: "2px",
  color: "rgba(212,175,55,0.7)",
};
const sinceStyle = {
  color: "rgba(240,234,214,0.4)",
  fontSize: "13px",
  fontStyle: "italic",
};

export default function ProfileCard({ profile, photo }) {
  return (
    <div style={cardStyle} className="fade-up-2">
      <div style={initialsStyle}>
        {profile.firstName?.[0]}
        {profile.lastName?.[0]}
      </div>
      <div style={{ flex: 1 }}>
        <div style={nameStyle}>
          {profile.firstName} {profile.lastName}
        </div>
        <div style={idBadgeStyle}>
          <span style={{ color: "rgba(212,175,55,0.5)", fontSize: "9px" }}>+</span>
          <span style={idStyle}>{profile.uid}</span>
        </div>
        <div style={sinceStyle}>Member since {profile.createdAt}</div>
      </div>
      <ProfilePhoto photoURL={profile.photoURL} {...photo} />
    </div>
  );
}
