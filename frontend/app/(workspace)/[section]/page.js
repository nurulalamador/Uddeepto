import { notFound, redirect } from "next/navigation";
import { sections, canAccess } from "@/lib/roles";
import { currentUser } from "@/lib/server";
import WorkspacePage from "@/components/workspace-page";
export default async function Page({ params }) {
  const { section } = await params;
  if (!sections[section]) notFound();
  const user = await currentUser();
  if (user && !canAccess(user.role, section)) redirect("/dashboard");
  return <WorkspacePage section={section} />;
}
