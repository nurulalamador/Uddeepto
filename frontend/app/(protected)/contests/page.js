import ResourceList from "../../../components/ResourceList";

export const metadata = { title: "Contests" };

export default function ContestsPage() {
  return <ResourceList resource="contests" title="Contests" subtitle="Upcoming, open, and completed contests." />;
}
