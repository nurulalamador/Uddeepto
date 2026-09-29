import { redirect } from "next/navigation";
import { canAccess } from "@/lib/roles";
import { currentUser } from "@/lib/server";
import InstructorProfile from "@/components/workspace/instructor-profile";

export default async function Page({ params }) {
  const { instructorId } = await params;
  const user = await currentUser();
  if (user && !canAccess(user.role, "courses")) redirect("/dashboard");
  return <InstructorProfile instructorId={instructorId} />;
}
