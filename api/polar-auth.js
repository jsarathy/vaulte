// api/polar-auth.js
// Redirects the user to Polar's OAuth login page.
// Called from the frontend as: window.location.href = '/api/polar-auth?userId=FIREBASE_UID'

export default function handler(req, res) {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId parameter" });
  }

  const clientId    = process.env.POLAR_CLIENT_ID;
  const redirectUri = process.env.POLAR_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: "Polar environment variables not configured" });
  }

  // Encode the Firebase userId in the state param so we can retrieve it in the callback
  const state = Buffer.from(JSON.stringify({ uid: userId })).toString("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    client_id:     clientId,
    redirect_uri:  redirectUri,
    scope:         "accesslink.read_all training_data",
    state,
  });

  const polarAuthUrl = `https://flow.polar.com/oauth2/authorization?${params.toString()}`;
  return res.redirect(302, polarAuthUrl);
}
