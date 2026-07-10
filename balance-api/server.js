const http = require("node:http");

const port = Number.parseInt(process.env.PORT || "8787", 10);
const cacheTtlMs = Number.parseInt(process.env.CACHE_TTL_MS || "300000", 10);
const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

let cachedBalance = null;
let cachedAt = 0;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function selectBalanceInfo(payload) {
  const balanceInfos = Array.isArray(payload.balance_infos) ? payload.balance_infos : [];
  return balanceInfos.find((info) => info.currency === "USD") || balanceInfos[0] || {};
}

async function fetchDeepseekBalance() {
  if (!deepseekApiKey) {
    const error = new Error("DEEPSEEK_API_KEY is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch("https://api.deepseek.com/user/balance", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${deepseekApiKey}`,
    },
  });

  if (!response.ok) {
    const error = new Error(`DeepSeek balance API returned HTTP ${response.status}.`);
    error.statusCode = 502;
    throw error;
  }

  const payload = await response.json();
  const selectedInfo = selectBalanceInfo(payload);

  return {
    service: "DeepSeek",
    is_available: Boolean(payload.is_available),
    currency: selectedInfo.currency || "USD",
    total_balance: selectedInfo.total_balance || "0",
    granted_balance: selectedInfo.granted_balance || "0",
    topped_up_balance: selectedInfo.topped_up_balance || "0",
    fetched_at: new Date().toISOString(),
  };
}

async function getCachedBalance() {
  const now = Date.now();

  if (cachedBalance && now - cachedAt < cacheTtlMs) {
    return cachedBalance;
  }

  cachedBalance = await fetchDeepseekBalance();
  cachedAt = now;
  return cachedBalance;
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

  if (request.url !== "/balance") {
    sendJson(response, 404, { error: "Not Found" });
    return;
  }

  try {
    sendJson(response, 200, await getCachedBalance());
  } catch (error) {
    console.error("Failed to fetch DeepSeek balance:", error.message);
    sendJson(response, error.statusCode || 500, {
      service: "DeepSeek",
      is_available: false,
      currency: "USD",
      total_balance: "0",
      error: error.message,
      fetched_at: new Date().toISOString(),
    });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`DeepSeek balance API listening on port ${port}.`);
});
