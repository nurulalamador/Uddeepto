import Link from "next/link";

export const metadata = { title: "Dashboard" };

const sections = [
  { href: "/courses", label: "Courses", description: "Browse learning resources and published courses." },
  { href: "/contests", label: "Contests", description: "See upcoming, open, and completed contests." },
  { href: "/communities", label: "Communities", description: "Discover communities and join conversations." },
  { href: "/jobs", label: "Jobs", description: "Explore currently published job opportunities." },
];

export default function DashboardPage() {
  return (
    <div>
      <div className="rounded-3xl bg-slate-950 p-8 text-white shadow-xl sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Dashboard</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Welcome to your workspace.</h1>
        <p className="mt-4 max-w-2xl text-slate-300">
          Use the sidebar to move between the protected sections of the platform. Your session is connected to the Express auth service.
        </p>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {sections.map((item) => (
          <Link key={item.href} href={item.href} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">{item.label}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              </div>
              <span className="text-xl transition group-hover:translate-x-1">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
