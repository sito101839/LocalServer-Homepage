const http = require("node:http");
const { execFile } = require("node:child_process");

const port = Number.parseInt(process.env.PORT || "8788", 10);
const cacheTtlMs = Number.parseInt(process.env.CACHE_TTL_MS || "5000", 10);

let cachedGpu = null;
let cachedAt = 0;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function toNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function queryNvidiaSmi() {
  const args = [
    "--query-gpu=index,name,utilization.gpu,memory.used,memory.total,temperature.gpu",
    "--format=csv,noheader,nounits",
  ];

  return new Promise((resolve, reject) => {
    execFile("/usr/bin/nvidia-smi", args, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
        return;
      }

      const line = stdout.trim().split("\n")[0];
      if (!line) {
        reject(new Error("nvidia-smi returned no GPU rows."));
        return;
      }

      const [index, name, utilization, memoryUsed, memoryTotal, temperature] =
        line.split(",").map((part) => part.trim());

      resolve({
        service: "GPU",
        index: toNumber(index),
        name,
        utilization_gpu: toNumber(utilization),
        memory_used: toNumber(memoryUsed),
        memory_total: toNumber(memoryTotal),
        temperature: toNumber(temperature),
        fetched_at: new Date().toISOString(),
      });
    });
  });
}

async function getCachedGpu() {
  const now = Date.now();

  if (cachedGpu && now - cachedAt < cacheTtlMs) {
    return cachedGpu;
  }

  cachedGpu = await queryNvidiaSmi();
  cachedAt = now;
  return cachedGpu;
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

  if (request.url !== "/gpu") {
    sendJson(response, 404, { error: "Not Found" });
    return;
  }

  try {
    sendJson(response, 200, await getCachedGpu());
  } catch (error) {
    console.error("Failed to fetch GPU status:", error.message);
    sendJson(response, 503, {
      service: "GPU",
      utilization_gpu: 0,
      memory_used: 0,
      memory_total: 0,
      temperature: 0,
      error: error.message,
      fetched_at: new Date().toISOString(),
    });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`GPU status API listening on port ${port}.`);
});
