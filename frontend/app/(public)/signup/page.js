import SignupForm from "../../../components/SignupForm";

export const metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <main className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-lg">
        <SignupForm />
      </div>
    </main>
  );
}
