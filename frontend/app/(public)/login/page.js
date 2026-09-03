import { Suspense } from "react";
import LoginForm from "../../../components/LoginForm";

export const metadata = { title: "Login" };

export default function LoginPage() {
  return (
    <main className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md">
        <Suspense fallback={<div className="h-[430px] animate-pulse rounded-3xl border border-slate-200 bg-white" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
