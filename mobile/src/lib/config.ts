// The one backend: the same API the website uses. Nothing here is specific to the phone.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "https://api.uddeepto.kodofact.com/api/v1").replace(/\/$/, "");
// Socket.IO lives at the root of the same host.
export const SOCKET_URL = API_URL.replace(/\/api\/v1$/, "");

/** The website's palette, so the app and the site feel like one product. */
export const colors = {
  green: "#19704f",
  greenDeep: "#124b36",
  greenDark: "#0e4635",
  greenBright: "#42a675",
  greenSoft: "#e6f3eb",
  orange: "#e77b38",
  orangeSoft: "#fff0e5",
  orangeLight: "#ffc28b",
  red: "#c24848",
  redSoft: "#fdeeed",
  bg: "#f4f7f5",
  card: "#ffffff",
  surfaceMuted: "#f1f5f2",
  text: "#17271f",
  muted: "#5d6e64",
  subtle: "#87968d",
  border: "#e1e9e3",
  borderStrong: "#cddad1",
};

export const gradients = {
  hero: ["#0e4635", "#17684a", "#1f8c62"] as const,
  brand: ["#42a675", "#124b36"] as const,
  ai: ["#19704f", "#e77b38"] as const,
  soft: ["#e6f3eb", "#ffffff"] as const,
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 26 };
export const shadow = { shadowColor: "#0e2a1e", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 } as const;
