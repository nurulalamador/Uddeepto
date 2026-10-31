import { createProxyMiddleware } from "http-proxy-middleware";

export function registerProxyRoutes(app, { services, frontendApiUrl }) {
  for (const [area, target] of Object.entries(services)) {
    app.use(`/api/v1/${area}`, createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: url => area === "showcase" ? "/showcase" + url : url,
    }));
  }

  // Frontend API owns the sockets. Keep both WebSocket and HTTP paths intact.
  const live = createProxyMiddleware({
    target: frontendApiUrl,
    changeOrigin: true,
    ws: true,
    pathFilter: "/socket.io",
  });
  app.use(live);
  app.use("/api/v1/frontend", createProxyMiddleware({
    target: frontendApiUrl,
    changeOrigin: true,
  }));
  return live;
}
