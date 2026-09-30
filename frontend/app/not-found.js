import Link from "next/link";
export default function NotFound() {
  return (
    <main className="recovery">
      <h1>Page not found.</h1>
      <p>Let’s get you back to familiar ground.</p>
      <Link className="button" href="/">
        Go home
      </Link>
    </main>
  );
}
