import crypto from "node:crypto";

const FREE_DAILY_LIMIT = 500;

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function json(res, status, body) {
  res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  try {
    const body = req.body || {};
    const text = String(body.text || "").trim();
    const targetLanguage = String(body.targetLanguage || "").trim();

    if (!text || !targetLanguage) {
      return json(res, 400, {
        ok: false,
        error: "text and targetLanguage are required."
      });
    }

    const words = countWords(text);

    if (words > FREE_DAILY_LIMIT) {
      return json(res, 400, {
        ok: false,
        code: "REQUEST_TOO_LARGE"
      });
    }

    const requestId = crypto.randomUUID();

    return json(res, 501, {
      ok: false,
      code: "BACKEND_NOT_CONFIGURED",
      requestId,
      message: "Authentication, database, entitlement and translation provider configuration is required."
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      code: "SERVER_ERROR"
    });
  }
}
