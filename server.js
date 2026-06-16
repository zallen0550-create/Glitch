const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 4176);
const root = __dirname;
const supabaseUrl = process.env.SUPABASE_URL || "https://sijzigpchtkjegrrjrox.supabase.co";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || "sb_publishable_OfprXwmmoHupkt-3rf6EMQ_VEtlcxTe";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const openAiApiKey = process.env.OPENAI_API_KEY || "";
const openAiModel = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";
const allowMockAi = process.env.NODE_ENV !== "production" && process.env.GLITCH_ALLOW_MOCK_AI !== "false";
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

const mockIdentifications = [
  {
    name: "Charizard ex Special Illustration Rare",
    category: "Trading Card",
    series: "Pokemon 151",
    estimated_value: 184,
    low_value: 152,
    high_value: 228,
    confidence: 94,
    condition_estimate: "Near Mint candidate",
    recommended_action: "Grade",
    marketplace_source: "Mock",
    ai_explanation:
      "High collector demand and clean visible edges make grading the best upside path before selling."
  },
  {
    name: "Blue-Eyes White Dragon Unlimited",
    category: "Trading Card",
    series: "Legend of Blue Eyes",
    estimated_value: 72,
    low_value: 48,
    high_value: 118,
    confidence: 87,
    condition_estimate: "Light edge wear",
    recommended_action: "Watch",
    marketplace_source: "Mock",
    ai_explanation:
      "The match is strong, but condition and print details need a closer look before committing to a listing."
  },
  {
    name: "Sealed Booster Pack Shadow Era",
    category: "Sealed Product",
    series: "Vintage TCG",
    estimated_value: 43,
    low_value: 31,
    high_value: 62,
    confidence: 76,
    condition_estimate: "Sealed / unverified",
    recommended_action: "Bundle",
    marketplace_source: "Mock",
    ai_explanation:
      "Standalone value is modest, but pairing it with nearby sealed packs could raise conversion."
  }
];

const requiredBuckets = ["card-images", "uploads", "profile-images"];

function logReadinessChecks() {
  const requiredEnv = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY"
  ];
  const missing = requiredEnv.filter((name) => !process.env[name]);
  if (missing.length) {
    console.warn(`[Glitch readiness] Missing server env vars: ${missing.join(", ")}`);
  }
  if (process.env.NODE_ENV === "production" && !openAiApiKey) {
    console.error("[Glitch readiness] Production requires OPENAI_API_KEY. Mock AI is disabled.");
  }
  if (process.env.NODE_ENV === "production" && allowMockAi) {
    console.error("[Glitch readiness] Mock AI must be disabled in production.");
  }
}

function writeCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
}

function sendJson(response, status, payload) {
  writeCorsHeaders(response);
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

async function supabaseRequest(path, token, options = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: token,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = body?.message || body?.msg || text || `Supabase request failed: ${response.status}`;
    throw new Error(message);
  }
  return body;
}

async function getSupabaseUser(token) {
  return supabaseRequest("/auth/v1/user", token);
}

async function createScan(token, payload, userId) {
  const rows = await supabaseRequest("/rest/v1/scans", token, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: userId,
      status: "analyzing",
      source_bucket: payload.photos?.[0]?.bucket || null,
      source_path: payload.photos?.[0]?.path || null,
      source_url: payload.photos?.[0]?.url || null,
      ai_provider: openAiApiKey ? "openai" : "mock",
      ai_model: openAiApiKey ? openAiModel : "dev-mock",
      metadata: { photo_count: payload.photos?.length || 0 }
    })
  });
  return rows[0];
}

async function updateScan(token, scanId, patch) {
  const rows = await supabaseRequest(`/rest/v1/scans?id=eq.${encodeURIComponent(scanId)}`, token, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch)
  });
  return rows[0];
}

async function identifyWithOpenAi(photos) {
  if (!openAiApiKey) {
    if (!allowMockAi) throw new Error("AI identification is not configured.");
    return mockIdentifications.slice(0, Math.max(1, Math.min(mockIdentifications.length, photos.length || 1)));
  }

  const imageContent = photos
    .filter((photo) => photo.url)
    .slice(0, 6)
    .map((photo) => ({
      type: "input_image",
      image_url: photo.url
    }));

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: openAiModel,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Identify collectible items in these images. Return strict JSON with an items array. Each item needs name, category, series, estimated_value, low_value, high_value, confidence, condition_estimate, recommended_action, and ai_explanation."
            },
            ...imageContent
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "glitch_collectible_identification",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: { type: "string" },
                    category: { type: "string" },
                    series: { type: "string" },
                    estimated_value: { type: "number" },
                    low_value: { type: "number" },
                    high_value: { type: "number" },
                    confidence: { type: "number" },
                    condition_estimate: { type: "string" },
                    recommended_action: { type: "string" },
                    ai_explanation: { type: "string" }
                  },
                  required: [
                    "name",
                    "category",
                    "series",
                    "estimated_value",
                    "low_value",
                    "high_value",
                    "confidence",
                    "condition_estimate",
                    "recommended_action",
                    "ai_explanation"
                  ]
                }
              }
            },
            required: ["items"]
          }
        }
      }
    })
  });

  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || "OpenAI identification failed");
  const text = body.output_text || body.output?.[0]?.content?.[0]?.text;
  const parsed = JSON.parse(text || "{}");
  return parsed.items || [];
}

async function createReviewItems(token, scan, photos, identifications) {
  const rows = identifications.map((item, index) => {
    const photo = photos[index % Math.max(photos.length, 1)] || {};
    return {
      user_id: scan.user_id,
      scan_id: scan.id,
      name: item.name,
      category: item.category,
      series: item.series,
      estimated_value: item.estimated_value,
      low_value: item.low_value,
      high_value: item.high_value,
      confidence: Math.round(Number(item.confidence || 0)),
      condition_estimate: item.condition_estimate,
      recommended_action: item.recommended_action,
      marketplace_source: item.marketplace_source || "AI estimate",
      ai_explanation: item.ai_explanation,
      photo_bucket: photo.bucket || null,
      photo_path: photo.path || null,
      photo_url: photo.url || null,
      status: "pending"
    };
  });

  return supabaseRequest("/rest/v1/review_items", token, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(rows)
  });
}

async function handleIdentify(request, response) {
  try {
    const token = request.headers.authorization;
    if (!token) return sendJson(response, 401, { error: "Missing authorization token" });

    const payload = await readJsonBody(request);
    const photos = Array.isArray(payload.photos) ? payload.photos : [];
    if (!photos.length) return sendJson(response, 400, { error: "At least one uploaded photo is required" });

    const user = await getSupabaseUser(token);
    const scan = await createScan(token, payload, user.id);
    const identifications = await identifyWithOpenAi(photos);
    const reviewItems = await createReviewItems(token, scan, photos, identifications);
    const completedScan = await updateScan(token, scan.id, {
      status: "completed",
      raw_result: { items: identifications },
      metadata: { photo_count: photos.length, review_item_count: reviewItems.length }
    });

    sendJson(response, 200, { scan: completedScan, reviewItems });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Identification failed" });
  }
}

async function handleStorageHealth(_request, response) {
  if (!supabaseServiceRoleKey) {
    sendJson(response, 200, {
      ok: false,
      needsServerKey: true,
      error: "SUPABASE_SERVICE_ROLE_KEY is required on the server to verify bucket metadata.",
      buckets: requiredBuckets.map((bucket) => ({
        bucket,
        exists: false,
        status: "server-key-required"
      }))
    });
    return;
  }

  const results = await Promise.all(
    requiredBuckets.map(async (bucket) => {
      try {
        const bucketResponse = await fetch(`${supabaseUrl}/storage/v1/bucket/${bucket}`, {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseServiceRoleKey}`
          }
        });
        return {
          bucket,
          exists: bucketResponse.ok,
          status: bucketResponse.status
        };
      } catch (error) {
        return {
          bucket,
          exists: false,
          error: error.message
        };
      }
    })
  );

  sendJson(response, 200, {
    ok: results.every((bucket) => bucket.exists),
    buckets: results
  });
}

http
  .createServer(async (request, response) => {
    writeCorsHeaders(response);
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === "/api/identify" && request.method === "POST") {
      await handleIdentify(request, response);
      return;
    }

    if (url.pathname === "/api/storage-health" && request.method === "GET") {
      await handleStorageHealth(request, response);
      return;
    }

    const safePath = path
      .normalize(decodeURIComponent(url.pathname))
      .replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(root, safePath === "/" ? "index.html" : safePath);

    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      response.writeHead(200, {
        "Content-Type": types[path.extname(filePath)] || "application/octet-stream"
      });
      response.end(content);
    });
  })
  .listen(port, "127.0.0.1", () => {
    logReadinessChecks();
    console.log(`Glitch prototype running at http://127.0.0.1:${port}`);
  });
