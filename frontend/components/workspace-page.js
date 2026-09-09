"use client";
import Dashboard from "./workspace/dashboard";
import Showcase from "./workspace/showcase";
import Catalog from "./workspace/catalog";
import Communities from "./workspace/communities";
import Jobs from "./workspace/jobs";
import Messages from "./workspace/messages";
import Profile from "./workspace/profile";
import Admin from "./workspace/admin";
export default function WorkspacePage({ section }) {
  if (section === "dashboard") return <Dashboard />;
  if (section === "showcase") return <Showcase />;
  if (["courses", "contests", "webinars"].includes(section))
    return <Catalog kind={section} key={section} />;
  if (section === "communities") return <Communities />;
  if (section === "jobs") return <Jobs />;
  if (section === "messages") return <Messages />;
  if (section === "profile") return <Profile />;
  return <Admin />;
}
