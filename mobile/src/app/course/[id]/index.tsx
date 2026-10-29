import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { colors } from "@/lib/config";
import { useApi } from "@/lib/hooks";
import { money } from "@/lib/format";
import { Avatar, Button, Card, Chip, ErrorBox, Loading, Muted, Notice, ProgressBar, SectionTitle, Text } from "@/components/ui";
import { CourseCover } from "../../(tabs)/courses";

export type Material = { id: string; name: string; type: string; description?: string; file_size?: string | number | null; is_preview: boolean; completed: boolean };
type Course = {
  id: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  has_cover_image: boolean;
  enrolled: boolean;
  enrollment_count: string | number;
  progress_done?: string | number;
  progress_total?: string | number;
  instructor_id?: string | null;
  instructor_name?: string | null;
  instructor_designation?: string | null;
  instructor_details?: string | null;
  instructor_has_image?: boolean;
  category_details?: { id: string; name: string }[];
  materials: Material[];
};

export const materialMeta: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  video: { label: "Video lecture", icon: "play-circle-outline" },
  document: { label: "Document", icon: "document-text-outline" },
  text: { label: "Reading", icon: "book-outline" },
  other: { label: "File", icon: "attach-outline" },
};
export const metaFor = (type: string) => materialMeta[type] || materialMeta.other;
export function formatBytes(value: unknown) {
  const bytes = Number(value);
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const size = bytes / 1024 ** index;
  return `${size >= 10 || index === 0 ? Math.round(size) : size.toFixed(1)} ${units[index]}`;
}

export default function CourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const resource = useApi<Course>(`frontend/courses/${id}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const course = resource.data;

  async function enroll() {
    setBusy(true);
    setError("");
    try {
      await api(`courses/${id}/enroll`, { method: "POST" });
      setMessage("You’re enrolled. Your next chapter starts now.");
      await resource.reload();
    } catch (problem: any) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  if (resource.loading) return <Loading />;
  if (!course) return <ErrorBox message={resource.error || "This course is not available."} onRetry={resource.reload} />;
  const materials = course.materials || [];
  const total = Number(course.progress_total || materials.length);
  const done = Number(course.progress_done || 0);
  const next = materials.find((item) => !item.completed) || materials[0];

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.green} />}>
      <Card style={{ padding: 0, overflow: "hidden", gap: 0 }}>
        <CourseCover course={course} height={170} />
        <View style={{ padding: 16, gap: 8 }}>
          <View style={styles.chips}>
            {course.category_details?.map((category) => (
              <Chip key={category.id} label={category.name} tone="gray" />
            ))}
          </View>
          <Text style={styles.title}>{course.title}</Text>
          <Muted>
            {Number(course.enrollment_count)} learner{Number(course.enrollment_count) === 1 ? "" : "s"} · {materials.length} material{materials.length === 1 ? "" : "s"}
          </Muted>
          <Text style={styles.price}>{money(course.price, course.currency)}</Text>
          {message ? <Notice tone="success">{message}</Notice> : null}
          {error ? <Notice>{error}</Notice> : null}
          {course.enrolled ? (
            <>
              <ProgressBar value={total ? (done / total) * 100 : 0} />
              <Muted>
                {done} of {total} materials complete
              </Muted>
              {next ? <Button label={done ? "Continue learning" : "Start learning"} icon="play" onPress={() => router.push(`/course/${course.id}/${next.id}`)} /> : null}
            </>
          ) : (
            <Button label="Enroll now" icon="school-outline" onPress={enroll} busy={busy} />
          )}
        </View>
      </Card>

      <Card>
        <Text style={styles.heading}>About this course</Text>
        <Text style={styles.body}>{course.description}</Text>
      </Card>

      <SectionTitle>Course content</SectionTitle>
      {materials.length === 0 ? <Muted>The instructor is still preparing this course.</Muted> : null}
      {materials.map((material, index) => {
        const open = course.enrolled || material.is_preview;
        const meta = metaFor(material.type);
        return (
          <Card key={material.id} onPress={open ? () => router.push(`/course/${course.id}/${material.id}`) : undefined} style={{ flexDirection: "row", alignItems: "center", gap: 12, opacity: open ? 1 : 0.7 }}>
            <View style={[styles.icon, material.completed && { backgroundColor: colors.green }]}>
              <Ionicons name={material.completed ? "checkmark" : open ? meta.icon : "lock-closed-outline"} size={20} color={material.completed ? "#fff" : colors.green} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.matTitle}>
                {index + 1}. {material.name}
              </Text>
              <Muted>
                {meta.label}
                {material.file_size ? ` · ${formatBytes(material.file_size)}` : ""}
                {material.is_preview && !course.enrolled ? " · Free preview" : ""}
              </Muted>
            </View>
            {open ? <Ionicons name="chevron-forward" size={18} color={colors.subtle} /> : <Chip label="Locked" tone="gray" />}
          </Card>
        );
      })}

      {course.instructor_id ? (
        <>
          <SectionTitle>Your instructor</SectionTitle>
          <Card onPress={() => router.push(`/instructor/${course.instructor_id}`)} style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
            <Avatar id={course.instructor_id} name={course.instructor_name} hasPicture={course.instructor_has_image} size={64} instructor />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.matTitle}>{course.instructor_name}</Text>
              {course.instructor_designation ? <Text style={{ color: colors.green, fontWeight: "600" }}>{course.instructor_designation}</Text> : null}
              {course.instructor_details ? <Muted numberOfLines={3}>{course.instructor_details}</Muted> : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 14, gap: 12, paddingBottom: 36 },
  chips: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
  price: { color: colors.orange, fontWeight: "800", fontSize: 18 },
  heading: { fontSize: 16, fontWeight: "800", color: colors.text },
  body: { color: colors.text, lineHeight: 22 },
  icon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  matTitle: { fontWeight: "800", color: colors.text, fontSize: 15 },
});
