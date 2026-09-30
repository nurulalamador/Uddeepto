import { notFound } from "next/navigation";
import ProfilePage from "@/components/workspace/profile-page";

export default async function Page({ params }) {
  const { ref } = await params;
  if (!/^(\d{3}-\d{3}-\d{3}|[0-9a-fA-F-]{36})$/.test(ref)) notFound();
  return <ProfilePage refId={ref} />;
}
