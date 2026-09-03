"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      email: String(form.get("email") || "").trim(),
      password: String(form.get("password") || ""),
    };

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.error?.message || "Unable to login. Please check your credentials.");
        return;
      }

      const from = searchParams.get("from");
      const destination = from && from.startsWith("/") ? from : "/dashboard";
      router.replace(destination);
      router.refresh();
    } catch {
      setError("Could not connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-8">
      <div className="mb-7">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">Welcome back</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Login to your account</h1>
        <p className="mt-2 text-sm text-slate-500">Use the same account handled by your Express auth service.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Email</span>
          <input name="email" type="email" autoComplete="email" required className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-100" placeholder="you@example.com" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Password</span>
          <input name="password" type="password" autoComplete="current-password" required className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-100" placeholder="Your password" />
        </label>

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div> : null}

        <button disabled={loading} className="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Don&apos;t have an account? <Link href="/signup" className="font-bold text-slate-950 hover:underline">Create one</Link>
      </p>
    </div>
  );
}
