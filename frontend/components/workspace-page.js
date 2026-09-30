"use client";
import Showcase from "./workspace/showcase";
import Courses from "./workspace/courses";
import Contests from "./workspace/contests";
import Webinars from "./workspace/webinars";
import AiAssistant from "./workspace/ai-assistant";
import LearnerDashboard from "./workspace/learner-dashboard";
import HirerDashboard from "./workspace/hirer-dashboard";
import JobManagement from "./workspace/job-management";
import SearchPage from "./workspace/search-page";
import Communities from "./workspace/communities";
import Jobs from "./workspace/jobs";
import Messages from "./workspace/messages";
import Profile from "./workspace/profile-page";
import Admin from "./workspace/admin";
import AdminDashboard from "./workspace/admin-dashboard";
import AdminModeration from "./workspace/admin-moderation";
import AdminSettings from "./workspace/admin-settings";
import { useUser } from "./shell";
export default function WorkspacePage({ section }) {
  const user = useUser();
  if (section === "dashboard")
    return user.role === "admin" ? <AdminDashboard /> : user.role === "learner" ? <LearnerDashboard /> : <HirerDashboard />;
  if (section === "moderation") return <AdminModeration />;
  if (section === "settings") return <AdminSettings />;
  if (section === "admin") return <Admin />;
  if (user.role === "admin" && ["courses", "contests", "webinars", "jobs"].includes(section))
    return <Admin key={section} initialTable={section} />;
  if (section === "showcase") return <Showcase />;
  if (section === "courses") return <Courses />;
  if (section === "contests") return <Contests />;
  if (section === "webinars") return <Webinars />;
  if (section === "ai") return <AiAssistant />;
  if (section === "job-management") return <JobManagement />;
  if (section === "search") return <SearchPage />;
  if (section === "communities") return <Communities />;
  if (section === "jobs") return <Jobs />;
  if (section === "messages") return <Messages />;
  if (section === "profile") return <Profile />;
  return <Admin />;
}
