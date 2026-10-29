import { useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";
import { colors, shadow } from "@/lib/config";
import { useAuth } from "@/lib/auth";
import { useApi, useDebounced, usePaged } from "@/lib/hooks";
import { ago, count, dateOnly, label, salary } from "@/lib/format";
import { downloadAndShare } from "@/lib/files";
import { Avatar, Button, Card, Chip, Dropdown, Empty, ErrorBox, FilterBar, Loading, Muted, Notice, Text, TopTabs } from "@/components/ui";
import type { JobRow } from "./jobs";

type Post = JobRow & { application_count: number; created_at: string };
type Applicant = {
  job_id: string;
  job_title: string;
  applicant_id: string;
  name: string;
  username: string;
  uddeepto_id: string;
  has_picture: boolean;
  headline?: string | null;
  status: string;
  applied_at: string;
  cover_letter?: string | null;
  has_resume: boolean;
};
export const STATUSES = ["applied", "shortlisted", "accepted", "rejected"];
const tone = (status: string) => (status === "accepted" ? "green" : status === "rejected" ? "red" : status === "shortlisted" ? "orange" : "gray");

export default function HiringTab() {
  const router = useRouter();
  const [tab, setTab] = useState<"posts" | "applicants">("posts");
  const [job, setJob] = useState("");

  return (
    <View style={{ flex: 1 }}>
      <TopTabs
        tabs={[
          { value: "posts", label: "My job posts" },
          { value: "applicants", label: "Applicants" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "posts" ? (
        <Posts
          onApplicants={(id) => {
            setJob(id);
            setTab("applicants");
          }}
        />
      ) : (
        <Applicants job={job} setJob={setJob} />
      )}
      {tab === "posts" ? (
        <Pressable style={styles.fab} onPress={() => router.push("/job-post")} accessibilityRole="button" accessibilityLabel="Post a job">
          <LinearGradient colors={["#f08a45", "#e77b38"]} style={styles.fabFill}>
            <Ionicons name="add" size={30} color="#fff" />
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );
}

function Posts({ onApplicants }: { onApplicants: (id: string) => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const query = useDebounced(text.trim());
  const list = usePaged<Post>(`frontend/jobs?tab=mine&q=${encodeURIComponent(query)}`);
  const rows = status ? list.items.filter((item) => item.status === status) : list.items;
  const [error, setError] = useState("");

  async function toggle(post: Post) {
    setError("");
    try {
      await api(`frontend/jobs/${post.id}/status`, { method: "PATCH", body: { status: post.status === "open" ? "closed" : "open" } });
      list.reload();
    } catch (problem: any) {
      setError(problem.message);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <FilterBar value={text} onChangeText={setText} placeholder="Search your job posts…">
        <Dropdown compact icon="funnel-outline" value={status} placeholder="Any status" options={[{ value: "", label: "Any status" }, { value: "open", label: "Open" }, { value: "closed", label: "Closed" }, { value: "draft", label: "Draft" }]} onChange={setStatus} />
      </FilterBar>
      {error ? <View style={{ paddingHorizontal: 14, paddingTop: 8 }}><Notice>{error}</Notice></View> : null}
      {list.loading ? (
        <Loading />
      ) : list.error && !list.items.length ? (
        <ErrorBox message={list.error} onRetry={list.reload} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(post) => post.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.6}
          refreshing={list.refreshing}
          onRefresh={list.refresh}
          ListEmptyComponent={<Empty icon="briefcase-outline" title="Your next hire starts with a job post" text="Tap + to post your first job and start receiving applications." />}
          ListFooterComponent={list.loadingMore ? <Loading /> : undefined}
          renderItem={({ item }) => (
            <Card onPress={() => router.push(`/job/${item.id}`)}>
              <View style={styles.chips}>
                <Chip label={label(item.status)} tone={item.status === "open" ? "green" : "gray"} />
                <Chip label={label(item.type)} tone="gray" />
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Muted>
                {item.is_remote ? "Remote" : item.location || "Location not specified"} · {salary(item)}
              </Muted>
              <Muted>
                Posted {dateOnly(item.created_at)}
                {item.application_deadline ? ` · Apply by ${dateOnly(item.application_deadline)}` : ""}
              </Muted>
              <View style={styles.actions}>
                <Button label={`${count(item.application_count)} applicant${count(item.application_count) === 1 ? "" : "s"}`} icon="people-outline" kind="soft" onPress={() => onApplicants(item.id)} style={{ flex: 1 }} />
                {["open", "closed"].includes(item.status) ? <Button label={item.status === "open" ? "Close" : "Reopen"} icon={item.status === "open" ? "lock-closed-outline" : "lock-open-outline"} kind="secondary" onPress={() => toggle(item)} style={{ flex: 1 }} /> : null}
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

function Applicants({ job, setJob }: { job: string; setJob: (id: string) => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const query = useDebounced(text.trim());
  const posts = useApi<Post[]>("frontend/jobs?tab=mine&limit=100");
  const list = usePaged<Applicant>(`frontend/jobs/applicants?job=${job}&status=${status}&q=${encodeURIComponent(query)}`, 12);

  async function change(person: Applicant, next: string) {
    setError("");
    try {
      await api(`frontend/jobs/${person.job_id}/applications/${person.applicant_id}`, { method: "PATCH", body: { status: next } });
      list.setItems((rows) => rows.map((row) => (row.job_id === person.job_id && row.applicant_id === person.applicant_id ? { ...row, status: next } : row)));
    } catch (problem: any) {
      setError(problem.message);
    }
  }
  async function message(person: Applicant) {
    try {
      const conversation = await api<{ id: string }>("frontend/messages", { method: "POST", body: { user_id: person.applicant_id } });
      router.push(`/chat/${conversation.id}`);
    } catch (problem: any) {
      setError(problem.message);
    }
  }
  async function resume(person: Applicant) {
    try {
      await downloadAndShare(`frontend/jobs/${person.job_id}/applications/${person.applicant_id}/resume`, `${person.username}-resume.pdf`, "application/pdf");
    } catch (problem: any) {
      setError(problem.message || "Could not open the resume.");
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <FilterBar value={text} onChangeText={setText} placeholder="Search applicants by name…">
        <Dropdown compact icon="briefcase-outline" value={job} placeholder="All job posts" options={[{ value: "", label: "All job posts" }, ...(posts.data || []).map((post) => ({ value: post.id, label: `${post.title} (${count(post.application_count)})` }))]} onChange={setJob} />
        <Dropdown compact icon="funnel-outline" value={status} placeholder="All statuses" options={[{ value: "", label: "All statuses" }, ...STATUSES.map((value) => ({ value, label: label(value) }))]} onChange={setStatus} />
      </FilterBar>
      {error ? <View style={{ paddingHorizontal: 14, paddingTop: 8 }}><Notice>{error}</Notice></View> : null}
      {list.loading ? (
        <Loading />
      ) : list.error && !list.items.length ? (
        <ErrorBox message={list.error} onRetry={list.reload} />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(person) => `${person.job_id}-${person.applicant_id}`}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.6}
          refreshing={list.refreshing}
          onRefresh={list.refresh}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Empty icon="people-outline" title="No applicants yet" text="People who apply to your job posts will appear here." />}
          ListFooterComponent={list.loadingMore ? <Loading /> : undefined}
          renderItem={({ item }) => {
            const key = `${item.job_id}-${item.applicant_id}`;
            const expanded = open === key;
            return (
              <Card>
                <Pressable style={styles.head} onPress={() => router.push(`/user/${item.uddeepto_id}`)}>
                  <Avatar id={item.applicant_id} name={item.name} hasPicture={item.has_picture} size={48} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{item.name}</Text>
                    <Muted numberOfLines={1}>
                      @{item.username}
                      {item.headline ? ` · ${item.headline}` : ""}
                    </Muted>
                  </View>
                  <Chip label={label(item.status)} tone={tone(item.status)} />
                </Pressable>
                <Muted>
                  Applied for {item.job_title} · {ago(item.applied_at)}
                </Muted>
                {expanded ? (
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontWeight: "800", color: colors.text }}>Cover letter</Text>
                    <Text style={{ color: colors.text, lineHeight: 21 }}>{item.cover_letter || "No cover letter."}</Text>
                    {item.has_resume ? <Button label="Open resume" icon="document-text-outline" kind="soft" onPress={() => resume(item)} /> : null}
                  </View>
                ) : null}
                <Pressable onPress={() => setOpen(expanded ? null : key)} hitSlop={6}>
                  <Text style={styles.link}>{expanded ? "Hide details" : "Cover letter & resume"}</Text>
                </Pressable>
                <Dropdown label="Status" value={item.status} options={STATUSES.map((value) => ({ value, label: label(value) }))} onChange={(next) => change(item, next)} />
                <View style={styles.actions}>
                  <Button label="Profile" icon="person-outline" kind="secondary" onPress={() => router.push(`/user/${item.uddeepto_id}`)} style={{ flex: 1 }} />
                  <Button label="Message" icon="chatbubble-ellipses-outline" onPress={() => message(item)} style={{ flex: 1 }} />
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 14, paddingBottom: 100 },
  chips: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  title: { fontSize: 16, fontWeight: "800", color: colors.text },
  actions: { flexDirection: "row", gap: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  link: { color: colors.green, fontWeight: "700" },
  fab: { position: "absolute", right: 18, bottom: 18, ...shadow, elevation: 6 },
  fabFill: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
});
