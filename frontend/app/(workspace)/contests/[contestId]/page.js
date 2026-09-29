import { redirect } from "next/navigation";
import { canAccess } from "@/lib/roles";
import { currentUser } from "@/lib/server";
import ContestDetail from "@/components/workspace/contest-detail";

export default async function Page({ params }) {
  const { contestId } = await params;
  const user = await currentUser();
  if (user && !canAccess(user.role, "contests")) redirect("/dashboard");
  return <ContestDetail contestId={contestId} />;
}
