import { useEffect, useState } from "react";
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { colors } from "@/lib/config";
import { useApi } from "@/lib/hooks";
import { downloadAndShare } from "@/lib/files";
import { Button, Card, Chip, ErrorBox, Loading, Muted, Notice, ProgressBar, SectionTitle, Text } from "@/components/ui";
import { MediaPlayer } from "@/components/media";
import { QuizVideo } from "@/components/quiz-video";
import { formatBytes, metaFor, type Material } from "./index";

type Course = { id: string; title: string; enrolled: boolean; progress_done?: string | number; progress_total?: string | number; materials: Material[] };
type Content = {
  id: string;
  type: string;
  name: string;
  description?: string | null;
  content_text?: string | null;
  external_url?: string | null;
  quiz: { completed: boolean; passed: number[] } | null;
  file: { url: string; name: string; size?: number | null; mime_type?: string | null } | null;
};

const apiPath = (url: string) => url.replace(/^\/?api\/backend\//, "").replace(/^\//, "");
const safe = (link?: string | null) => (link && /^https?:\/\//i.test(link) ? link : "");

export default function MaterialScreen() {
  const { id, materialId } = useLocalSearchParams<{ id: string; materialId: string }>();
  const router = useRouter();
  const course = useApi<Course>(`frontend/courses/${id}`);
  const [content, setContent] = useState<Content | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setContent(null);
    setError("");
    api<Content>(`frontend/courses/${id}/materials/${materialId}/content`)
      .then((data) => {
        if (!live) return;
        setContent(data);
        if (!data.file) course.reload();
      })
      .catch((problem) => live && setError(problem.message));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, materialId]);

  async function openFile() {
    if (!content?.file) return;
    setBusy(true);
    setError("");
    try {
      await downloadAndShare(apiPath(content.file.url), content.file.name || "material", content.file.mime_type || undefined);
      course.reload();
    } catch (problem: any) {
      setError(problem.message || "Could not open the file.");
    } finally {
      setBusy(false);
    }
  }

  const materials = course.data?.materials || [];
  const index = materials.findIndex((item) => item.id === materialId);
  const previous = materials[index - 1];
  const next = materials[index + 1];
  const canOpen = (item?: Material) => Boolean(item && (course.data?.enrolled || item.is_preview));
  const total = Number(course.data?.progress_total || materials.length);
  const done = Number(course.data?.progress_done || 0);
  const external = safe(content?.external_url);

  if (error && !content) return <ErrorBox message={error} onRetry={() => router.replace(`/course/${id}/${materialId}`)} />;
  if (!content || (course.loading && !course.data)) return <Loading text="Opening material…" />;
  const file = content.file;
  const meta = metaFor(content.type);

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={course.refreshing} onRefresh={course.refresh} tintColor={colors.green} />}>
      <View style={{ gap: 6 }}>
        <Chip label={meta.label} icon={meta.icon} />
        <Text style={styles.title}>{content.name}</Text>
      </View>

      {content.type === "video" && file ? (
        content.quiz && !content.quiz.completed ? (
          <QuizVideo courseId={String(id)} materialId={String(materialId)} path={apiPath(file.url)} passedAlready={content.quiz.passed || []} onViewed={course.reload} />
        ) : (
          <MediaPlayer path={apiPath(file.url)} name={content.name} />
        )
      ) : file ? (
        <Card style={{ alignItems: "center", gap: 8, padding: 20 }}>
          <Text style={{ fontWeight: "800", color: colors.text, textAlign: "center" }}>{file.name}</Text>
          {file.size ? <Muted>{formatBytes(file.size)}</Muted> : null}
          <Button label="Open file" icon="open-outline" onPress={openFile} busy={busy} />
        </Card>
      ) : (
        <>
          {content.content_text ? (
            <Card>
              <Text style={{ color: colors.text, lineHeight: 24, fontSize: 15 }} selectable>
                {content.content_text}
              </Text>
            </Card>
          ) : null}
          {external ? <Button label="Open resource" icon="link-outline" kind="secondary" onPress={() => Linking.openURL(external)} /> : null}
        </>
      )}
      {content.description ? <Muted>{content.description}</Muted> : null}
      {error ? <Notice>{error}</Notice> : null}

      <View style={{ flexDirection: "row", gap: 10 }}>
        {previous && canOpen(previous) ? <Button label="Previous" icon="arrow-back" kind="secondary" onPress={() => router.replace(`/course/${id}/${previous.id}`)} style={{ flex: 1 }} /> : <View style={{ flex: 1 }} />}
        {next && canOpen(next) ? <Button label="Next" icon="arrow-forward" onPress={() => router.replace(`/course/${id}/${next.id}`)} style={{ flex: 1 }} /> : <View style={{ flex: 1 }} />}
      </View>

      {course.data?.enrolled ? (
        <Card>
          <ProgressBar value={total ? (done / total) * 100 : 0} />
          <Muted>
            {done} of {total} materials complete
          </Muted>
        </Card>
      ) : (
        <Notice tone="success">You’re viewing a free preview. Enroll in the course to unlock every material.</Notice>
      )}

      <SectionTitle>All materials</SectionTitle>
      {materials.map((item, position) => (
        <Card key={item.id} onPress={canOpen(item) ? () => router.replace(`/course/${id}/${item.id}`) : undefined} style={[{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 }, item.id === materialId && { borderColor: colors.green }]}>
          <Chip label={item.completed ? "Done" : String(position + 1)} tone={item.completed ? "green" : "gray"} />
          <Text style={{ flex: 1, color: colors.text, fontWeight: item.id === materialId ? "800" : "600" }} numberOfLines={1}>
            {item.name}
          </Text>
          {!canOpen(item) ? <Chip label="Locked" tone="gray" /> : null}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 14, gap: 12, paddingBottom: 36 },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
});
