export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  return res.status(501).json({
    ok: false,
    code: "WEBHOOK_NOT_CONFIGURED",
    message: "Lemon Squeezy webhook verification and persistence require database configuration."
  });
}