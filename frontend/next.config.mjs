// NEXT_DIST_DIR lets a verification build (`NEXT_DIST_DIR=.next-verify next build`) run without touching the dev server's .next folder.
export default { poweredByHeader: false, experimental: { cpus: 2 }, distDir: process.env.NEXT_DIST_DIR || ".next" };
