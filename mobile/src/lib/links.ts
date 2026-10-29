import { Linking } from "react-native";
import type { Href } from "expo-router";

export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL || "https://uddeepto.kodofact.com").replace(/\/$/, "");

/**
 * Turns an address from the website (the "link" of a notification, the "href" of a search result) into a screen of
 * the app.
 */
export function routeFor(href?: string | null): Href | null {
  if (!href) return null;
  const path = href.split(/[?#]/)[0];
  let match;
  if ((match = /^\/showcase\/([\w-]+)$/.exec(path))) return `/post/${match[1]}` as Href;
  if ((match = /^\/contests\/([\w-]+)$/.exec(path)) && match[1] !== "previous") return `/contest/${match[1]}` as Href;
  if ((match = /^\/webinars\/([\w-]+)$/.exec(path)) && match[1] !== "previous") return `/webinar/${match[1]}` as Href;
  if ((match = /^\/courses\/([\w-]+)\/materials\/([\w-]+)$/.exec(path))) return `/course/${match[1]}/${match[2]}` as Href;
  if ((match = /^\/courses\/([\w-]+)$/.exec(path))) return `/course/${match[1]}` as Href;
  if ((match = /^\/instructors\/([\w-]+)$/.exec(path))) return `/instructor/${match[1]}` as Href;
  if ((match = /^\/jobs\/([\w-]+)$/.exec(path))) return `/job/${match[1]}` as Href;
  if ((match = /^\/communities\/([\w-]+)$/.exec(path))) return `/community/${match[1]}` as Href;
  if ((match = /^\/profile\/([\w-]+)$/.exec(path))) return `/user/${match[1]}` as Href;
  if (path === "/showcase") return "/showcase" as Href;
  if (path === "/contests" || path === "/webinars") return "/events" as Href;
  if (path === "/jobs") return "/jobs" as Href;
  if (path === "/courses") return "/courses" as Href;
  if (path === "/job-posts" || path === "/applicants") return "/hiring" as Href;
  if (path === "/cv" || path === "/ai") return path as Href;
  if (path === "/messages") return "/messages" as Href;
  if (path === "/notifications") return "/notifications" as Href;
  if (path === "/dashboard") return "/" as Href;
  if (path === "/profile") return "/profile" as Href;
  return null;
}

export function openOnWeb(href: string) {
  return Linking.openURL(`${WEB_URL}${href.startsWith("/") ? href : `/${href}`}`);
}
