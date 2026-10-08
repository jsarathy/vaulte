// src/components/ProfileCard.jsx — My Account's profile card: initials, name, member-since date
// and the photo. On a phone the text stacks on the left and a smaller photo sits on the right.
import ProfilePhoto from "./ProfilePhoto.jsx";
import { useIsPhone } from "../hooks/useIsPhone.js";

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
const sinceStyle = {
  color: "rgba(240,234,214,0.4)",
  fontSize: "13px",
  fontStyle: "italic",
};

const phoneCardStyle = { ...cardStyle, padding: "16px", gap: "14px", alignItems: "flex-start" };
const phoneTextStyle = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "8px",
};

export default function ProfileCard({ profile, photo }) {
  const phone = useIsPhone();
  return (
    <div style={phone ? phoneCardStyle : cardStyle} className="fade-up-2">
      <div style={phone ? phoneTextStyle : { display: "contents" }}>
        <div style={initialsStyle}>
          {profile.firstName?.[0]}
          {profile.lastName?.[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={nameStyle}>
            {profile.firstName} {profile.lastName}
          </div>
          <div style={{ ...sinceStyle, marginTop: "6px" }}>Member since {profile.createdAt}</div>
        </div>
      </div>
      <ProfilePhoto photoURL={profile.photoURL} small={phone} {...photo} />
    </div>
  );
}
