import { redirect } from "next/navigation";
import { canAccess } from "@/lib/roles";
import { currentUser } from "@/lib/server";
import JobDetail from "@/components/workspace/job-detail";

export default async function Page({ params }) {
  const { jobId } = await params;
  const user = await currentUser();
  if (user && !canAccess(user.role, "jobs")) redirect("/dashboard");
  return <JobDetail jobId={jobId} />;
}
