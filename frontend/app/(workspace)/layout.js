import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server";
import Shell from "@/components/shell";
import SessionRecovery from "@/components/session-recovery";
export const dynamic = "force-dynamic";
export default async function Layout({ children }) {
  const jar = await cookies();
  if (!jar.has("ud_access") && !jar.has("ud_refresh")) redirect("/login");
  const user = await currentUser();
  if (!user) return <SessionRecovery />;
  return <Shell user={user}>{children}</Shell>;
}
