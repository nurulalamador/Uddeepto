import { redirect } from "next/navigation";
import { canAccess } from "@/lib/roles";
import { currentUser } from "@/lib/server";
import { PreviousContests } from "@/components/workspace/contests";

export default async function Page() {
  const user = await currentUser();
  if (user && !canAccess(user.role, "contests")) redirect("/dashboard");
  return <PreviousContests />;
}
