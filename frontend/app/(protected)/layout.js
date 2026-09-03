import ProtectedShell from "../../components/ProtectedShell";

export default function ProtectedLayout({ children }) {
  return <ProtectedShell>{children}</ProtectedShell>;
}
