import { redirect } from "next/navigation";
import { canAccess } from "@/lib/roles";
import { currentUser } from "@/lib/server";
import CommunityPage from "@/components/workspace/community-page";

export default async function Page({ params }) {
  const { communityId } = await params;
  const user = await currentUser();
  if (user && !canAccess(user.role, "communities")) redirect("/dashboard");
  return <CommunityPage communityId={communityId} />;
}
