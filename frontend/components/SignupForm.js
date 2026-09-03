"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || "").trim(),
      email: String(form.get("email") || "").trim(),
      username: String(form.get("username") || "").trim() || undefined,
      password: String(form.get("password") || ""),
    };

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          data?.error?.message || "Unable to create your account.";

        const fieldErrors =
          data?.error?.details?.fieldErrors || {};

        const reasons = Object.entries(fieldErrors).flatMap(
          ([field, messages]) =>
            Array.isArray(messages)
              ? messages.map((text) => `${field}: ${text}`)
              : []
        );

        setError(
          reasons.length
            ? `${message} — ${reasons.join(" | ")}`
            : message
        );

        console.error("Registration failed:", {
          status: response.status,
          error: data?.error,
        });

        return;
      }

      router.replace("/dashboard");
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
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">Get started</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm text-slate-500">Registration goes directly through your existing backend API.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold">Full name</span>
          <input name="name" type="text" autoComplete="name" minLength={2} maxLength={120} required className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-100" placeholder="Your name" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold">Email</span>
          <input name="email" type="email" autoComplete="email" required className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-100" placeholder="you@example.com" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold">Username <span className="font-normal text-slate-400">(optional)</span></span>
          <input name="username" type="text" autoComplete="username" minLength={3} maxLength={60} pattern="[a-zA-Z0-9_.-]+" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-100" placeholder="username" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold">Password</span>
          <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-100" placeholder="Minimum 8 characters" />
        </label>

        {error ? <div className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div> : null}

        <button disabled={loading} className="sm:col-span-2 w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account? <Link href="/login" className="font-bold text-slate-950 hover:underline">Login</Link>
      </p>
    </div>
  );
}
