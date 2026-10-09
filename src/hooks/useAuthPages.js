// src/hooks/useAuthPages.js — the state behind the sign-in pages: which page is open, the
// signed-in profile, the toast, and the Create Account / Sign In / Magic Link / Google flows.
import { useEffect, useRef, useState } from "react";
import {
  completeMagicLink,
  createAccount,
  logOut,
  magicLinkEmail,
  openedFromMagicLink,
  sendMagicLink,
  signInWithGoogle,
  signInWithPassword,
  watchSignedIn,
} from "../api/authAccount.js";
import {
  EMPTY_LOGIN,
  EMPTY_SIGNUP,
  popupErrorMessage,
  signInErrorMessage,
  signupErrorMessage,
  signupProblem,
} from "../lib/authProfile.js";
import { useAuthHistory } from "./useAuthHistory.js";

const TOAST_MS = 3000;

export function useToast() {
  const [toast, setToast] = useState("");
  const timer = useRef(null);
  const showToast = (msg) => {
    clearTimeout(timer.current); // an older toast's timer must not clear this one early
    setToast(msg);
    timer.current = setTimeout(() => setToast(""), TOAST_MS);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return { toast, showToast };
}

/** Runs `work`, showing its failure (via `describe`) and the busy state while it runs. */
function useBusy(setError) {
  const [loading, setLoading] = useState(false);
  const run = async (work, describe = (e) => e.message) => {
    setLoading(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(describe(e));
    }
    setLoading(false);
  };
  return { loading, run };
}

/** The page, the profile and the error; `enter` opens the account page for a profile. */
function useSession(showToast) {
  const [page, setPage] = useState("loading");
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const go = (p) => {
    setError("");
    setPage(p);
  };
  const enter = (prof, toastMsg) => {
    setProfile(prof);
    setPage("account");
    if (toastMsg) showToast(toastMsg);
  };
  return { page, setPage, profile, setProfile, error, setError, go, enter };
}

/** At start-up: finish a sign-in link, or land on the page for whoever is signed in. */
function useStartup(session, onMagicNewUser) {
  const { enter, setPage, setError } = session;
  useEffect(() => {
    if (!openedFromMagicLink()) return watchSignedIn(landFor(enter, setPage));
    finishMagicLink(enter, onMagicNewUser, (msg) => {
      setError(msg);
      setPage("login");
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Where a start-up lands: a stored profile opens the account, anything else the landing page. */
const landFor = (enter, setPage) => (prof) => (prof ? enter(prof) : setPage("landing"));

/** A page opened from a sign-in link: sign in with the address, or ask for it. */
function finishMagicLink(enter, onNewUser, onFail) {
  const email = magicLinkEmail();
  if (!email) return;
  completeMagicLink(email)
    .then((prof) => (prof ? enter(prof, "WELCOME BACK") : onNewUser(email)))
    .catch((e) => onFail(e.message));
}

function useSignup(session, run) {
  const [signupData, setSignupData] = useState(EMPTY_SIGNUP);
  const handleSignup = async () => {
    const problem = signupProblem(signupData);
    if (problem) return session.setError(problem);
    await run(
      async () => session.enter(await createAccount(signupData), "ACCOUNT CREATED"),
      signupErrorMessage,
    );
  };
  return { signupData, setSignupData, handleSignup };
}

/** The Magic Link mode: the address, sending the link, and the "check your inbox" state. */
function useMagicLink(session, run) {
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const handleMagicLink = async () => {
    if (!magicEmail) return session.setError("Please enter your email address.");
    await run(() => sendMagicLink(magicEmail).then(() => setMagicSent(true)));
  };
  const resetMagic = () => {
    setMagicSent(false);
    setMagicEmail("");
  };
  return { magicEmail, setMagicEmail, magicSent, setMagicSent, handleMagicLink, resetMagic };
}

/** The password form. */
function usePasswordLogin(session, run) {
  const [loginData, setLoginData] = useState(EMPTY_LOGIN);
  const handleLogin = async () => {
    if (!loginData.email || !loginData.password)
      return session.setError("Please enter your email and password.");
    await run(
      async () => session.enter(await signInWithPassword(loginData), "WELCOME BACK"),
      signInErrorMessage,
    );
  };
  return { loginData, setLoginData, handleLogin };
}

/** The Sign In page: the password form, the mode tabs and the magic-link mode. */
function useLogin(session, run) {
  const [loginMode, setLoginMode] = useState("password");
  const password = usePasswordLogin(session, run);
  const magic = useMagicLink(session, run);
  const pickMode = (mode) => {
    setLoginMode(mode);
    session.setError("");
    magic.setMagicSent(false);
  };
  return {
    login: { ...password, loginMode, ...magic, pickMode },
    setLoginData: password.setLoginData,
  };
}

/** Google sign-in (a first visit creates the profile) and signing out. */
function useOtherSignIns(session, run, setLoginData) {
  const handleGoogleSignIn = () =>
    run(async () => {
      const { profile, created } = await signInWithGoogle();
      session.enter(profile, created ? "ACCOUNT CREATED" : "WELCOME BACK");
    }, popupErrorMessage);
  const handleLogout = async () => {
    await logOut();
    session.setProfile(null);
    setLoginData(EMPTY_LOGIN);
    session.go("landing");
  };
  return { handleGoogleSignIn, handleLogout };
}

/** Everything the sign-in pages and the signed-in page need. */
export function useAuthPages() {
  const { toast, showToast } = useToast();
  const session = useSession(showToast);
  useAuthHistory(session.page, session.go);
  const { loading, run } = useBusy(session.setError);
  const signup = useSignup(session, run);
  const { login, setLoginData } = useLogin(session, run);
  const others = useOtherSignIns(session, run, setLoginData);
  useStartup(session, (email) => {
    signup.setSignupData((s) => ({ ...s, email }));
    session.setPage("signup");
  });
  return { ...session, toast, showToast, loading, ...signup, login, ...others };
}
