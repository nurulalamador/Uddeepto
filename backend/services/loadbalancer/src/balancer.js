import http from "node:http";

const HOP_BY_HOP = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];
// Safe to send again to another instance when the first attempt failed before any response.
const RETRYABLE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CONNECTION_ERRORS = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EPIPE",
]);

/**
 * A small HTTP load balancer: round-robin (or least-connections) over healthy
 * targets, active health checks, passive failure detection and retry of
 * idempotent requests. Bodies are streamed, never buffered, so large uploads
 * and Range downloads pass straight through.
 */
export function createBalancer({
  targets,
  strategy = "round-robin",
  healthPath = "/health",
  healthInterval = 5000,
  healthTimeout = 2000,
  failThreshold = 2,
  connectTimeout = 5000,
  maxAttempts = 2,
  name = "uddeepto-lb",
  log = console.log,
} = {}) {
  const urls = [
    ...new Set(
      (targets || [])
        .map((target) => String(target).trim().replace(/\/$/, ""))
        .filter(Boolean),
    ),
  ];
  if (!urls.length) throw new Error("At least one load balancer target is required");

  const agent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 10000,
    maxSockets: Infinity,
  });
  const backends = urls.map((url) => {
    const parsed = new URL(url);
    return {
      url,
      host: parsed.hostname,
      port: Number(parsed.port) || 80,
      healthy: true,
      failures: 0,
      active: 0,
      served: 0,
      errors: 0,
      lastCheck: null,
      lastError: null,
    };
  });
  let cursor = 0;
  let timer = null;

  function markDown(backend, reason) {
    backend.failures = Math.max(backend.failures + 1, failThreshold);
    backend.lastError = reason;
    if (backend.healthy) {
      backend.healthy = false;
      log(`[${name}] ${backend.url} is DOWN (${reason})`);
    }
  }
  function markUp(backend) {
    backend.failures = 0;
    backend.lastError = null;
    if (!backend.healthy) {
      backend.healthy = true;
      log(`[${name}] ${backend.url} is UP`);
    }
  }

  function check(backend) {
    return new Promise((resolve) => {
      const failed = (reason) => {
        backend.failures += 1;
        backend.lastError = reason;
        if (backend.failures >= failThreshold) markDown(backend, reason);
        resolve();
      };
      const request = http.get(
        {
          host: backend.host,
          port: backend.port,
          path: healthPath,
          timeout: healthTimeout,
          agent: false,
        },
        (response) => {
          response.resume();
          backend.lastCheck = new Date().toISOString();
          if (response.statusCode >= 200 && response.statusCode < 400) {
            markUp(backend);
            resolve();
          } else failed(`HTTP ${response.statusCode}`);
        },
      );
      request.on("timeout", () => request.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })));
      request.on("error", (error) => {
        backend.lastCheck = new Date().toISOString();
        failed(error.code || error.message);
      });
    });
  }
  const checkAll = () => Promise.all(backends.map(check));
  // Healthy gateways are probed every healthInterval; ones that are down are probed
  // every second so a restarted gateway rejoins quickly.
  const sweep = () => {
    const now = Date.now();
    return Promise.all(
      backends
        .filter((b) => !b.healthy || now - (b.checkedAt || 0) >= healthInterval - 50)
        .map((b) => {
          b.checkedAt = now;
          return check(b);
        }),
    );
  };

  /** Next healthy backend that has not already been tried for this request. */
  function pick(tried) {
    const pool = backends.filter((b) => b.healthy && !tried.has(b));
    if (!pool.length) return null;
    if (strategy === "least-connections") {
      return pool.reduce((best, b) => (b.active < best.active ? b : best));
    }
    for (let step = 0; step < backends.length; step += 1) {
      const candidate = backends[(cursor + step) % backends.length];
      if (pool.includes(candidate)) {
        cursor = (cursor + step + 1) % backends.length;
        return candidate;
      }
    }
    return pool[0];
  }

  function forwardHeaders(req) {
    const headers = { ...req.headers };
    for (const key of HOP_BY_HOP) delete headers[key];
    const client = req.socket.remoteAddress;
    headers["x-forwarded-for"] = headers["x-forwarded-for"]
      ? `${headers["x-forwarded-for"]}, ${client}`
      : client;
    headers["x-forwarded-proto"] ||= req.socket.encrypted ? "https" : "http";
    if (req.headers.host) headers["x-forwarded-host"] ||= req.headers.host;
    return headers;
  }

  function reply(res, status, message, extra = {}) {
    if (res.headersSent) return res.destroy();
    res.writeHead(status, {
      "Content-Type": "application/json",
      "X-Load-Balancer": name,
      ...extra,
    });
    res.end(JSON.stringify({ error: message }));
  }

  function handle(req, res) {
    const tried = new Set();
    const retryable = RETRYABLE_METHODS.has(req.method);
    let upstream = null;
    res.on("close", () => {
      if (!res.writableFinished) upstream?.destroy();
    });

    const attempt = () => {
      const backend = pick(tried);
      if (!backend) {
        return reply(res, 503, "Service temporarily unavailable. Please try again in a moment.", {
          "Retry-After": "5",
        });
      }
      tried.add(backend);
      backend.active += 1;
      let released = false;
      const release = () => {
        if (!released) {
          released = true;
          backend.active -= 1;
        }
      };

      const current = http.request(
        {
          host: backend.host,
          port: backend.port,
          method: req.method,
          path: req.url,
          headers: forwardHeaders(req),
          agent,
        },
        (response) => {
          clearTimeout(connectTimer);
          backend.served += 1;
          const headers = { ...response.headers };
          for (const key of HOP_BY_HOP) delete headers[key];
          headers["x-load-balancer"] = name;
          res.writeHead(response.statusCode, response.statusMessage, headers);
          response.on("error", () => res.destroy());
          response.on("end", release);
          response.on("close", release);
          response.pipe(res);
        },
      );
      upstream = current;

      const connectTimer = setTimeout(() => {
        current.destroy(Object.assign(new Error("connect timed out"), { code: "ETIMEDOUT" }));
      }, connectTimeout);
      current.on("socket", (socket) => {
        if (socket.connecting) socket.once("connect", () => clearTimeout(connectTimer));
        else clearTimeout(connectTimer);
      });
      current.on("error", (error) => {
        clearTimeout(connectTimer);
        release();
        if (res.destroyed || upstream !== current) return;
        backend.errors += 1;
        const connectionProblem = CONNECTION_ERRORS.has(error.code);
        if (connectionProblem) markDown(backend, error.code);
        if (!res.headersSent && connectionProblem && retryable && tried.size < maxAttempts) {
          return attempt();
        }
        reply(res, 502, "Bad gateway");
      });

      req.pipe(current);
    };
    attempt();
  }

  return {
    handle,
    backends,
    checkAll,
    start() {
      sweep();
      timer = setInterval(sweep, Math.min(1000, healthInterval));
      timer.unref();
    },
    stop() {
      clearInterval(timer);
      agent.destroy();
    },
    status() {
      return {
        name,
        strategy,
        healthy: backends.filter((b) => b.healthy).length,
        total: backends.length,
        backends: backends.map(
          ({ url, healthy, active, served, errors, failures, lastCheck, lastError }) => ({
            url,
            healthy,
            active,
            served,
            errors,
            failures,
            lastCheck,
            lastError,
          }),
        ),
      };
    },
  };
}
