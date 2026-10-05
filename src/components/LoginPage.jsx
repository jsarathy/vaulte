// src/components/LoginPage.jsx — Sign In: Google, then the Password / Magic Link modes (the
// link form and its "check your inbox" state), and the switch to Create Account.
import AuthCard from "./AuthCard.jsx";
import GoogleButton from "./GoogleButton.jsx";
import { ErrorBox, Field } from "./AuthBits.jsx";

const tabsStyle = {
  display: "flex",
  gap: "0",
  marginBottom: "28px",
  border: "1px solid rgba(212,175,55,0.2)",
  borderRadius: "4px",
  overflow: "hidden",
};
const tabStyle = (active, extra) => ({
  flex: 1,
  padding: "10px",
  fontFamily: "'Cinzel',serif",
  fontSize: "10px",
  letterSpacing: "2px",
  cursor: "pointer",
  border: "none",
  transition: "all 0.3s",
  textTransform: "uppercase",
  ...extra,
  background: active ? "rgba(212,175,55,0.15)" : "transparent",
  color: active ? "#d4af37" : "rgba(212,175,55,0.4)",
});

function LoginModeTabs({ loginMode, pickMode }) {
  return (
    <div style={tabsStyle}>
      <button onClick={() => pickMode("password")} style={tabStyle(loginMode === "password")}>
        Password
      </button>
      <button
        onClick={() => pickMode("magic")}
        style={tabStyle(loginMode === "magic", { borderLeft: "1px solid rgba(212,175,55,0.2)" })}
      >
        Magic Link
      </button>
    </div>
  );
}

function PasswordLogin({ loginData, setLoginData, loading, handleLogin }) {
  return (
    <div className="fade-up-2">
      <Field
        label="Email Address"
        type="email"
        value={loginData.email}
        onChange={(v) => setLoginData({ ...loginData, email: v })}
        placeholder="jane@example.com"
      />
      <Field
        label="Password"
        type="password"
        value={loginData.password}
        onChange={(v) => setLoginData({ ...loginData, password: v })}
        placeholder="........"
      />
      <button className="btn-primary" onClick={handleLogin} disabled={loading}>
        {loading && <span className="spinner" />}Sign In
      </button>
    </div>
  );
}

function MagicLogin({ magicEmail, setMagicEmail, loading, handleMagicLink }) {
  return (
    <div className="fade-up-2">
      <p
        style={{
          color: "rgba(240,234,214,0.45)",
          fontSize: "14px",
          fontStyle: "italic",
          marginBottom: "20px",
          lineHeight: "1.6",
        }}
      >
        Enter your email and we will send you a sign-in link -- no password needed.
      </p>
      <Field
        label="Email Address"
        type="email"
        value={magicEmail}
        onChange={setMagicEmail}
        placeholder="jane@example.com"
      />
      <button className="btn-primary" onClick={handleMagicLink} disabled={loading}>
        {loading && <span className="spinner" />}Send Me a Link
      </button>
    </div>
  );
}

function MagicSent({ magicEmail, resetMagic }) {
  return (
    <div className="fade-up-2" style={{ textAlign: "center", padding: "16px 0" }}>
      <div style={{ fontSize: "40px", marginBottom: "16px" }}>&#9993;</div>
      <div
        style={{
          fontFamily: "'Cinzel',serif",
          color: "#d4af37",
          fontSize: "14px",
          letterSpacing: "2px",
          marginBottom: "12px",
        }}
      >
        CHECK YOUR INBOX
      </div>
      <p
        style={{
          color: "rgba(240,234,214,0.45)",
          fontSize: "14px",
          fontStyle: "italic",
          lineHeight: "1.6",
        }}
      >
        We sent a sign-in link to
        <br />
        <span style={{ color: "#d4af37" }}>{magicEmail}</span>
        <br />
        <br />
        Click the link in the email to sign in.
      </p>
      <button
        className="btn-ghost"
        style={{ marginTop: "24px", width: "100%" }}
        onClick={resetMagic}
      >
        Use a different email
      </button>
    </div>
  );
}

function LoginMode({ login }) {
  if (login.loginMode === "password") return <PasswordLogin {...login} />;
  return login.magicSent ? <MagicSent {...login} /> : <MagicLogin {...login} />;
}

export default function LoginPage({ toast, error, loading, login, handleGoogleSignIn, go }) {
  return (
    <AuthCard title="Welcome Back" subtitle="Sign in to your account" toast={toast}>
      <LoginModeTabs loginMode={login.loginMode} pickMode={login.pickMode} />
      <GoogleButton onClick={handleGoogleSignIn} disabled={loading} />
      <div className="divider">or</div>
      <ErrorBox msg={error} />
      <LoginMode login={{ ...login, loading }} />
      {!login.magicSent && (
        <>
          <div className="divider">or</div>
          <button className="btn-ghost" style={{ width: "100%" }} onClick={() => go("signup")}>
            Create an Account
          </button>
        </>
      )}
    </AuthCard>
  );
}
