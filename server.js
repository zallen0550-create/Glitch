const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 10000);
const root = __dirname;
const supabaseUrl = process.env.SUPABASE_URL || "https://sijzigpchtkjegrrjrox.supabase.co";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || "sb_publishable_OfprXwmmoHupkt-3rf6EMQ_VEtlcxTe";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const openAiApiKey = process.env.OPENAI_API_KEY || "";
const openAiModel = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";
const pokemonTcgApiKey = process.env.POKEMON_TCG_API_KEY || "";
const tcgPlayerApiKey = process.env.TCGPLAYER_API_KEY || "";
const ebayBearerToken = process.env.EBAY_BEARER_TOKEN || "";
const allowMockAi = process.env.NODE_ENV !== "production" && process.env.GLITCH_ALLOW_MOCK_AI !== "false";
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

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
      ai_provider: "openai",
      ai_model: openAiModel,
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
    throw new Error("OpenAI Vision is not configured. Refusing to return fake identification data.");
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
                "Identify the exact Pokemon card shown in each uploaded image. Do not identify only the character. Read visible text, HP, card number, set symbols, language, rarity clues, foil treatment, copyright/year, border era, and condition clues. For Charizard, distinguish Base Set / Base Set 2 / Legendary Collection / evolutions / modern ex cards by card number, HP, layout, art, and set era. Return strict JSON with an items array. If confidence is under 90, include exactly three possible_matches. Pricing may be unknown at this step."
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
                    character: { type: "string" },
                    card_name: { type: "string" },
                    category: { type: "string" },
                    series: { type: "string" },
                    set_name: { type: "string" },
                    card_number: { type: "string" },
                    rarity: { type: "string" },
                    language: { type: "string" },
                    hp: { type: "string" },
                    visible_text: { type: "string" },
                    set_logo_or_era: { type: "string" },
                    artwork_description: { type: "string" },
                    estimated_value: { type: "number" },
                    low_value: { type: "number" },
                    high_value: { type: "number" },
                    confidence: { type: "number" },
                    condition_estimate: { type: "string" },
                    recommended_action: { type: "string" },
                    ai_explanation: { type: "string" },
                    possible_matches: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                          card_name: { type: "string" },
                          set_name: { type: "string" },
                          card_number: { type: "string" },
                          rarity: { type: "string" },
                          confidence: { type: "number" },
                          reason: { type: "string" }
                        },
                        required: ["card_name", "set_name", "card_number", "rarity", "confidence", "reason"]
                      }
                    }
                  },
                  required: [
                    "name",
                    "character",
                    "card_name",
                    "category",
                    "series",
                    "set_name",
                    "card_number",
                    "rarity",
                    "language",
                    "hp",
                    "visible_text",
                    "set_logo_or_era",
                    "artwork_description",
                    "estimated_value",
                    "low_value",
                    "high_value",
                    "confidence",
                    "condition_estimate",
                    "recommended_action",
                    "ai_explanation",
                    "possible_matches"
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

function pokemonQueryValue(value) {
  return String(value || "")
    .replaceAll('"', "")
    .replace(/[^\w\s-]/g, " ")
    .trim();
}

async function searchPokemonCards(item) {
  const clauses = [];
  const cardName = pokemonQueryValue(item.card_name || item.name);
  const setName = pokemonQueryValue(item.set_name || item.series);
  const cardNumber = pokemonQueryValue(item.card_number);
  const character = pokemonQueryValue(item.character);
  const isCharizard = /charizard/i.test(`${cardName} ${character} ${item.visible_text || ""}`);
  if (cardName) clauses.push(`name:"${cardName}"`);
  if (setName) clauses.push(`set.name:"${setName}"`);
  if (cardNumber) clauses.push(`number:"${cardNumber}"`);

  const queries = [
    isCharizard && cardNumber ? `name:"Charizard" number:"${cardNumber}"` : "",
    isCharizard ? `name:"Charizard"` : "",
    clauses.join(" "),
    [cardName ? `name:"${cardName}"` : "", cardNumber ? `number:"${cardNumber}"` : ""].filter(Boolean).join(" "),
    cardName ? `name:"${cardName}"` : ""
  ].filter(Boolean);
  const seen = new Set();
  const allCards = [];

  for (const query of queries) {
    const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}&pageSize=${isCharizard ? 50 : 12}`;
    const response = await fetch(url, {
      headers: {
        ...(pokemonTcgApiKey ? { "X-Api-Key": pokemonTcgApiKey } : {})
      }
    }).catch(() => null);
    if (!response?.ok) continue;
    const body = await response.json().catch(() => null);
    for (const card of body?.data || []) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      allCards.push(card);
    }
  }

  return rankPokemonCandidates(item, allCards).slice(0, isCharizard ? 10 : 5);
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/pokemon/g, "pokémon");
}

function hasBaseSetSignals(item) {
  const text = normalizeText([
    item.set_name,
    item.series,
    item.card_number,
    item.hp,
    item.visible_text,
    item.set_logo_or_era,
    item.artwork_description
  ].join(" "));
  return (
    text.includes("base set") ||
    text.includes("4/102") ||
    text.includes("120 hp") ||
    text.includes("1999") ||
    text.includes("wizards") ||
    text.includes("shadowless") ||
    text.includes("unlimited")
  );
}

function hasModern151Signals(item) {
  const text = normalizeText([
    item.set_name,
    item.series,
    item.card_number,
    item.visible_text,
    item.set_logo_or_era
  ].join(" "));
  return text.includes("151") || text.includes("sv") || text.includes("special illustration") || text.includes("charizard ex");
}

function scorePokemonCandidate(item, card) {
  const observed = normalizeText([
    item.card_name,
    item.name,
    item.character,
    item.set_name,
    item.series,
    item.card_number,
    item.hp,
    item.rarity,
    item.visible_text,
    item.set_logo_or_era,
    item.artwork_description
  ].join(" "));
  const cardName = normalizeText(card.name);
  const setName = normalizeText(card.set?.name);
  const cardNumber = normalizeText(card.number);
  const hp = normalizeText(card.hp);
  const rarity = normalizeText(card.rarity);
  const printedTotal = normalizeText(`${card.number}/${card.set?.printedTotal || ""}`);
  let score = 0;
  const reasons = [];

  if (cardName && observed.includes(cardName)) {
    score += 28;
    reasons.push("card name text");
  } else if (/charizard/i.test(observed) && /charizard/i.test(cardName)) {
    score += 18;
    reasons.push("character/name");
  }

  if (setName && observed.includes(setName)) {
    score += 24;
    reasons.push("set name");
  }

  if (cardNumber && observed.includes(cardNumber)) {
    score += 22;
    reasons.push("card number");
  }

  if (printedTotal && observed.includes(printedTotal)) {
    score += 24;
    reasons.push("full collector number");
  }

  if (hp && observed.includes(`${hp} hp`)) {
    score += 10;
    reasons.push("HP");
  }

  if (rarity && observed.includes(rarity)) {
    score += 8;
    reasons.push("visible rarity");
  }

  if (hasBaseSetSignals(item)) {
    if (/base set$/i.test(card.set?.name || "") || card.id === "base1-4") {
      score += 34;
      reasons.push("Base Set era");
    }
    if (/151|scarlet|violet|sv/i.test(card.set?.name || "")) {
      score -= 80;
      reasons.push("blocked modern 151 mismatch");
    }
  }

  if (hasModern151Signals(item) && /151/i.test(card.set?.name || "")) {
    score += 18;
    reasons.push("151 era");
  }

  return { card, score, reasons };
}

function rankPokemonCandidates(item, cards) {
  return cards
    .map((card) => scorePokemonCandidate(item, card))
    .sort((a, b) => b.score - a.score);
}

function canBeHighConfidence(item, ranked) {
  const observed = normalizeText([
    item.card_name,
    item.name,
    item.set_name,
    item.series,
    item.card_number,
    item.visible_text
  ].join(" "));
  const top = ranked?.[0];
  if (!top) return false;
  const card = top.card;
  const hasName = /charizard/i.test(observed) && /charizard/i.test(card.name || "");
  const hasSet = normalizeText(card.set?.name) && observed.includes(normalizeText(card.set?.name));
  const hasNumber =
    normalizeText(card.number) && (observed.includes(normalizeText(card.number)) || observed.includes(`${normalizeText(card.number)}/${card.set?.printedTotal || ""}`));
  return hasName && hasSet && hasNumber && top.score >= 70;
}

function getTcgPlayerPrice(card) {
  const priceGroups = Object.values(card?.tcgplayer?.prices || {});
  const marketPrices = priceGroups
    .flatMap((prices) => [prices.market, prices.mid, prices.low, prices.high])
    .filter((value) => Number.isFinite(Number(value)))
    .map(Number);
  if (!marketPrices.length) return null;
  const value = marketPrices[0];
  return {
    estimated_value: Math.round(value),
    low_value: Math.round(Math.min(...marketPrices)),
    high_value: Math.round(Math.max(...marketPrices)),
    source: "Pokemon TCG API / TCGPlayer"
  };
}

async function getExternalPricing(item, matchedCard) {
  const tcgPrice = getTcgPlayerPrice(matchedCard);
  return {
    tcgplayer: tcgPrice || {
      source: tcgPlayerApiKey ? "TCGPlayer API not connected for direct pricing yet" : "TCGPlayer credentials missing",
      unavailable: true
    },
    ebay: {
      source: ebayBearerToken ? "eBay sold listings integration pending endpoint approval" : "eBay credentials missing",
      unavailable: true
    },
    estimated_value: tcgPrice?.estimated_value || Number(item.estimated_value || 0),
    low_value: tcgPrice?.low_value || Number(item.low_value || item.estimated_value || 0),
    high_value: tcgPrice?.high_value || Number(item.high_value || item.estimated_value || 0)
  };
}

function cardToPossibleMatch(card, fallbackConfidence = 80, reasons = []) {
  return {
    card_name: card.name || "Unknown card",
    set_name: card.set?.name || "Unknown set",
    card_number: card.number || "",
    rarity: card.rarity || "Unknown rarity",
    confidence: fallbackConfidence,
    reference_image_url: card.images?.small || card.images?.large || "",
    pokemon_tcg_id: card.id || "",
    reason: reasons.length ? `Matched by ${reasons.join(", ")}.` : "Matched against Pokemon TCG card database."
  };
}

async function enrichCardIdentification(item) {
  const rankedMatches = await searchPokemonCards(item);
  const topRank = rankedMatches[0] || null;
  const matchedCard = topRank?.card || null;
  const pricing = await getExternalPricing(item, matchedCard);
  const highConfidenceAllowed = canBeHighConfidence(item, rankedMatches);
  const possibleMatches = rankedMatches.slice(0, 3).map((rank, index) =>
    cardToPossibleMatch(rank.card, Math.max(55, Math.min(89, rank.score - index * 4)), rank.reasons)
  );
  const confidence = Math.round(Number(item.confidence || 0));
  const exactConfidence = highConfidenceAllowed
    ? Math.min(98, Math.max(90, Math.round((confidence + topRank.score) / 2)))
    : Math.min(80, confidence, Math.max(50, topRank?.score || 50));
  const sourceLog = {
    vision: "OpenAI Vision",
    card_database: matchedCard ? "Pokemon TCG API" : "No Pokemon TCG API match",
    fallback: "disabled"
  };
  console.log(
    `[Glitch identify] sources=${sourceLog.vision},${sourceLog.card_database}; fallback=${sourceLog.fallback}; top="${matchedCard?.name || "none"}"; set="${matchedCard?.set?.name || "none"}"; confidence=${exactConfidence}`
  );

  return {
    ...item,
    name: matchedCard?.name || item.card_name || item.name,
    card_name: matchedCard?.name || item.card_name || item.name,
    category: "Trading Card",
    series: matchedCard?.set?.name || item.set_name || item.series,
    set_name: matchedCard?.set?.name || item.set_name || item.series,
    card_number: matchedCard?.number || item.card_number || "",
    rarity: matchedCard?.rarity || item.rarity || "Unknown",
    language: item.language || "Unknown",
    estimated_value: pricing.estimated_value,
    low_value: pricing.low_value,
    high_value: pricing.high_value,
    confidence: exactConfidence,
    marketplace_source: pricing.tcgplayer?.unavailable ? "AI estimate" : pricing.tcgplayer.source,
    reference_image_url: matchedCard?.images?.large || matchedCard?.images?.small || "",
    pokemon_tcg_id: matchedCard?.id || "",
    possible_matches: exactConfidence < 90 ? possibleMatches : [],
    pricing_sources: pricing,
    identification_sources: sourceLog,
    match_score: topRank?.score || 0,
    match_reasons: topRank?.reasons || [],
    ai_explanation:
      item.ai_explanation ||
      "Exact-card identification uses visible card text, set clues, card number, rarity, and Pokemon TCG database matching."
  };
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
      set_series: item.set_name || item.series,
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
      metadata: {
        character: item.character || "",
        card_name: item.card_name || item.name,
        set_name: item.set_name || item.series,
        card_number: item.card_number || "",
        rarity: item.rarity || "",
        language: item.language || "",
        reference_image_url: item.reference_image_url || "",
        pokemon_tcg_id: item.pokemon_tcg_id || "",
        possible_matches: item.possible_matches || [],
        pricing_sources: item.pricing_sources || {},
        identification_sources: item.identification_sources || {},
        match_score: item.match_score || 0,
        match_reasons: item.match_reasons || []
      },
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
    const rawIdentifications = await identifyWithOpenAi(photos);
    const identifications = await Promise.all(rawIdentifications.map(enrichCardIdentification));
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
  .listen(PORT, "0.0.0.0", () => {
    logReadinessChecks();
    console.log(`Server running on port ${PORT}`);
  });
