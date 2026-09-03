import "./globals.css";

export const metadata = {
  title: {
    default: "Scale Platform",
    template: "%s | Scale Platform",
  },
  description: "Courses, contests, jobs, and communities in one place.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
