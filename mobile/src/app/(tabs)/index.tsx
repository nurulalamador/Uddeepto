import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { colors, gradients, radius, shadow } from "@/lib/config";
import { useApi } from "@/lib/hooks";
import { count, dateTime, greeting, label } from "@/lib/format";
import { Card, Chip, ErrorBox, Hero, Loading, Muted, ProgressBar, SectionTitle, Text, type IconName } from "@/components/ui";
import HirerDashboard from "@/components/hirer-dashboard";
import { JobCard, type JobRow } from "./jobs";
import { CourseCover } from "./courses";
import { LeaderboardPreview } from "@/components/leaderboard";

type Dashboard = {
  stats: Record<string, number | string>;
  continue_learning: { id: string; title: string; instructor_name?: string; has_cover_image?: boolean; progress_done?: number | string; progress_total?: number | string; status?: string }[];
  schedule: { kind: string; id: string; name: string; starting_time: string; ending_time: string }[];
  discover: { kind: string; id: string; name: string; starting_time: string; ending_time: string }[];
  applications: { job_id?: string; id?: string; title?: string; job_title?: string; status?: string }[];
  streak?: number;
  profile?: { percent: number; checklist: { key: string; label: string; done: boolean }[] };
};

const tiles: { key: string; label: string; icon: IconName; color: string }[] = [
  { key: "enrolled", label: "Courses enrolled", icon: "book-outline", color: colors.green },
  { key: "completed_courses", label: "Courses completed", icon: "school-outline", color: "#2f6fb0" },
  { key: "contests_joined", label: "Contests joined", icon: "trophy-outline", color: colors.orange },
  { key: "podiums", label: "Podium finishes", icon: "ribbon-outline", color: "#c9a227" },
  { key: "webinars", label: "Webinars booked", icon: "videocam-outline", color: "#1f8f8f" },
  { key: "communities", label: "Communities", icon: "people-outline", color: "#7a52b3" },
];

export default function DashboardTab() {
  const { user } = useAuth();
  if (user?.role === "hirer") return <HirerDashboard />;
  return <LearnerDashboard />;
}

function LearnerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const dash = useApi<Dashboard>("frontend/dashboard/learner");
  const first = user?.name?.split(" ")[0] || "there";
  const data = dash.data;

  const openEvent = (kind: string, id: string) => router.push(kind === "contest" ? `/contest/${id}` : `/webinar/${id}`);

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={dash.refreshing} onRefresh={dash.refresh} tintColor={colors.green} />}>
      <Hero>
        <Text style={styles.hello}>
          {greeting()}, {first}!
        </Text>
        <Text style={styles.heroText}>{data && count(data.streak) > 0 ? `${count(data.streak)}-day learning streak. Keep it going!` : "Pick up where you left off, or find something new today."}</Text>
      </Hero>

      <Pressable onPress={() => router.push("/ai")} accessibilityRole="button" accessibilityLabel="Ask AI">
        <LinearGradient colors={gradients.ai} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ai}>
          <View style={styles.aiIcon}>
            <Ionicons name="sparkles" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiTitle}>Ask AI</Text>
            <Text style={styles.aiText}>Get help with courses, careers and your next step.</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </LinearGradient>
      </Pressable>

      <View style={styles.quick}>
        <Quick icon="document-text-outline" text="CV generator" onPress={() => router.push("/cv")} />
        <Quick icon="book-outline" text="Courses" onPress={() => router.push("/courses")} />
        <Quick icon="pricetags-outline" text="Interests" onPress={() => router.push("/interests")} />
      </View>

      {dash.loading ? <Loading /> : dash.error && !data ? <ErrorBox message={dash.error} onRetry={dash.reload} /> : null}

      {data && (
        <>
          <View style={styles.grid}>
            {tiles.map((tile) => (
              <View key={tile.key} style={styles.tile}>
                <View style={[styles.tileIcon, { backgroundColor: `${tile.color}1f` }]}>
                  <Ionicons name={tile.icon} size={20} color={tile.color} />
                </View>
                <Text style={styles.tileValue}>{count(data.stats?.[tile.key])}</Text>
                <Text style={styles.tileLabel}>{tile.label}</Text>
              </View>
            ))}
          </View>

          <LeaderboardPreview />

          {data.continue_learning?.length > 0 && (
            <>
              <SectionTitle action="All courses" onAction={() => router.push("/courses")}>
                Continue learning
              </SectionTitle>
              {data.continue_learning.map((course) => {
                const total = count(course.progress_total);
                const done = count(course.progress_done);
                return (
                  <Card key={course.id} onPress={() => router.push(`/course/${course.id}`)} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                    <View style={{ width: 72, height: 72, borderRadius: radius.md, overflow: "hidden" }}>
                      <CourseCover course={{ id: course.id, has_cover_image: course.has_cover_image ?? true }} height={72} />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.cardTitle} numberOfLines={2}>{course.title}</Text>
                      {course.instructor_name ? <Muted>{course.instructor_name}</Muted> : null}
                      <ProgressBar value={total ? (done / total) * 100 : 0} />
                      <Muted>
                        {done} of {total} lessons
                      </Muted>
                    </View>
                  </Card>
                );
              })}
            </>
          )}

          {data.schedule?.length > 0 && (
            <>
              <SectionTitle>Your schedule</SectionTitle>
              {data.schedule.map((item) => (
                <Card key={`${item.kind}-${item.id}`} onPress={() => openEvent(item.kind, item.id)}>
                  <Chip label={label(item.kind)} tone={item.kind === "contest" ? "orange" : "green"} icon={item.kind === "contest" ? "trophy-outline" : "videocam-outline"} />
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Muted>{dateTime(item.starting_time)}</Muted>
                </Card>
              ))}
            </>
          )}

          {data.discover?.length > 0 && (
            <>
              <SectionTitle action="See all" onAction={() => router.push("/events")}>
                Discover
              </SectionTitle>
              {data.discover.slice(0, 4).map((item) => (
                <Card key={`${item.kind}-${item.id}`} onPress={() => openEvent(item.kind, item.id)}>
                  <Chip label={label(item.kind)} tone={item.kind === "contest" ? "orange" : "green"} icon={item.kind === "contest" ? "trophy-outline" : "videocam-outline"} />
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Muted>
                    {dateTime(item.starting_time)} - {dateTime(item.ending_time)}
                  </Muted>
                </Card>
              ))}
            </>
          )}

          {data.applications?.length > 0 && <Applications />}

          {data.profile && data.profile.percent < 100 && (
            <Card onPress={() => router.push("/profile")}>
              <Text style={styles.cardTitle}>Your profile is {data.profile.percent}% complete</Text>
              <ProgressBar value={data.profile.percent} />
              {data.profile.checklist
                .filter((step) => !step.done)
                .slice(0, 3)
                .map((step) => (
                  <Muted key={step.key}>• {step.label}</Muted>
                ))}
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
}

/** The jobs the learner applied to, as full job cards (salary, place, type and the application status). */
function Applications() {
  const router = useRouter();
  const applied = useApi<JobRow[]>("frontend/jobs?tab=applied&limit=4");
  if (!applied.data?.length) return null;
  return (
    <>
      <SectionTitle action="Jobs" onAction={() => router.push("/jobs")}>
        Your applications
      </SectionTitle>
      {applied.data.slice(0, 4).map((job) => (
        <JobCard key={job.id} job={job} onPress={() => router.push(`/job/${job.id}`)} />
      ))}
    </>
  );
}

function Quick({ icon, text, onPress }: { icon: IconName; text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.quickItem} accessibilityRole="button">
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={20} color={colors.green} />
      </View>
      <Text style={styles.quickText}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 14, gap: 12, paddingBottom: 28 },
  hello: { color: "#fff", fontSize: 24, fontWeight: "800", letterSpacing: -0.6 },
  heroText: { color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 20 },
  ai: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: radius.lg, ...shadow },
  aiIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  aiTitle: { color: "#fff", fontWeight: "800", fontSize: 17 },
  aiText: { color: "rgba(255,255,255,0.9)", fontSize: 13, lineHeight: 18 },
  quick: { flexDirection: "row", gap: 10 },
  quickItem: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 12, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  quickIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  quickText: { fontSize: 12, fontWeight: "700", color: colors.text },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { flexBasis: "47.5%", flexGrow: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, gap: 4, borderWidth: 1, borderColor: colors.border, ...shadow },
  tileIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  tileValue: { fontSize: 24, fontWeight: "800", color: colors.text },
  tileLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  cardTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
});
