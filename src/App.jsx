import { lazy, Suspense } from "react";
import { useAuthPages } from "./hooks/useAuthPages.js";
import { useAccountPage } from "./hooks/useAccountPage.js";
import { currentUid } from "./api/authAccount.js";
import { bg, globalStyle } from "./styles/authStyles.js";
import LandingPage from "./components/LandingPage.jsx";
import SignupPage from "./components/SignupPage.jsx";
import LoginPage from "./components/LoginPage.jsx";
// The signed-in app is its own download, fetched only after sign-in (Fix 43.2.2).
const AccountPage = lazy(() => import("./components/AccountPage.jsx"));

const wordmark = {
  fontFamily: "'Cinzel',serif",
  color: "#d4af37",
  fontSize: "32px",
  letterSpacing: "8px",
};

function LoadingPage() {
  return (
    <div style={{ ...bg, flexDirection: "column", gap: "16px" }}>
      <style>{globalStyle}</style>
      <div style={wordmark}>VAULTE</div>
      <span className="spinner-gold" />
    </div>
  );
}

// Main App: which page is open comes from useAuthPages; the signed-in page's own state from
// useAccountPage.
export default function App() {
  const pages = useAuthPages();
  const account = useAccountPage(pages);
  const { page, profile, toast, error, go, loading, handleGoogleSignIn } = pages;
  if (page === "loading") return <LoadingPage />;
  if (page === "landing") return <LandingPage toast={toast} go={go} />;
  if (page === "signup")
    return (
      <SignupPage
        toast={toast}
        error={error}
        signupData={pages.signupData}
        setSignupData={pages.setSignupData}
        actions={{ loading, handleSignup: pages.handleSignup, handleGoogleSignIn, go }}
      />
    );
  if (page === "login")
    return (
      <LoginPage
        toast={toast}
        error={error}
        loading={loading}
        login={pages.login}
        handleGoogleSignIn={handleGoogleSignIn}
        go={go}
      />
    );
  if (page === "account" && profile)
    return (
      <Suspense fallback={<LoadingPage />}>
        <AccountPage profile={profile} toast={toast} userId={currentUid()} {...account} />
      </Suspense>
    );
  return null;
}
