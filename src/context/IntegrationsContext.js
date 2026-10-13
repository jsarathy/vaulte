// src/context/IntegrationsContext.js — whether the owner's device integrations (Polar, Renpho, Apple
// Watch) are shown (Fix 128). They are the owner's own: other people get the food tracker and Claude,
// and bring their own apps in through the Claude chat. The page provides `true` for an admin only;
// the default, for a page that provides nothing (the test harness), is on.
import { createContext, useContext } from "react";

const Integrations = createContext(true);

export const IntegrationsProvider = Integrations.Provider;

/** True when Polar, Renpho and Apple Watch are part of this person's app. */
export const useIntegrations = () => useContext(Integrations);
