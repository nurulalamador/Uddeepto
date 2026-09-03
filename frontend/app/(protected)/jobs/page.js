import ResourceList from "../../../components/ResourceList";

export const metadata = { title: "Jobs" };

export default function JobsPage() {
  return <ResourceList resource="jobs" title="Jobs" subtitle="Published job opportunities from your job service." />;
}
