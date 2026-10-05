// src/components/SignupPage.jsx — Create Account: the required and optional fields, and the
// buttons (create, Google, switch to Sign In).
import AuthCard from "./AuthCard.jsx";
import GoogleButton from "./GoogleButton.jsx";
import { ErrorBox, Field, Row } from "./AuthBits.jsx";

function SignupRequiredFields({ signupData, setSignupData }) {
  return (
    <div className="fade-up-2">
      <Row>
        <Field
          label="First Name *"
          value={signupData.firstName}
          onChange={(v) => setSignupData({ ...signupData, firstName: v })}
          placeholder="Jane"
        />
        <Field
          label="Last Name *"
          value={signupData.lastName}
          onChange={(v) => setSignupData({ ...signupData, lastName: v })}
          placeholder="Smith"
        />
      </Row>
      <Field
        label="Email Address *"
        type="email"
        value={signupData.email}
        onChange={(v) => setSignupData({ ...signupData, email: v })}
        placeholder="jane@example.com"
      />
      <Field
        label="Password *"
        type="password"
        value={signupData.password}
        onChange={(v) => setSignupData({ ...signupData, password: v })}
        placeholder="Min. 6 characters"
      />
    </div>
  );
}

function SignupOptionalFields({ signupData, setSignupData }) {
  return (
    <div className="fade-up-3">
      <Field
        label="Phone Number"
        value={signupData.phone}
        onChange={(v) => setSignupData({ ...signupData, phone: v })}
        placeholder="+44 7700 000000"
      />
      <Field
        label="Street Address"
        value={signupData.address}
        onChange={(v) => setSignupData({ ...signupData, address: v })}
        placeholder="123 High Street"
      />
      <Row>
        <Field
          label="City"
          value={signupData.city}
          onChange={(v) => setSignupData({ ...signupData, city: v })}
          placeholder="London"
        />
        <Field
          label="Postcode"
          value={signupData.postcode}
          onChange={(v) => setSignupData({ ...signupData, postcode: v })}
          placeholder="SW1A 1AA"
        />
      </Row>
    </div>
  );
}

function SignupActions({ loading, handleSignup, handleGoogleSignIn, go }) {
  return (
    <div className="fade-up-4">
      <button className="btn-primary" onClick={handleSignup} disabled={loading}>
        {loading && <span className="spinner" />}Create My Account
      </button>
      <div className="divider">or</div>
      <GoogleButton onClick={handleGoogleSignIn} disabled={loading} />
      <button className="btn-ghost" style={{ width: "100%" }} onClick={() => go("login")}>
        Sign In Instead
      </button>
    </div>
  );
}

export default function SignupPage({ toast, error, signupData, setSignupData, actions }) {
  return (
    <AuthCard
      title="Create Account"
      subtitle="Join us -- it only takes a moment"
      toast={toast}
      style={{ alignItems: "flex-start", paddingTop: "40px" }}
    >
      <ErrorBox msg={error} />
      <SignupRequiredFields signupData={signupData} setSignupData={setSignupData} />
      <SignupOptionalFields signupData={signupData} setSignupData={setSignupData} />
      <SignupActions {...actions} />
    </AuthCard>
  );
}
