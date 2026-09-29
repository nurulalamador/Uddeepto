import { redirect } from "next/navigation";
import { canAccess } from "@/lib/roles";
import { currentUser } from "@/lib/server";
import WebinarDetail from "@/components/workspace/webinar-detail";

export default async function Page({ params }) {
  const { webinarId } = await params;
  const user = await currentUser();
  if (user && !canAccess(user.role, "webinars")) redirect("/dashboard");
  return <WebinarDetail webinarId={webinarId} />;
}
