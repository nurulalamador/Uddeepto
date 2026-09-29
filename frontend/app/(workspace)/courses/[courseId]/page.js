import { redirect } from "next/navigation";
import { canAccess } from "@/lib/roles";
import { currentUser } from "@/lib/server";
import CourseDetail from "@/components/workspace/course-detail";

export default async function Page({ params }) {
  const { courseId } = await params;
  const user = await currentUser();
  if (user && !canAccess(user.role, "courses")) redirect("/dashboard");
  return <CourseDetail courseId={courseId} />;
}
