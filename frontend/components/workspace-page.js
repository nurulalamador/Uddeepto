"use client";
import Dashboard from "./workspace/dashboard";
import Showcase from "./workspace/showcase";
import Catalog from "./workspace/catalog";
import Communities from "./workspace/communities";
import Jobs from "./workspace/jobs";
import Messages from "./workspace/messages";
import Profile from "./workspace/profile";
import Admin from "./workspace/admin";
import AdminDashboard from "./workspace/admin-dashboard";
import AdminModeration from "./workspace/admin-moderation";
import AdminSettings from "./workspace/admin-settings";
import { useUser } from "./shell";
export default function WorkspacePage({ section }) {
  const user = useUser();
  if (section === "dashboard")
    return user.role === "admin" ? <AdminDashboard /> : <Dashboard />;
  if (section === "moderation") return <AdminModeration />;
  if (section === "settings") return <AdminSettings />;
  if (section === "admin") return <Admin />;
  if (user.role === "admin" && ["courses", "contests", "webinars", "jobs"].includes(section))
    return <Admin key={section} initialTable={section} />;
  if (section === "showcase") return <Showcase />;
  if (["courses", "contests", "webinars"].includes(section))
    return <Catalog kind={section} key={section} />;
  if (section === "communities") return <Communities />;
  if (section === "jobs") return <Jobs />;
  if (section === "messages") return <Messages />;
  if (section === "profile") return <Profile />;
  return <Admin />;
}
