import { redirect } from "next/navigation";
import { canAccess } from "@/lib/roles";
import { currentUser } from "@/lib/server";
import { PreviousWebinars } from "@/components/workspace/webinars";

export default async function Page() {
  const user = await currentUser();
  if (user && !canAccess(user.role, "webinars")) redirect("/dashboard");
  return <PreviousWebinars />;
}
