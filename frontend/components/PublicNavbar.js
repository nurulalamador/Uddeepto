import Link from "next/link";

export default function PublicNavbar({ isLoggedIn = false }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-6 lg:px-8" aria-label="Main navigation">
        <Link href="/" className="flex items-center gap-3 font-black tracking-tight text-slate-950">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-sm text-white">SP</span>
          <span>Scale Platform</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/" className="hidden text-sm font-medium text-slate-600 hover:text-slate-950 sm:block">Home</Link>
          <Link href="/about" className="hidden text-sm font-medium text-slate-600 hover:text-slate-950 sm:block">About</Link>

          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Login</Link>
              <Link href="/signup" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Sign up</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
