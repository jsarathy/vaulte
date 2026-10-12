// src/constants/infraLinks.js — where the infrastructure behind Vaulte is looked after (Fix 99):
// the links in the Dashboard's INFRASTRUCTURE box, and the Anthropic Console link in its CLAUDE box.
// Addresses only; nothing secret.
export const INFRA_LINKS = [
  {
    name: "Vercel",
    note: "Hosting, deployments and function logs",
    url: "https://vercel.com/jsarathys-projects/vaulte",
  },
  {
    name: "Firebase",
    note: "Sign-in, Firestore data, storage",
    url: "https://console.firebase.google.com/project/vaulte-1ea20",
  },
  { name: "GitHub", note: "The code and pull requests", url: "https://github.com/jsarathy/vaulte" },
  {
    name: "GitHub Actions",
    note: "CI runs and the weekly checks",
    url: "https://github.com/jsarathy/vaulte/actions",
  },
  {
    name: "GitHub issues",
    note: "CI platform check",
    url: "https://github.com/jsarathy/vaulte/issues",
  },
];

export const CLAUDE_LINK = {
  name: "Anthropic Console",
  note: "Claude API usage and spend limits",
  url: "https://console.anthropic.com",
};
