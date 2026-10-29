import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/config";
import { useApi } from "@/lib/hooks";
import { ago, dateTime, label, salary } from "@/lib/format";
import { Button, Card, Chip, ErrorBox, Hero, InterestIcon, Input, Loading, Muted, Notice, SectionTitle, Text } from "@/components/ui";

type Job = {
  id: string;
  creator_id: string;
  creator_name: string;
  category_details?: { id: string; name: string; icon?: string }[];
  creator_uddeepto_id?: string;
  title: string;
  description: string;
  status: string;
  type: string;
  salary_min: string | null;
  salary_max: string | null;
  currency: string;
  salary_period: string | null;
  location: string | null;
  is_remote: boolean;
  criteria: string[] | string | null;
  application_deadline: string | null;
  created_at: string;
  application_status: string | null;
  applied_at: string | null;
  accepting: boolean;
};
function Fact({ icon, label: name, value, accent = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.fact}>
      <View style={[styles.factIcon, accent && { backgroundColor: colors.orangeSoft }]}>
        <Ionicons name={icon} size={18} color={accent ? colors.orange : colors.green} />
      </View>
      <Text style={styles.factLabel}>{name}</Text>
      <Text style={[styles.factValue, accent && { color: colors.orange }]}>{value}</Text>
    </View>
  );
}

type CvInfo = { has_cv: boolean; file_name?: string };

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const job = useApi<Job>(`frontend/jobs/${id}`);
  const data = job.data;

  if (job.loading) return <Loading />;
  if (!data) return <ErrorBox message={job.error || "This job is not available."} onRetry={job.reload} />;
  const criteria = Array.isArray(data.criteria) ? data.criteria : data.criteria ? String(data.criteria).split(/\r?\n/).filter(Boolean) : [];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Hero style={{ gap: 10 }}>
          <View style={styles.chips}>
            <Chip label={label(data.status)} tone={data.status === "open" ? "green" : "gray"} />
            <Chip label={label(data.type)} tone="gray" />
            {data.is_remote ? <Chip label="Remote" tone="orange" /> : null}
          </View>
          <Text style={styles.title}>{data.title}</Text>
          <Pressable onPress={() => router.push(`/user/${data.creator_uddeepto_id || data.creator_id}`)} style={styles.row}>
            <Ionicons name="business-outline" size={16} color={colors.orangeLight} />
            <Text style={styles.company}>{data.creator_name}</Text>
          </Pressable>
          {data.category_details?.length ? (
            <View style={styles.chips}>
              {data.category_details.map((category) => (
                <View key={category.id} style={styles.glass}>
                  <InterestIcon name={category.icon} size={13} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>{category.name}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Hero>

        <View style={styles.facts}>
          <Fact icon="cash-outline" label="Salary" value={salary(data)} accent />
          <Fact icon="location-outline" label="Location" value={data.is_remote ? "Remote" : data.location || "Not specified"} />
          <Fact icon="time-outline" label="Posted" value={ago(data.created_at)} />
          <Fact icon="calendar-outline" label="Apply by" value={data.application_deadline ? dateTime(data.application_deadline) : "No deadline"} />
        </View>

        <Card>
          <Text style={styles.heading}>About the job</Text>
          <Text style={styles.text}>{data.description}</Text>
          {criteria.length > 0 && (
            <>
              <Text style={[styles.heading, { marginTop: 8 }]}>What we look for</Text>
              {criteria.map((line, index) => (
                <Text key={index} style={styles.text}>
                  • {line}
                </Text>
              ))}
            </>
          )}
        </Card>

        {user?.role === "hirer" ? (
          data.creator_id === user.id ? <Button label="See applicants" icon="people-outline" onPress={() => router.replace("/hiring")} /> : null
        ) : data.application_status ? (
          <Card>
            <Text style={styles.heading}>Your application</Text>
            <Chip label={label(data.application_status)} tone={data.application_status === "accepted" ? "green" : data.application_status === "rejected" ? "red" : "orange"} />
            <Muted>Applied {ago(data.applied_at)}. The hirer will update the status here.</Muted>
          </Card>
        ) : data.accepting ? (
          <Apply job={data} onDone={job.reload} />
        ) : (
          <Notice>This job is no longer accepting applications.</Notice>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Apply({ job, onDone }: { job: Job; onDone: () => Promise<void> }) {
  const cv = useApi<CvInfo>("frontend/cv");
  const [letter, setLetter] = useState("");
  const [choice, setChoice] = useState<"current" | "upload">("current");
  const [file, setFile] = useState<{ uri: string; name: string; mimeType?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const hasCv = Boolean(cv.data?.has_cv);
  const useCurrent = hasCv && choice === "current";

  async function pick() {
    const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) setFile(result.assets[0]);
  }

  async function send() {
    if (!letter.trim()) return setError("Write a short cover letter.");
    if (!useCurrent && !file) return setError("Attach your CV as a PDF.");
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("cover_letter", letter.trim());
      if (useCurrent) form.append("use_current_cv", "true");
      else if (file) form.append("resume", { uri: file.uri, name: file.name, type: "application/pdf" } as any);
      await api(`jobs/${job.id}/apply`, { method: "POST", form });
      await onDone();
    } catch (problem: any) {
      setError(problem.message);
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle>Apply for this job</SectionTitle>
      <Input label="Cover letter" value={letter} onChangeText={setLetter} multiline placeholder="Why are you a good fit?" maxLength={5000} style={{ minHeight: 120 }} />
      <Text style={styles.heading}>CV (PDF)</Text>
      {cv.loading ? (
        <Loading />
      ) : (
        <>
          {hasCv && (
            <>
              <Choice selected={choice === "current"} onPress={() => setChoice("current")} title="Your Current CV" text={cv.data?.file_name} />
              <Choice selected={choice === "upload"} onPress={() => setChoice("upload")} title="Upload CV" text="Send a different PDF for this job only" />
            </>
          )}
          {!useCurrent && <Button label={file ? file.name : "Choose a PDF"} icon="document-attach-outline" kind="secondary" onPress={pick} />}
          {!hasCv && <Button label="Make a CV in the app" icon="document-text-outline" kind="soft" onPress={() => router.push("/cv")} />}
        </>
      )}
      {error ? <Notice>{error}</Notice> : null}
      <Button label="Send application" icon="send" onPress={send} busy={busy} />
    </Card>
  );
}

function Choice({ selected, onPress, title, text }: { selected: boolean; onPress: () => void; title: string; text?: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, selected && { borderColor: colors.green, backgroundColor: colors.greenSoft }]} accessibilityRole="radio" accessibilityState={{ selected }}>
      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={20} color={selected ? colors.green : colors.muted} />
      <View style={{ flex: 1 }}>
        <Text style={styles.choiceTitle}>{title}</Text>
        {text ? <Muted numberOfLines={1}>{text}</Muted> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 14, gap: 12, paddingBottom: 40 },
  chips: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  title: { fontSize: 25, fontWeight: "800", color: "#fff", letterSpacing: -0.6, lineHeight: 30 },
  company: { color: "#fff", fontWeight: "700", fontSize: 15 },
  glass: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.18)" },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  fact: { flexBasis: "47.5%", flexGrow: 1, backgroundColor: colors.card, borderRadius: 16, padding: 12, gap: 3, borderWidth: 1, borderColor: colors.border },
  factIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  factLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  factValue: { color: colors.text, fontWeight: "800", fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  salary: { color: colors.orange, fontWeight: "800", fontSize: 15 },
  heading: { fontSize: 15, fontWeight: "800", color: colors.text },
  text: { color: colors.text, fontSize: 14, lineHeight: 21 },
  choice: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  choiceTitle: { fontWeight: "800", color: colors.text },
});
