import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { colors, gradients, radius, shadow } from "@/lib/config";
import { useApi } from "@/lib/hooks";
import { count, dateOnly, greeting, label } from "@/lib/format";
import { Avatar, Button, Card, Chip, ErrorBox, Hero, Loading, Muted, SectionTitle, Text, type IconName } from "./ui";

type Dashboard = {
  stats: { open_jobs: number; jobs: number; applicants: number; new_applicants: number; shortlisted: number; accepted: number; rejected: number };
  activity: { count: number; day?: string }[];
  recent: { job_id: string; applicant_id: string; uddeepto_id: string; name: string; has_picture: boolean; job_title: string; applied_at: string; status: string }[];
  top_jobs: { id: string; title: string; status: string; application_count: number; new_count: number }[];
  closing: { id: string; title: string; application_deadline: string }[];
};

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function HirerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const dash = useApi<Dashboard>("frontend/dashboard/hirer");
  const data = dash.data;
  const first = user?.name?.split(" ")[0] || "there";

  const tiles: { label: string; value: number; icon: IconName; color: string }[] = data
    ? [
        { label: "Open positions", value: data.stats.open_jobs, icon: "briefcase-outline", color: colors.green },
        { label: "Total job posts", value: data.stats.jobs, icon: "clipboard-outline", color: "#2f6fb0" },
        { label: "Total applicants", value: data.stats.applicants, icon: "people-outline", color: "#7a52b3" },
        { label: "Awaiting review", value: data.stats.new_applicants, icon: "mail-unread-outline", color: colors.orange },
        { label: "Shortlisted", value: data.stats.shortlisted, icon: "star-outline", color: "#c9a227" },
        { label: "Accepted", value: data.stats.accepted, icon: "checkmark-done-outline", color: "#1f8f8f" },
      ]
    : [];
  const peak = data ? Math.max(1, ...data.activity.map((day) => day.count)) : 1;
  const week = data ? data.activity.slice(-7).reduce((sum, day) => sum + day.count, 0) : 0;

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={dash.refreshing} onRefresh={dash.refresh} tintColor={colors.green} />}>
      <Hero>
        <Text style={styles.hello}>
          {greeting()}, {first}!
        </Text>
        <Text style={styles.heroText}>{data ? `${week} new applicant${week === 1 ? "" : "s"} in the last 7 days.` : "Find the right people for your team."}</Text>
        <Button label="Post a job" icon="add" kind="secondary" onPress={() => router.push("/job-post")} style={{ marginTop: 8, alignSelf: "flex-start" }} />
      </Hero>

      <Pressable onPress={() => router.push("/ai")} accessibilityRole="button" accessibilityLabel="Ask AI">
        <LinearGradient colors={gradients.ai} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ai}>
          <Ionicons name="sparkles" size={22} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.aiTitle}>Ask AI</Text>
            <Text style={styles.aiText}>Draft a job description or plan your hiring.</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </LinearGradient>
      </Pressable>

      {dash.loading ? <Loading /> : dash.error && !data ? <ErrorBox message={dash.error} onRetry={dash.reload} /> : null}

      {data ? (
        <>
          <View style={styles.grid}>
            {tiles.map((tile) => (
              <View key={tile.label} style={styles.tile}>
                <View style={[styles.tileIcon, { backgroundColor: `${tile.color}1f` }]}>
                  <Ionicons name={tile.icon} size={20} color={tile.color} />
                </View>
                <Text style={styles.tileValue}>{count(tile.value)}</Text>
                <Text style={styles.tileLabel}>{tile.label}</Text>
              </View>
            ))}
          </View>

          <Card>
            <Text style={styles.heading}>Applications · last 14 days</Text>
            <View style={styles.chart}>
              {data.activity.map((day, index) => (
                <View key={index} style={styles.barWrap}>
                  <View style={[styles.bar, { height: 6 + (day.count / peak) * 54 }]} />
                  <Text style={styles.barLabel}>{DAYS[new Date(`${day.day}T12:00:00`).getDay()]}</Text>
                </View>
              ))}
            </View>
          </Card>

          <SectionTitle action="All applicants" onAction={() => router.push("/hiring")}>
            Recent applicants
          </SectionTitle>
          {data.recent.length === 0 ? <Muted>No applications yet.</Muted> : null}
          {data.recent.map((person) => (
            <Card key={`${person.job_id}-${person.applicant_id}`} onPress={() => router.push(`/user/${person.uddeepto_id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Avatar id={person.applicant_id} name={person.name} hasPicture={person.has_picture} size={42} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{person.name}</Text>
                <Muted numberOfLines={1}>
                  {person.job_title} · {dateOnly(person.applied_at)}
                </Muted>
              </View>
              <Chip label={label(person.status)} tone={person.status === "accepted" ? "green" : person.status === "rejected" ? "red" : person.status === "shortlisted" ? "orange" : "gray"} />
            </Card>
          ))}

          {data.top_jobs.length ? (
            <>
              <SectionTitle action="My job posts" onAction={() => router.push("/hiring")}>
                Top job posts
              </SectionTitle>
              {data.top_jobs.map((job) => (
                <Card key={job.id} onPress={() => router.push(`/job/${job.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{job.title}</Text>
                    <Muted>
                      {job.application_count} applicant{job.application_count === 1 ? "" : "s"}
                      {job.new_count ? ` · ${job.new_count} new` : ""}
                    </Muted>
                  </View>
                  <Chip label={label(job.status)} tone={job.status === "open" ? "green" : "gray"} />
                </Card>
              ))}
            </>
          ) : null}

          {data.closing.length ? (
            <>
              <SectionTitle>Closing soon</SectionTitle>
              {data.closing.map((job) => (
                <Card key={job.id} onPress={() => router.push(`/job/${job.id}`)}>
                  <Text style={styles.name}>{job.title}</Text>
                  <Muted>Closes {dateOnly(job.application_deadline)}</Muted>
                </Card>
              ))}
            </>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 14, gap: 12, paddingBottom: 28 },
  hello: { color: "#fff", fontSize: 24, fontWeight: "800", letterSpacing: -0.6 },
  heroText: { color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 20 },
  ai: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: radius.lg, ...shadow },
  aiTitle: { color: "#fff", fontWeight: "800", fontSize: 17 },
  aiText: { color: "rgba(255,255,255,0.9)", fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { flexBasis: "47.5%", flexGrow: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, gap: 4, borderWidth: 1, borderColor: colors.border, ...shadow },
  tileIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  tileValue: { fontSize: 24, fontWeight: "800", color: colors.text },
  tileLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  heading: { fontSize: 15, fontWeight: "800", color: colors.text },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 84, paddingTop: 6 },
  barWrap: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 4 },
  bar: { width: "100%", borderRadius: 4, backgroundColor: colors.green },
  barLabel: { fontSize: 10, color: colors.subtle },
  name: { fontWeight: "800", color: colors.text, fontSize: 15 },
});
