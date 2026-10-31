// Test-only transport control. Imported exclusively by the opt-in local fixture server.
import http from "node:http";
import net from "node:net";

export async function startFixtureProxy(controlToken) {
  let rules = [];
  const sockets = new Set();
  const track = socket => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); return socket; };
  const json = (res, status, data) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, "http://127.0.0.1").pathname;
    if (pathname === "/__maestro/control") {
      if (req.method !== "POST" || req.headers["x-maestro-control"] !== controlToken) return json(res, 403, { error: "Local fixture control denied" });
      try {
        let body = "";
        for await (const chunk of req) { body += chunk; if (body.length > 8192) throw new Error("Control body too large"); }
        const value = JSON.parse(body);
        if (!Array.isArray(value.rules) || value.rules.length > 5) throw new Error("Expected at most five rules");
        rules = value.rules.map(rule => {
          if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(rule.method) || !String(rule.path).startsWith("/api/v1/") || !["status", "disconnect"].includes(rule.mode)) throw new Error("Invalid local fault rule");
          if (rule.mode === "status" && ![401, 403, 413, 503].includes(rule.status)) throw new Error("Unsupported fault status");
          const times = rule.times ?? 1;
          if (!Number.isInteger(times) || times < 1 || times > 4) throw new Error("Invalid fault count");
          return { ...rule, remaining: times };
        });
        return json(res, 200, { configured: rules.length });
      } catch (error) { return json(res, 400, { error: error.message }); }
    }
    const rule = rules.find(item => item.remaining && req.method === item.method && pathname.startsWith(item.path));
    if (rule) {
      rule.remaining--;
      if (rule.mode === "disconnect") { req.socket.destroy(); return; }
      req.resume();
      return json(res, rule.status, { error: rule.message || "Maestro temporary failure" });
    }
    const upstream = http.request({ hostname: "127.0.0.1", port: 4401, method: req.method, path: req.url, headers: req.headers }, incoming => {
      res.writeHead(incoming.statusCode, incoming.headers);
      incoming.pipe(res);
    });
    upstream.on("socket", track);
    upstream.on("error", () => { if (!res.headersSent) json(res, 502, { error: "Local fixture backend is unavailable" }); else res.destroy(); });
    req.on("aborted", () => upstream.destroy());
    res.on("close", () => { if (!res.writableEnded) upstream.destroy(); });
    req.pipe(upstream);
  });
  server.on("connection", track);
  // Forward the complete WebSocket handshake and any bytes received with the upgrade.
  server.on("upgrade", (req, socket, head) => {
    if (!req.url.startsWith("/socket.io/")) { socket.destroy(); return; }
    const upstream = track(net.connect(4401, "127.0.0.1", () => {
      const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
      for (let index = 0; index < req.rawHeaders.length; index += 2) lines.push(`${req.rawHeaders[index]}: ${req.rawHeaders[index + 1]}`);
      upstream.write(lines.join("\r\n") + "\r\n\r\n");
      if (head.length) upstream.write(head);
      socket.pipe(upstream);
      upstream.pipe(socket);
    }));
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
    socket.on("close", () => upstream.destroy());
    upstream.on("close", () => socket.destroy());
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(4400, "127.0.0.1", resolve); });
  return {
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => server.close(resolve));
    },
  };
}
