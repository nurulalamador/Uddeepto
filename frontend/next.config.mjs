// NEXT_DIST_DIR lets a verification build (`NEXT_DIST_DIR=.next-verify next build`) run without touching the dev server's .next folder.
//
// allowedDevOrigins: when the dev server is opened from another address (a phone or a second computer
// on the same network, or http://192.168.x.x:3000 on this one) Next.js blocks that origin's hot-reload
// connection, and the page then never finishes loading its JavaScript: forms submit like plain HTML and
// the page just reloads. Private-network addresses are allowed in development; add more with
// NEXT_ALLOWED_DEV_ORIGINS="my-laptop.local,192.0.2.7". This has no effect on production builds.
const extraDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export default {
  output: 'standalone',
  poweredByHeader: false,
  // Shared hosting caps the number of processes (spawn EAGAIN), so build with one worker thread instead of child processes.
  // On Windows that mode sometimes fails to write files, so local builds keep the normal settings.
  experimental: process.platform === "win32" ? { cpus: 2 } : { cpus: 1, workerThreads: true, webpackBuildWorker: false },
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local", ...extraDevOrigins],
};
