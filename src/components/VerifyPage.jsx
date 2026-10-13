// src/components/VerifyPage.jsx — "Check your email" (Fix 130): a password account waits here until
// its address is confirmed; the person looks again, asks for the email again, or signs out.
import AuthCard from "./AuthCard.jsx";
import { ErrorBox } from "./AuthBits.jsx";

const button = (primary) => ({
  width: "100%",
  padding: "13px",
  marginTop: "12px",
  fontFamily: "'Cinzel',serif",
  fontSize: "11px",
  letterSpacing: "2px",
  textTransform: "uppercase",
  cursor: "pointer",
  borderRadius: "4px",
  border: "1px solid rgba(212,175,55,0.4)",
  background: primary ? "rgba(212,175,55,0.2)" : "transparent",
  color: "#d4af37",
});

export default function VerifyPage({ pages }) {
  const { toast, error, loading, confirm, handleLogout, profile } = pages;
  return (
    <AuthCard
      title="Check Your Email"
      subtitle={`We sent a confirmation link to ${profile.email}. Open it, then come back here.`}
      toast={toast}
    >
      <div className="fade-up-2">
        <ErrorBox msg={error} />
        <button onClick={confirm.handleContinue} disabled={loading} style={button(true)}>
          {loading ? "Checking…" : "I've confirmed — continue"}
        </button>
        <button onClick={confirm.handleResend} disabled={loading} style={button(false)}>
          {confirm.resent ? "Send it again" : "Resend the email"}
        </button>
        <button onClick={handleLogout} disabled={loading} style={button(false)}>
          Sign out
        </button>
      </div>
    </AuthCard>
  );
}
