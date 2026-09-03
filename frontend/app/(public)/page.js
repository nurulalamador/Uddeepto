import Link from "next/link";
import { hasSessionCookie } from "../../lib/server-auth";

const features = [
  { title: "Courses", text: "Learn from structured courses and practical resources." },
  { title: "Contests", text: "Discover upcoming competitions and new challenges." },
  { title: "Communities", text: "Connect with people who share your interests." },
  { title: "Jobs", text: "Explore opportunities that match your skills and goals." },
];

export default async function LandingPage() {
  const isLoggedIn = await hasSessionCookie();

  return (
    <main>
      <section className="relative overflow-hidden border-b border-slate-200 bg-slate-950 text-white">
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_top_right,_#2563eb_0,_transparent_35%),radial-gradient(circle_at_bottom_left,_#0ea5e9_0,_transparent_30%)]" />
        <div className="relative mx-auto grid min-h-[620px] max-w-7xl items-center gap-12 px-6 py-24 lg:grid-cols-[1.1fr_.9fr] lg:px-8">
          <div>
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-slate-200">
              Learn. Compete. Connect. Grow.
            </span>
            <h1 className="mt-6 max-w-3xl text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
              Build your next opportunity from one platform.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Access courses, contests, communities, and jobs through a simple account built on your existing microservices backend.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                href={isLoggedIn ? "/dashboard" : "/signup"}
                className="rounded-xl bg-white px-6 py-3 font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                {isLoggedIn ? "Go to dashboard" : "Create account"}
              </Link>
              <Link href="/about" className="rounded-xl border border-white/25 px-6 py-3 font-semibold text-white transition hover:bg-white/10">
                Learn more
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur">
            <div className="rounded-2xl bg-white p-6 text-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Your workspace</p>
                  <h2 className="mt-1 text-2xl font-bold">Everything in one place</h2>
                </div>
                <div className="rounded-2xl bg-slate-950 px-3 py-2 text-sm font-bold text-white">SP</div>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-3">
                {features.map((feature) => (
                  <div key={feature.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4 h-2 w-12 rounded-full bg-slate-900" />
                    <p className="font-semibold">{feature.title}</p>
                    <p className="mt-1 text-sm text-slate-500">Ready after login</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">Platform</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">A clean starting point for your product.</h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 font-bold text-white">
                {feature.title.charAt(0)}
              </div>
              <h3 className="text-lg font-bold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
