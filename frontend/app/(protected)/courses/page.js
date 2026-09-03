import ResourceList from "../../../components/ResourceList";

export const metadata = { title: "Courses" };

export default function CoursesPage() {
  return <ResourceList resource="courses" title="Courses" subtitle="Published courses from your course microservice." />;
}
