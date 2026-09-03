import PublicNavbar from "../../components/PublicNavbar";
import { hasSessionCookie } from "../../lib/server-auth";

export default async function PublicLayout({ children }) {
  const isLoggedIn = await hasSessionCookie();

  return (
    <div className="min-h-screen bg-white">
      <PublicNavbar isLoggedIn={isLoggedIn} />
      {children}
    </div>
  );
}
