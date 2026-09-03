export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-20 lg:px-8">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 sm:p-12">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">About us</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">A platform designed around growth.</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
          This starter frontend connects directly to your Express microservices gateway. Public visitors can access the landing, about, login, and signup pages. Authenticated users receive a dedicated dashboard experience with a left sidebar.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {["Simple authentication flow", "Protected application routes", "Tailwind-first responsive UI"].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 bg-white p-5 font-semibold shadow-sm">
              {item}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
