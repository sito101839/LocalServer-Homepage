const http = require("node:http");

const port = Number.parseInt(process.env.PORT || "8789", 10);
const cacheTtlMs = Number.parseInt(process.env.CACHE_TTL_MS || "5000", 10);
const runtimeUrl = process.env.XTCG_RUNTIME_URL || "http://xtcg-api:8000/training/runtime-status";

let cachedRuntime = null;
let cachedAt = 0;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function toCount(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function titleCase(value) {
  return String(value || "unknown")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function shortId(value) {
  return String(value || "unknown").slice(0, 8);
}

function summarizeRuntime(payload) {
  const workers = Array.isArray(payload.workers) ? payload.workers : [];
  const healthyWorkers = workers.filter((worker) => worker.healthy).length;
  const queue = payload.queue || {};
  const queued = toCount(queue.queued);
  const running = toCount(queue.running);
  const cancelRequested = toCount(queue.cancel_requested);
  const failures = Array.isArray(payload.recent_failures) ? payload.recent_failures : [];
  const executor = payload.executor;
  const executorKind = executor && (executor.owner_type || executor.kind || executor.type);

  return {
    service: "XTCG",
    status: String(payload.status || "unavailable"),
    worker_label: `${healthyWorkers}/${workers.length} healthy`,
    executor_label: executor
      ? `${titleCase(executorKind || "executor")} (${executor.status || "active"})`
      : "None",
    queue_label: `${queued} queued / ${running} running / ${cancelRequested} cancel`,
    failure_label: failures.length ? `${failures.length} recorded` : "None",
    image_revision: String(payload.image_revision || "unknown").slice(0, 12),
    fetched_at: new Date().toISOString(),
  };
}

function describeJob(job) {
  const progress = job.progress || {};
  const stage = job.status === "queued" && job.queue_position
    ? `Queue #${job.queue_position}`
    : titleCase(progress.stage || job.status || "unknown");

  return `${titleCase(job.job_type || "job")} - ${stage}`;
}

function summarizeCurrentWork(payload) {
  const jobs = Array.isArray(payload.active_jobs) ? payload.active_jobs : [];
  const groups = Array.isArray(payload.active_groups) ? payload.active_groups : [];
  const queue = payload.queue || {};
  const running = toCount(queue.running);
  const queued = toCount(queue.queued);
  const activeJob = jobs.find((job) => job.status !== "queued");
  const nextJob = jobs.find((job) => job.status === "queued");
  const group = groups[0];
  const counts = group?.counts || {};
  const terminal = toCount(counts.terminal);
  const total = toCount(counts.total);
  const groupRunning = toCount(counts.running);
  const groupQueued = toCount(counts.queued);
  const batchState = groupRunning || groupQueued
    ? ` / ${groupRunning} running / ${groupQueued} queued`
    : "";

  return {
    work_label: running || queued ? `${running} running / ${queued} queued` : "Idle",
    current_label: activeJob ? describeJob(activeJob) : "None",
    next_label: nextJob ? describeJob(nextJob) : "None",
    batch_label: group
      ? `${group.name || `Batch ${shortId(group.group_id)}`}: ${terminal}/${total} complete${batchState}`
      : "None",
    fetched_at: new Date().toISOString(),
  };
}

async function fetchRuntime() {
  const response = await fetch(runtimeUrl, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    throw new Error(`XTCG runtime API returned HTTP ${response.status}.`);
  }

  return response.json();
}

async function getCachedRuntime() {
  const now = Date.now();
  if (cachedRuntime && now - cachedAt < cacheTtlMs) {
    return cachedRuntime;
  }

  cachedRuntime = await fetchRuntime();
  cachedAt = now;
  return cachedRuntime;
}

function unavailableRuntime(error) {
  return {
    service: "XTCG",
    status: "unavailable",
    worker_label: "Unavailable",
    executor_label: "Unavailable",
    queue_label: "Unavailable",
    failure_label: "Unavailable",
    image_revision: "unknown",
    error: error.message,
    fetched_at: new Date().toISOString(),
  };
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

  if (!["/runtime", "/current-work"].includes(request.url)) {
    sendJson(response, 404, { error: "Not Found" });
    return;
  }

  try {
    const runtime = await getCachedRuntime();
    const payload = request.url === "/runtime" ? summarizeRuntime(runtime) : summarizeCurrentWork(runtime);
    sendJson(response, 200, payload);
  } catch (error) {
    console.error("Failed to fetch XTCG runtime status:", error.message);
    if (request.url === "/runtime") {
      sendJson(response, 503, unavailableRuntime(error));
      return;
    }

    sendJson(response, 503, {
      work_label: "Unavailable",
      current_label: "Check XTCG API",
      next_label: "Unavailable",
      batch_label: "Unavailable",
      error: error.message,
      fetched_at: new Date().toISOString(),
    });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`XTCG runtime API listening on port ${port}.`);
});
