import { notFound, redirect } from "next/navigation";
import { canAccess } from "@/lib/roles";
import { currentUser } from "@/lib/server";
import ShowcasePostPage from "@/components/workspace/showcase-post-page";

export default async function Page({ params }) {
  const { section, postId } = await params;
  if (section !== "showcase") notFound();

  const user = await currentUser();
  if (user && !canAccess(user.role, section) && user.role !== "admin") redirect("/dashboard");

  return <ShowcasePostPage postId={postId} />;
}
