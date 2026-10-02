import crypto from "node:crypto";

function json(res, status, body) {
  res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  const signature = req.headers["x-signature"];

  if (!secret || !signature) {
    return json(res, 503, {
      ok: false,
      code: "WEBHOOK_NOT_CONFIGURED"
    });
  }

  const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  if (signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return json(res, 401, { ok: false, code: "INVALID_SIGNATURE" });
  }

  return json(res, 501, {
    ok: false,
    code: "WEBHOOK_HANDLER_NOT_CONFIGURED",
    message: "Verified webhook persistence requires database configuration."
  });
}
