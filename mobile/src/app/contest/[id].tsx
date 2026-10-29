import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/lib/api";
import { colors } from "@/lib/config";
import { useApi } from "@/lib/hooks";
import { EventHero, type Category } from "@/components/event";
import { prepareImage } from "@/lib/images";
import { count, dateTime, label, money } from "@/lib/format";
import { Avatar, Button, Card, Chip, Dropdown, ErrorBox, Input, Loading, Muted, Notice, SectionTitle, TopTabs, Text } from "@/components/ui";

type Contest = {
  id: string;
  name: string;
  description: string;
  type: string;
  entry_fee: string;
  currency: string;
  status: string;
  max_participants: number | null;
  starting_time: string;
  ending_time: string;
  category_name?: string;
  category_details?: Category[];
  participant_count: string | number;
  joined: boolean;
  phase: "upcoming" | "ongoing" | "previous";
  submission_kind: "code" | "text" | "image" | "audio";
  problems: { id: string; name: string; description: string; points: string; sample_input?: string; sample_output?: string }[];
  my_submissions: { id: string; problem_name?: string; content?: string; status: string; score?: string | null; feedback?: string | null; submitted_at: string; file_name?: string }[];
};
type Participant = { id: string; name: string; has_picture: boolean; points: string | null; rank: string | number | null };

export default function ContestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const contest = useApi<Contest>(`frontend/contests/${id}`);
  const [tab, setTab] = useState<"details" | "entry" | "leaders">("details");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const data = contest.data;

  async function join() {
    setBusy(true);
    setError("");
    try {
      await api(`frontend/contests/${id}/join`, { method: "POST" });
      await contest.reload();
    } catch (problem: any) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  if (contest.loading) return <Loading />;
  if (!data) return <ErrorBox message={contest.error || "This contest is not available."} onRetry={contest.reload} />;
  const open = data.phase !== "previous" && data.status === "published";
  const paid = Number(data.entry_fee) > 0;

  return (
    <View style={{ flex: 1 }}>
      <TopTabs
        tabs={[
          { value: "details", label: "Details" },
          { value: "entry", label: "My entry" },
          { value: "leaders", label: "Leaderboard" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {tab === "details" && (
          <>
            <EventHero
              eyebrow="CONTEST"
              title={data.name}
              description={data.description}
              start={data.starting_time}
              end={data.ending_time}
              categories={data.category_details}
              fallbackCategory={data.category_name}
              chips={
                <>
                  <Chip label={data.phase === "ongoing" ? "Live now" : label(data.phase)} tone={data.phase === "ongoing" ? "orange" : data.phase === "upcoming" ? "green" : "gray"} />
                  {data.status === "cancelled" ? <Chip label="Cancelled" tone="red" /> : null}
                  {data.joined ? <Chip label="Joined" icon="checkmark-circle" /> : null}
                </>
              }
              facts={[
                { icon: "people-outline", text: `${count(data.participant_count)} participant${count(data.participant_count) === 1 ? "" : "s"}${data.max_participants ? ` · limit ${data.max_participants}` : ""}` },
                { icon: "ticket-outline", text: `Entry: ${money(data.entry_fee, data.currency)}` },
              ]}
            />
            {error ? <Notice>{error}</Notice> : null}
            {!data.joined && open && <Button label={paid ? `Join this contest · ${money(data.entry_fee, data.currency)}` : "Join this contest"} icon="trophy-outline" onPress={join} busy={busy} />}
            {data.problems.length > 0 && (
              <>
                <SectionTitle>Problems</SectionTitle>
                {data.problems.map((problem) => (
                  <Card key={problem.id}>
                    <Text style={styles.name}>{problem.name}</Text>
                    <Chip label={`${Number(problem.points)} points`} tone="orange" />
                    <Text style={styles.text}>{problem.description}</Text>
                    {problem.sample_input ? <Muted>Sample input: {problem.sample_input}</Muted> : null}
                    {problem.sample_output ? <Muted>Sample output: {problem.sample_output}</Muted> : null}
                  </Card>
                ))}
              </>
            )}
          </>
        )}

        {tab === "entry" && <Entry contest={data} reload={contest.reload} />}
        {tab === "leaders" && <Leaderboard id={data.id} />}
      </ScrollView>
    </View>
  );
}

function Entry({ contest, reload }: { contest: Contest; reload: () => Promise<void> }) {
  const [problem, setProblem] = useState(contest.problems[0]?.id || "");
  const [language, setLanguage] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileKind = contest.submission_kind === "image" || contest.submission_kind === "audio";

  const [picked, setPicked] = useState<{ uri: string; name: string; type: string } | null>(null);

  async function pick() {
    if (contest.submission_kind === "image") {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
      const asset = result.assets?.[0];
      if (!result.canceled && asset) setPicked(await prepareImage(asset));
    } else {
      const result = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true });
      const asset = result.assets?.[0];
      if (!result.canceled && asset) setPicked({ uri: asset.uri, name: asset.name, type: asset.mimeType || "audio/mpeg" });
    }
  }

  async function submit() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (fileKind) {
        if (!picked) throw new Error(contest.submission_kind === "image" ? "Choose a picture first." : "Choose an audio file first.");
        const form = new FormData();
        if (problem) form.append("problem_id", problem);
        if (content.trim()) form.append("content", content.trim());
        form.append("file", picked as any);
        await api(`frontend/contests/${contest.id}/submit`, { method: "POST", form });
        setPicked(null);
      } else {
        await api(`frontend/contests/${contest.id}/submit`, { method: "POST", body: { problem_id: problem || null, content, language: contest.submission_kind === "code" && language ? language : undefined } });
      }
      setContent("");
      setMessage("Submission received. Good luck!");
      await reload();
    } catch (problemError: any) {
      setError(problemError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!contest.joined ? (
        <Muted style={{ textAlign: "center", padding: 24 }}>Join the contest first to send an entry.</Muted>
      ) : contest.phase !== "ongoing" || contest.status !== "published" ? (
        <Muted style={{ textAlign: "center", padding: 12 }}>{contest.phase === "upcoming" ? "Entries open when the contest starts." : "This contest is closed for new entries."}</Muted>
      ) : (
        <Card>
          <Text style={styles.name}>{contest.submission_kind === "code" ? "Submit your solution" : "Submit your entry"}</Text>
          {contest.problems.length > 1 && <Dropdown label="Problem" value={problem} options={contest.problems.map((item) => ({ value: item.id, label: item.name }))} onChange={setProblem} />}
          {contest.submission_kind === "code" && <Input label="Language" value={language} onChangeText={setLanguage} placeholder="Python, C++, JavaScript…" autoCapitalize="none" />}
          {fileKind ? (
            <>
              <Button label={picked ? picked.name : contest.submission_kind === "image" ? "Choose a picture" : "Choose an audio file"} icon={contest.submission_kind === "image" ? "image-outline" : "musical-notes-outline"} kind="soft" onPress={pick} />
              <Input label="Note for the judges (optional)" value={content} onChangeText={setContent} multiline style={{ minHeight: 80 }} />
            </>
          ) : null}
          {!fileKind && <Input label={contest.submission_kind === "code" ? "Your code" : "Your answer"} value={content} onChangeText={setContent} multiline autoCapitalize="none" style={contest.submission_kind === "code" ? { fontFamily: "monospace", minHeight: 160 } : { minHeight: 140 }} />}
          {message ? <Notice tone="success">{message}</Notice> : null}
          {error ? <Notice>{error}</Notice> : null}
          <Button label="Submit entry" icon="send" onPress={submit} busy={busy} disabled={fileKind ? !picked : !content.trim()} />
        </Card>
      )}

      {contest.my_submissions.length > 0 && (
        <>
          <SectionTitle>Your submissions</SectionTitle>
          {contest.my_submissions.map((entry) => (
            <Card key={entry.id}>
              <View style={styles.chips}>
                <Chip label={label(entry.status)} tone={entry.status === "accepted" ? "green" : entry.status === "rejected" || entry.status === "disqualified" ? "red" : "orange"} />
                {entry.score != null ? <Chip label={`${Number(entry.score)} pts`} tone="gray" /> : null}
              </View>
              {entry.problem_name ? <Text style={styles.name}>{entry.problem_name}</Text> : null}
              {entry.content ? (
                <Text style={[styles.text, { fontFamily: contest.submission_kind === "code" ? "monospace" : undefined }]} numberOfLines={6}>
                  {entry.content}
                </Text>
              ) : entry.file_name ? (
                <Muted>{entry.file_name}</Muted>
              ) : null}
              {entry.feedback ? <Muted>Feedback: {entry.feedback}</Muted> : null}
              <Muted>{dateTime(entry.submitted_at)}</Muted>
            </Card>
          ))}
        </>
      )}
    </>
  );
}

function Leaderboard({ id }: { id: string }) {
  const list = useApi<Participant[]>(`frontend/contests/${id}/participants`);
  if (list.loading) return <Loading />;
  if (list.error && !list.data) return <ErrorBox message={list.error} onRetry={list.reload} />;
  const rows = list.data || [];
  if (!rows.length) return <Muted style={{ textAlign: "center", padding: 24 }}>Nobody has joined yet.</Muted>;
  return (
    <>
      {rows.map((person, index) => (
        <Card key={person.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text style={[styles.rank, person.rank && Number(person.rank) <= 3 ? { color: colors.orange } : null]}>{person.rank ? `#${person.rank}` : index + 1}</Text>
          <Avatar id={person.id} name={person.name} hasPicture={person.has_picture} size={36} />
          <Text style={[styles.name, { flex: 1 }]} numberOfLines={1}>
            {person.name}
          </Text>
          {person.points != null ? <Muted>{Number(person.points)} pts</Muted> : null}
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 14, gap: 12, paddingBottom: 30 },
  chips: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  name: { fontSize: 16, fontWeight: "800", color: colors.text },
  text: { color: colors.text, fontSize: 14, lineHeight: 21 },
  rank: { width: 38, fontWeight: "800", fontSize: 16, color: colors.muted },
});
