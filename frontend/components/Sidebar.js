"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const links = [
  ["/dashboard", "Dashboard"],
  ["/courses", "Courses"],
  ["/contests", "Contests"],
  ["/communities", "Communities"],
  ["/jobs", "Jobs"],
];

export default function Sidebar({ user }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  const initials = (user?.name || user?.email || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 md:hidden">
        <Link href="/dashboard" className="font-black">Scale Platform</Link>
        <button onClick={() => setOpen((value) => !value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">
          Menu
        </button>
      </div>

      {open ? <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/30 md:hidden" onClick={() => setOpen(false)} /> : null}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white p-5 transition-transform md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white">SP</div>
          <div>
            <p className="font-black leading-tight">Scale Platform</p>
            <p className="text-xs text-slate-500">Member workspace</p>
          </div>
        </div>

        <nav className="mt-8 space-y-1">
          {links.map(([href, label]) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link key={href} href={href} onClick={() => setOpen(false)} className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition ${active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}>
                <span>{label}</span>
                {active ? <span>•</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{initials}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{user?.name || "User"}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>
          <button onClick={logout} disabled={loggingOut} className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60">
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </aside>
    </>
  );
}
