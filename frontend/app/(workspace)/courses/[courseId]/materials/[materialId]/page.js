import { redirect } from "next/navigation";
import { canAccess } from "@/lib/roles";
import { currentUser } from "@/lib/server";
import CourseMaterial from "@/components/workspace/course-material";

export default async function Page({ params }) {
  const { courseId, materialId } = await params;
  const user = await currentUser();
  if (user && !canAccess(user.role, "courses")) redirect("/dashboard");
  return <CourseMaterial courseId={courseId} materialId={materialId} />;
}
