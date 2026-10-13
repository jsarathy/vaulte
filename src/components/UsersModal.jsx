// src/components/UsersModal.jsx — the Users table (Dashboard, Fix 104): every user with their account
// details and ids, searchable. Same look as the Claude usage table: only as wide as its table on a
// monitor (the full window on a phone), bordered cells, centred headings, a summary at the bottom;
// Esc, ✕ or a tap outside closes it.
import { useEffect, useState } from "react";
import { useIsPhone } from "../hooks/useIsPhone.js";
import { loadUsers, myUid } from "../api/adminUsers.js";
import { useDeleteUser } from "../hooks/useDeleteUser.js";
import { useApproveUser } from "../hooks/useApproveUser.js";
import {
  USER_COLUMNS,
  canApprove,
  canDelete,
  filterUsers,
  userCells,
  usersCount,
} from "../lib/userTable.js";
import { S, TYPE } from "./tableStyles.js";

// Long values (an email, the user id) wrap inside their cell instead of making the table very wide
const WRAP = { whiteSpace: "normal", wordBreak: "break-all", maxWidth: "13ch" };
const WRAPPED = new Set([1, 7]); // Email, User ID

function DeleteButton({ user, onDelete, disabled }) {
  if (!canDelete(user, myUid())) return null;
  return (
    <button
      aria-label={`Delete ${user.email || user.uid}`}
      disabled={disabled}
      onClick={() => onDelete(user)}
      style={{
        ...S.close,
        fontSize: "inherit",
        color: "#b91c1c",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      Delete
    </button>
  );
}

function ApproveButton({ user, onApprove, disabled }) {
  if (!canApprove(user)) return null;
  return (
    <button
      aria-label={`Approve ${user.email || user.uid}`}
      disabled={disabled}
      onClick={() => onApprove(user)}
      style={{
        ...S.close,
        fontSize: "inherit",
        color: "#15803d",
        marginRight: "10px",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      Approve
    </button>
  );
}

function Rows({ users, pad, actions, busy }) {
  return (
    <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content" }}>
      <thead>
        <tr>
          {[...USER_COLUMNS, ""].map((h) => (
            <th key={h || "delete"} style={{ ...S.th, padding: pad, textAlign: "center" }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.uid}>
            {userCells(u).map((text, i) => (
              <td key={i} style={{ ...S.td, padding: pad, ...(WRAPPED.has(i) && WRAP) }}>
                {text}
              </td>
            ))}
            <td style={{ ...S.td, padding: pad, textAlign: "center" }}>
              <ApproveButton user={u} onApprove={actions.onApprove} disabled={busy} />
              <DeleteButton user={u} onDelete={actions.onDelete} disabled={busy} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Body({ state, shown, pad, actions, busy }) {
  if (state.status === "loading") return <div style={S.note}>Loading…</div>;
  if (state.status === "error")
    return <div style={S.note}>Could not load users: {state.error}</div>;
  if (!shown.length) return <div style={S.note}>No users match.</div>;
  return <Rows users={shown} pad={pad} actions={actions} busy={busy} />;
}

export default function UsersModal({ onClose }) {
  const type = TYPE[useIsPhone() ? "phone" : "monitor"];
  const [query, setQuery] = useState("");
  const [state, setState] = useState({ status: "loading", users: [] });
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    let live = true;
    loadUsers()
      .then((users) => live && setState({ status: "ok", users }))
      .catch((e) => live && setState({ status: "error", users: [], error: e.message }));
    return () => {
      live = false;
    };
  }, []);
  const shown = filterUsers(state.users, query);
  const del = useDeleteUser(setState);
  const approve = useApproveUser(setState);
  const [last, setLast] = useState("delete"); // whose note to show: the action done most recently
  const note = last === "approve" ? approve.note : del.note;
  const actions = {
    onDelete: (u) => (setLast("delete"), del.onDelete(u)),
    onApprove: (u) => (setLast("approve"), approve.onApprove(u)),
  };
  return (
    <div style={S.backdrop} onClick={onClose}>
      <div
        role="dialog"
        aria-label="Users"
        style={{ ...S.box, fontSize: type.base }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ ...S.bar, fontSize: type.bar }}>
          <span style={{ flex: 1 }}>USERS</span>
          <button aria-label="Close" style={S.close} onClick={onClose}>
            ✕
          </button>
          <div style={{ ...S.filters, fontSize: type.control }}>
            <input
              type="search"
              aria-label="Search users"
              placeholder="Search users"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ ...S.select, fontSize: type.control, flex: 1, minWidth: 0 }}
            />
          </div>
        </div>
        <div style={S.scroll}>
          <Body
            state={state}
            shown={shown}
            pad={type.pad}
            actions={actions}
            busy={del.busy || approve.busy}
          />
        </div>
        {note && <div style={{ ...S.note, fontSize: type.total }}>{note}</div>}
        <div style={{ ...S.total, fontSize: type.total }}>{usersCount(shown.length)}</div>
      </div>
    </div>
  );
}
