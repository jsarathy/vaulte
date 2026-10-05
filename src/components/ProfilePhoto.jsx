// src/components/ProfilePhoto.jsx — the profile photo column: the picture (or "add photo"),
// the hidden file input and Remove Photo.

const photoStyle = (photoURL) => ({
  width: "200px",
  height: "200px",
  borderRadius: "12px",
  backgroundImage: `url(${photoURL})`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  border: "2px solid rgba(212,175,55,0.4)",
  boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
});
const placeholderStyle = {
  width: "200px",
  height: "200px",
  borderRadius: "12px",
  border: "2px dashed rgba(212,175,55,0.3)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  transition: "border-color 0.3s",
  background: "rgba(212,175,55,0.03)",
};
const placeholderTextStyle = {
  fontFamily: "'Cinzel',serif",
  fontSize: "9px",
  letterSpacing: "1px",
  color: "rgba(212,175,55,0.4)",
  textAlign: "center",
};
const removeStyle = {
  marginTop: "8px",
  background: "none",
  border: "none",
  color: "rgba(200,80,80,0.5)",
  fontFamily: "'Cinzel',serif",
  fontSize: "9px",
  letterSpacing: "1px",
  cursor: "pointer",
  textTransform: "uppercase",
};

function PhotoPlaceholder() {
  return (
    <div style={placeholderStyle}>
      <span style={{ fontSize: "40px" }}>[ photo ]</span>
      <span style={placeholderTextStyle}>
        CLICK TO
        <br />
        ADD PHOTO
      </span>
    </div>
  );
}

export default function ProfilePhoto({ photoURL, handlePhotoChange, handleRemovePhoto }) {
  return (
    <div style={{ flexShrink: 0, textAlign: "center" }}>
      <input
        type="file"
        accept="image/*"
        id="photo-upload"
        style={{ display: "none" }}
        onChange={handlePhotoChange}
      />
      <label htmlFor="photo-upload" style={{ cursor: "pointer", display: "block" }}>
        {photoURL ? <div style={photoStyle(photoURL)} /> : <PhotoPlaceholder />}
      </label>
      {photoURL && (
        <button onClick={handleRemovePhoto} style={removeStyle}>
          Remove Photo
        </button>
      )}
    </div>
  );
}
