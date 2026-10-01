export default async function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: "auto-translator-backend",
    version: "1.0.0"
  });
}
