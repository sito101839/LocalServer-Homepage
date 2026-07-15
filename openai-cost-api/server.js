const http = require("node:http");

const port = Number.parseInt(process.env.PORT || "8790", 10);
const cacheTtlMs = Number.parseInt(process.env.CACHE_TTL_MS || "600000", 10);
const openaiAdminKey = process.env.OPENAI_ADMIN_KEY;

let cachedCosts = null;
let cachedAt = 0;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function currentMonthRange(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  return {
    startTime: Math.floor(start.getTime() / 1000),
    endTime: Math.floor(now.getTime() / 1000),
    period: start.toISOString().slice(0, 7),
  };
}

function summarizeCosts(pages, period, fetchedAt = new Date()) {
  let total = 0;
  let currency = "USD";

  for (const page of pages) {
    for (const bucket of Array.isArray(page.data) ? page.data : []) {
      for (const result of Array.isArray(bucket.results) ? bucket.results : []) {
        const value = Number(result?.amount?.value);
        if (Number.isFinite(value)) {
          total += value;
        }

        if (result?.amount?.currency) {
          currency = String(result.amount.currency).toUpperCase();
        }
      }
    }
  }

  return {
    service: "OpenAI",
    is_available: true,
    currency,
    month_spend: total.toFixed(2),
    period,
    fetched_at: fetchedAt.toISOString(),
  };
}

async function fetchOpenaiCosts(now = new Date()) {
  if (!openaiAdminKey) {
    const error = new Error("OPENAI_ADMIN_KEY is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const { startTime, endTime, period } = currentMonthRange(now);
  const pages = [];
  let pageCursor = null;

  do {
    const url = new URL("https://api.openai.com/v1/organization/costs");
    url.searchParams.set("start_time", String(startTime));
    url.searchParams.set("end_time", String(endTime));
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "31");
    if (pageCursor) {
      url.searchParams.set("page", pageCursor);
    }

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${openaiAdminKey}`,
      },
    });

    if (!response.ok) {
      const error = new Error(`OpenAI costs API returned HTTP ${response.status}.`);
      error.statusCode = 502;
      throw error;
    }

    const payload = await response.json();
    pages.push(payload);
    pageCursor = payload.has_more ? payload.next_page : null;
  } while (pageCursor);

  return summarizeCosts(pages, period, now);
}

async function getCachedCosts() {
  const now = Date.now();

  if (cachedCosts && now - cachedAt < cacheTtlMs) {
    return cachedCosts;
  }

  cachedCosts = await fetchOpenaiCosts();
  cachedAt = now;
  return cachedCosts;
}

const server = http.createServer(async (request, response) => {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method Not Allowed" });
    return;
  }

  if (request.url === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.url !== "/costs") {
    sendJson(response, 404, { error: "Not Found" });
    return;
  }

  try {
    sendJson(response, 200, await getCachedCosts());
  } catch (error) {
    console.error("Failed to fetch OpenAI costs:", error.message);
    sendJson(response, error.statusCode || 500, {
      service: "OpenAI",
      is_available: false,
      currency: "USD",
      month_spend: "0.00",
      period: currentMonthRange().period,
      error: error.message,
      fetched_at: new Date().toISOString(),
    });
  }
});

if (require.main === module) {
  server.listen(port, "0.0.0.0", () => {
    console.log(`OpenAI costs API listening on port ${port}.`);
  });
}

module.exports = { currentMonthRange, summarizeCosts };
