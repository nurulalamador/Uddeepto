import { notFound, redirect } from "next/navigation";
import { sections, canAccess } from "@/lib/roles";
import { currentUser } from "@/lib/server";
import WorkspacePage from "@/components/workspace-page";
export default async function Page({ params, searchParams }) {
  const { section } = await params;
  if (!sections[section]) notFound();
  const user = await currentUser();
  if (user?.role === "hirer" && section === "jobs") redirect("/job-management");
  // /profile is the person's own profile at its permanent address: go there directly instead of loading twice.
  if (section === "profile" && user?.uddeepto_id && !(await searchParams).user) redirect(`/profile/${user.uddeepto_id}`);
  if (user && !canAccess(user.role, section)) redirect("/dashboard");
  return <WorkspacePage section={section} />;
}
