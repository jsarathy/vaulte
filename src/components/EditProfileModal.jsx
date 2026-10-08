// src/components/EditProfileModal.jsx — the Edit Profile overlay: the editable fields, an
// optional new password, Save / Cancel; the backdrop closes it.
import { cardStyle, hdg } from "../styles/authStyles.js";
import { DecorLines, ErrorBox, Field, Row } from "./AuthBits.jsx";

function EditNameFields({ editData, setEditData }) {
  return (
    <Row>
      <Field
        label="First Name"
        value={editData.firstName || ""}
        onChange={(v) => setEditData({ ...editData, firstName: v })}
        placeholder="Jane"
      />
      <Field
        label="Last Name"
        value={editData.lastName || ""}
        onChange={(v) => setEditData({ ...editData, lastName: v })}
        placeholder="Smith"
      />
    </Row>
  );
}

function EditContactFields({ editData, setEditData }) {
  return (
    <>
      <Field
        label="Phone Number"
        value={editData.phone || ""}
        onChange={(v) => setEditData({ ...editData, phone: v })}
        placeholder="+44 7700 000000"
      />
      <Field
        label="Street Address"
        value={editData.address || ""}
        onChange={(v) => setEditData({ ...editData, address: v })}
        placeholder="123 High Street"
      />
      <Row>
        <Field
          label="City"
          value={editData.city || ""}
          onChange={(v) => setEditData({ ...editData, city: v })}
          placeholder="London"
        />
        <Field
          label="Postcode"
          value={editData.postcode || ""}
          onChange={(v) => setEditData({ ...editData, postcode: v })}
          placeholder="SW1A 1AA"
        />
      </Row>
      <Field
        label="New Password (optional)"
        type="password"
        value={editData.password || ""}
        onChange={(v) => setEditData({ ...editData, password: v })}
        placeholder="Leave blank to keep current"
      />
    </>
  );
}

function EditProfileFields({ editData, setEditData }) {
  return (
    <>
      <EditNameFields editData={editData} setEditData={setEditData} />
      <EditContactFields editData={editData} setEditData={setEditData} />
    </>
  );
}

function EditProfileHeader() {
  return (
    <div style={{ marginBottom: "28px" }}>
      <h2 style={{ ...hdg, fontSize: "22px", marginBottom: "4px" }}>Edit Profile</h2>
      <p style={{ color: "rgba(240,234,214,0.4)", fontSize: "13px", fontStyle: "italic" }}>
        Update your personal information
      </p>
    </div>
  );
}

export default function EditProfileModal({ editData, setEditData, error, savingEdit, actions }) {
  const { handleSaveEdit, close } = actions;
  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        style={{ ...cardStyle, maxWidth: "520px", maxHeight: "90dvh", overflowY: "auto" }}
        className="modal-in"
      >
        <DecorLines />
        <EditProfileHeader />
        <ErrorBox msg={error} />
        <EditProfileFields editData={editData} setEditData={setEditData} />
        <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
          <button className="btn-primary" onClick={handleSaveEdit} disabled={savingEdit}>
            {savingEdit && <span className="spinner" />}Save Changes
          </button>
          <button className="btn-ghost" style={{ whiteSpace: "nowrap" }} onClick={close}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
