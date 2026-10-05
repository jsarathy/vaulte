// api/_polar/client.js — Polar AccessLink exercise transactions for one connected account.
// Transactions hand over the exercises recorded since the last commit; everything (incl. the
// HR samples) must be fetched before the commit, after which Polar forgets them.

const POLAR = "https://www.polaraccesslink.com";

/** The calls for a stored connection ({ access_token, polar_user_id }). */
export function polarClient({ access_token, polar_user_id }) {
  const auth = { Authorization: `Bearer ${access_token}`, Accept: "application/json" };
  const transactions = `${POLAR}/v3/users/${polar_user_id}/exercise-transactions`;
  return {
    auth,
    polar_user_id,
    /** { empty: true } when nothing is new, { error: text } on failure, else { id }. */
    async openTransaction() {
      const r = await fetch(transactions, { method: "POST", headers: auth });
      if (r.status === 204) return { empty: true };
      if (!r.ok) return { error: await r.text() };
      return { id: (await r.json())["transaction-id"] };
    },
    /** The exercise URLs in the transaction; null when the list cannot be read. */
    async listExercises(id) {
      const r = await fetch(`${transactions}/${id}`, { headers: auth });
      if (!r.ok) return null;
      return (await r.json()).exercises || [];
    },
    /** Tell Polar the transaction's exercises were taken. */
    commitTransaction: (id) => fetch(`${transactions}/${id}`, { method: "PUT", headers: auth }),
  };
}
