import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { colors, gradients } from "@/lib/config";
import { useApi } from "@/lib/hooks";
import { dateOnly, label, salary } from "@/lib/format";
import { LinearGradient } from "expo-linear-gradient";
import { Avatar, Button, Card, Chip, ErrorBox, Loading, Muted, Notice, RemoteImage, SectionTitle, Text } from "./ui";
import { PostCard, type Post } from "./post-card";

type ProfileJob = {
  id: string;
  title: string;
  type: string;
  salary_min: string | null;
  salary_max: string | null;
  currency: string;
  salary_period: string | null;
  location: string | null;
  is_remote: boolean;
  application_deadline: string | null;
};

type Profile = {
  id: string;
  uddeepto_id: string;
  name: string;
  username: string;
  headline: string | null;
  bio: string | null;
  role: string;
  created_at: string;
  has_picture: boolean;
  has_cover_image: boolean;
  is_self: boolean;
  interests: { id: string; name: string }[];
  education: { id: string; institution: string; degree?: string; field_of_study?: string; start_date: string; end_date: string | null; grade?: string }[];
  experience: { id: string; title: string; workplace: string; location?: string; category_name?: string; start_date: string; end_date: string | null; description?: string }[];
  posts: { id: string; content: string }[];
  job_posts?: ProfileJob[];
  contests?: { id: string; name: string; status: string; starting_time: string; rank: number | null; points: string; participant_count: number }[];
  points?: { total: number; courses: number; contests: number };
  personal?: { email?: string; phone?: string; current_address?: string };
};

const range = (start: string, end: string | null) => `${dateOnly(start)} - ${end ? dateOnly(end) : "Present"}`;

export function ProfileView({ reference, children }: { reference: string; children?: React.ReactNode }) {
  const router = useRouter();
  const resource = useApi<Profile>(`frontend/profile/${reference}`);
  const profile = resource.data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function copyId() {
    if (!profile) return;
    await Clipboard.setStringAsync(profile.uddeepto_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function message() {
    if (!profile) return;
    setBusy(true);
    setError("");
    try {
      const conversation = await api<{ id: string }>("frontend/messages", { method: "POST", body: { user_id: profile.id } });
      router.push(`/chat/${conversation.id}`);
    } catch (problem: any) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  if (resource.loading) return <Loading />;
  if (!profile) return <ErrorBox message={resource.error || "This profile is not available."} onRetry={resource.reload} />;

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.green} />}>
      <View style={styles.hero}>
        {profile.has_cover_image ? <RemoteImage path={`frontend/profile/${profile.id}/cover`} style={styles.cover} fallback={<LinearGradient colors={gradients.hero} style={styles.cover} />} /> : <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cover} />}
        <View style={styles.avatarWrap}>
          <Avatar id={profile.id} name={profile.name} hasPicture={profile.has_picture} size={84} />
        </View>
        <View style={styles.identity}>
          <Text style={styles.name}>{profile.name}</Text>
          {profile.headline ? <Text style={styles.headline}>{profile.headline}</Text> : null}
          <View style={styles.roleRow}>
            <View style={styles.role}>
              <Text style={styles.roleText}>{label(profile.role)}</Text>
            </View>
            <Muted>
              @{profile.username} · Joined {dateOnly(profile.created_at)}
            </Muted>
          </View>
        </View>
      </View>

      <LinearGradient colors={[colors.greenSoft, colors.card]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.idCard}>
        <Text style={styles.idLabel}>UDDEEPTO ID</Text>
        <Text style={styles.idValue} selectable>
          {profile.uddeepto_id}
        </Text>
        <Pressable onPress={copyId} style={styles.copy} accessibilityRole="button" accessibilityLabel="Copy Uddeepto ID">
          <Ionicons name={copied ? "checkmark" : "copy-outline"} size={15} color={colors.green} />
          <Text style={{ color: colors.green, fontWeight: "700", fontSize: 13 }}>{copied ? "Copied" : "Copy ID"}</Text>
        </Pressable>
      </LinearGradient>

      {profile.role === "learner" && profile.points ? (
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pointsCard}>
          <View style={styles.pointsIcon}>
            <Ionicons name="trophy" size={22} color="#fff" />
          </View>
          <Text style={styles.pointsLabel}>POINTS</Text>
          <Text style={[styles.pointsValue, profile.points.total < 0 && { color: "#ffd0c7" }]}>{profile.points.total}</Text>
          <Text style={styles.pointsNote}>Point is calculated from contest and course performance.</Text>
        </LinearGradient>
      ) : null}

      {!profile.is_self && profile.role !== "admin" && <Button label="Send message" icon="chatbubble-ellipses-outline" onPress={message} busy={busy} />}
      {error ? <Notice>{error}</Notice> : null}
      {children}

      {profile.bio ? (
        <Card>
          <Text style={styles.heading}>About</Text>
          <Text style={styles.text}>{profile.bio}</Text>
        </Card>
      ) : null}

      {profile.interests.length > 0 && (
        <Card>
          <Text style={styles.heading}>Interests</Text>
          <View style={styles.chips}>
            {profile.interests.map((interest) => (
              <Chip key={interest.id} label={interest.name} />
            ))}
          </View>
        </Card>
      )}

      {profile.experience.length > 0 && (
        <Card>
          <Text style={styles.heading}>Experience</Text>
          {profile.experience.map((item, index) => (
            <TimelineItem key={item.id} last={index === profile.experience.length - 1} current={!item.end_date}>
              <Text style={styles.entryTitle}>{item.title}</Text>
              <Text style={styles.entrySub}>{[item.workplace, item.location].filter(Boolean).join(" · ")}</Text>
              <Muted>{range(item.start_date, item.end_date)}</Muted>
              {item.description ? <Text style={styles.text}>{item.description}</Text> : null}
            </TimelineItem>
          ))}
        </Card>
      )}

      {profile.education.length > 0 && (
        <Card>
          <Text style={styles.heading}>Education</Text>
          {profile.education.map((item, index) => (
            <TimelineItem key={item.id} last={index === profile.education.length - 1} current={!item.end_date}>
              <Text style={styles.entryTitle}>{item.institution}</Text>
              <Text style={styles.entrySub}>{[item.degree, item.field_of_study].filter(Boolean).join(" · ")}</Text>
              <Muted>
                {range(item.start_date, item.end_date)}
                {item.grade ? ` · ${item.grade}` : ""}
              </Muted>
            </TimelineItem>
          ))}
        </Card>
      )}

      {profile.role === "learner" && profile.contests && profile.contests.length > 0 && (
        <Card>
          <Text style={styles.heading}>Contests</Text>
          {profile.contests.map((contest) => (
            <View key={contest.id} style={styles.contest}>
              <View style={[styles.rank, !!contest.rank && contest.rank <= 3 && { backgroundColor: ["#d9a420", "#8c98a4", "#b9733d"][contest.rank - 1] }]}>
                {contest.rank ? (
                  <>
                    <Text style={[styles.rankLabel, contest.rank <= 3 && { color: "#fff" }]}>POSITION</Text>
                    <Text style={[styles.rankValue, contest.rank <= 3 && { color: "#fff" }]}>#{contest.rank}</Text>
                  </>
                ) : (
                  <Ionicons name="trophy-outline" size={20} color={colors.green} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryTitle} onPress={() => router.push(`/contest/${contest.id}`)}>
                  {contest.name}
                </Text>
                <Muted>{contest.rank ? `Rank ${contest.rank} of ${contest.participant_count} · ${Number(contest.points)} pts` : label(contest.status === "completed" ? "completed" : "in progress")}</Muted>
              </View>
            </View>
          ))}
        </Card>
      )}

      {profile.role === "hirer" && (
        <Card>
          <View style={styles.jobsHeading}>
            <Ionicons name="briefcase-outline" size={20} color={colors.green} />
            <Text style={styles.heading}>Active job posts</Text>
          </View>
          {profile.job_posts?.length ? (
            profile.job_posts.map((job) => (
              <Pressable
                key={job.id}
                onPress={() => router.push({ pathname: "/job/[id]", params: { id: job.id } })}
                accessibilityRole="button"
                accessibilityLabel={`View job: ${job.title}`}
                style={({ pressed }) => [styles.job, pressed && styles.jobPressed]}
              >
                <View style={styles.jobTitleRow}>
                  <Text style={[styles.entryTitle, { flex: 1 }]} numberOfLines={2}>{job.title}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.green} />
                </View>
                <Muted>{job.is_remote ? "Remote" : job.location || "Location not specified"} · {label(job.type)}</Muted>
                <Text style={styles.jobSalary}>{salary(job)}</Text>
                {job.application_deadline ? <Muted>Apply by {dateOnly(job.application_deadline)}</Muted> : null}
              </Pressable>
            ))
          ) : (
            <Muted>{profile.is_self ? "Your open job posts will be listed here." : "No active job posts."}</Muted>
          )}
        </Card>
      )}

      {profile.posts.length > 0 && (
        <>
          <SectionTitle>Recent showcase</SectionTitle>
          {profile.posts.slice(0, 5).map((post) => (
            <PostPreview key={post.id} id={post.id} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

/** One entry on a vertical timeline: a dot with a line running down to the next entry. */
function TimelineItem({ children, last, current }: { children: React.ReactNode; last: boolean; current: boolean }) {
  return (
    <View style={styles.timeRow}>
      <View style={styles.rail}>
        <View style={[styles.dot, current && styles.dotCurrent]} />
        {last ? null : <View style={styles.line} />}
      </View>
      <View style={[styles.entry, { flex: 1, paddingBottom: last ? 0 : 16 }]}>{children}</View>
    </View>
  );
}

/** The profile only carries a post's text; the full card (author, pictures, appreciation) comes from the post itself. */
function PostPreview({ id }: { id: string }) {
  const post = useApi<Post>(`frontend/showcase/${id}`);
  if (!post.data) return null;
  return <PostCard post={post.data} />;
}

const styles = StyleSheet.create({
  page: { padding: 14, gap: 12, paddingBottom: 36 },
  hero: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  cover: { height: 110, width: "100%" },
  avatarWrap: { marginTop: -42, marginLeft: 16, width: 92, height: 92, borderRadius: 46, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  identity: { padding: 16, paddingTop: 8, gap: 3 },
  name: { fontSize: 21, fontWeight: "800", color: colors.text },
  headline: { fontSize: 15, color: colors.text },
  roleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 },
  role: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.greenSoft },
  roleText: { color: colors.green, fontWeight: "700", fontSize: 12 },
  idCard: { borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 8 },
  idLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  idValue: { color: colors.green, fontSize: 28, fontWeight: "800", letterSpacing: 2 },
  copy: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff" },
  pointsCard: { borderRadius: 18, padding: 18, gap: 4, overflow: "hidden" },
  pointsIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  pointsLabel: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  pointsValue: { color: "#fff", fontSize: 42, fontWeight: "800", letterSpacing: -1 },
  pointsNote: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  heading: { fontSize: 16, fontWeight: "800", color: colors.text },
  jobsHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  job: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, gap: 6 },
  jobPressed: { backgroundColor: colors.greenSoft },
  jobTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  jobSalary: { color: colors.orange, fontWeight: "700", fontSize: 14 },
  text: { color: colors.text, fontSize: 14, lineHeight: 21 },
  chips: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  entry: { gap: 2, paddingTop: 6 },
  timeRow: { flexDirection: "row", gap: 12 },
  rail: { width: 16, alignItems: "center", paddingTop: 11 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.card, borderWidth: 3, borderColor: colors.green },
  dotCurrent: { backgroundColor: colors.orange, borderColor: colors.orange },
  line: { flex: 1, width: 2, marginTop: 2, backgroundColor: colors.border },
  entryTitle: { fontWeight: "800", color: colors.text, fontSize: 15 },
  entrySub: { color: colors.green, fontWeight: "600" },
  contest: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 6 },
  rank: { minWidth: 62, height: 54, borderRadius: 12, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  rankLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5, color: colors.green },
  rankValue: { fontSize: 18, fontWeight: "800", color: colors.green },
});
