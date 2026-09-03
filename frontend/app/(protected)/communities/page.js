import ResourceList from "../../../components/ResourceList";

export const metadata = { title: "Communities" };

export default function CommunitiesPage() {
  return <ResourceList resource="communities" title="Communities" subtitle="Public communities available through your community service." />;
}
