import "./globals.css";
import { ThemeProvider } from "@/components/theme";
export const metadata = {
  title: {
    default: "Uddeepto - Learn. Create. Grow.",
    template: "%s · Uddeepto",
  },
  description:
    "Build skills, share your work and discover your next opportunity.",
};
export default function Layout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
