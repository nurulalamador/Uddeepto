import { useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/config";
import { useApi, useCategories } from "@/lib/hooks";
import { dateOnly } from "@/lib/format";
import { Button, Card, Dropdown, ErrorBox, Input, Loading, Muted, MonthPicker, Notice, Text, useBottomInset } from "./ui";

type Education = { id: string; institution: string; degree?: string | null; field_of_study?: string | null; start_date: string; end_date: string | null; grade?: string | null; description?: string | null };
type Experience = { id: string; title: string; workplace: string; location?: string | null; category_id?: string | null; category_name?: string | null; start_date: string; end_date: string | null; description?: string | null };
type Profile = { education: Education[]; experience: Experience[] };

const month = (value?: string | null) => (value ? String(value).slice(0, 7) : "");
const thisMonth = () => new Date().toISOString().slice(0, 7);
const range = (start: string, end: string | null) => `${dateOnly(start)} - ${end ? dateOnly(end) : "Present"}`;

function useMyProfile() {
  const { user } = useAuth();
  return useApi<Profile>(user ? `frontend/profile/${user.id}` : null);
}

/** A list of the person's own entries with an add button and a form for adding and editing. */
function Manager<T extends { id: string }>({ rows, reload, refreshing, refresh, error, loading, empty, title, render, form }: { rows: T[] | undefined; reload: () => Promise<void>; refreshing: boolean; refresh: () => Promise<void>; error: string; loading: boolean; empty: string; title: string; render: (row: T) => React.ReactNode; form: (props: { entry: T | null; onDone: () => void; onClose: () => void }) => React.ReactNode }) {
  const [editing, setEditing] = useState<T | null | "new">(null);
  if (loading) return <Loading />;
  if (!rows) return <ErrorBox message={error || "Could not load."} onRetry={reload} />;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.green} />}>
        {rows.length === 0 ? <Muted style={{ textAlign: "center", padding: 24 }}>{empty}</Muted> : null}
        {rows.map((row) => (
          <Card testID={`entry-${title}-${row.id}`} key={row.id} onPress={() => setEditing(row)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1, gap: 2 }}>{render(row)}</View>
            <Ionicons name="create-outline" size={20} color={colors.green} />
          </Card>
        ))}
        <Button label={`Add ${title}`} icon="add" onPress={() => setEditing("new")} />
      </ScrollView>
      <Modal visible={editing !== null} animationType="slide" onRequestClose={() => setEditing(null)}>
        {editing !== null ? form({ entry: editing === "new" ? null : editing, onDone: () => { setEditing(null); reload(); }, onClose: () => setEditing(null) }) : null}
      </Modal>
    </View>
  );
}

function FormShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const bottom = useBottomInset(24);
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding">
      <View style={styles.head}>
        <Text style={styles.headTitle}>{title}</Text>
        <Pressable testID="entry-form-close" accessibilityLabel="Close form" onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.form, { paddingBottom: bottom }]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function confirmDelete(what: string, remove: () => Promise<void>) {
  Alert.alert(`Delete this ${what}?`, "This cannot be undone.", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: remove },
  ]);
}

export function EducationManager() {
  const profile = useMyProfile();
  return (
    <Manager
      rows={profile.data?.education}
      reload={profile.reload}
      refreshing={profile.refreshing}
      refresh={profile.refresh}
      error={profile.error}
      loading={profile.loading}
      title="education"
      empty="No education added yet."
      render={(row: Education) => (
        <>
          <Text style={styles.name}>{row.institution}</Text>
          {row.degree || row.field_of_study ? <Text style={styles.sub}>{[row.degree, row.field_of_study].filter(Boolean).join(" · ")}</Text> : null}
          <Muted>
            {range(row.start_date, row.end_date)}
            {row.grade ? ` · ${row.grade}` : ""}
          </Muted>
        </>
      )}
      form={({ entry, onDone, onClose }) => <EducationForm entry={entry as Education | null} onDone={onDone} onClose={onClose} />}
    />
  );
}

function EducationForm({ entry, onDone, onClose }: { entry: Education | null; onDone: () => void; onClose: () => void }) {
  const [f, setF] = useState({ institution: entry?.institution || "", degree: entry?.degree || "", field: entry?.field_of_study || "", grade: entry?.grade || "", description: entry?.description || "" });
  const [start, setStart] = useState(month(entry?.start_date));
  const [end, setEnd] = useState(month(entry?.end_date));
  const [current, setCurrent] = useState(entry ? !entry.end_date : false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof typeof f) => (value: string) => setF((v) => ({ ...v, [key]: value }));

  async function save() {
    if (!f.institution.trim()) return setError("Enter the institution.");
    if (!start) return setError("Choose when you started.");
    if (!current && !end) return setError("Choose when you finished, or mark that you still study here.");
    if (start > thisMonth()) return setError("The start date cannot be in the future.");
    if (!current && end < start) return setError("The end date is before the start date.");
    setBusy(true);
    setError("");
    try {
      const body = { institution: f.institution.trim(), degree: f.degree.trim() || undefined, field_of_study: f.field.trim() || undefined, start_date: start, end_date: current ? "" : end, grade: f.grade.trim() || undefined, description: f.description.trim() || undefined };
      await api(`frontend/profile/education${entry ? `/${entry.id}` : ""}`, { method: entry ? "PATCH" : "POST", body });
      onDone();
    } catch (problem: any) {
      setError(problem.message);
      setBusy(false);
    }
  }

  return (
    <FormShell title={entry ? "Edit education" : "Add education"} onClose={onClose}>
      <Input label="Institution" value={f.institution} onChangeText={set("institution")} placeholder="University of Dhaka" maxLength={200} />
      <Input label="Degree" value={f.degree} onChangeText={set("degree")} placeholder="BSc" maxLength={200} />
      <Input label="Field of study" value={f.field} onChangeText={set("field")} placeholder="Computer Science" maxLength={200} />
      <MonthPicker label="Start" value={start} onChange={setStart} />
      {current ? null : <MonthPicker label="End" value={end} onChange={setEnd} />}
      <Button testID="education-current" label={current ? "✓ I currently study here" : "I currently study here"} kind={current ? "soft" : "secondary"} onPress={() => setCurrent((v) => !v)} />
      <Input label="Grade" value={f.grade} onChangeText={set("grade")} placeholder="CGPA 3.8 / 4.0" maxLength={100} />
      <Input label="Description" value={f.description} onChangeText={set("description")} multiline maxLength={2000} />
      {error ? <Notice>{error}</Notice> : null}
      <Button label="Save" icon="checkmark" onPress={save} busy={busy} />
      {entry ? <Button label="Delete" icon="trash-outline" kind="danger" onPress={() => confirmDelete("education", async () => { try { await api(`frontend/profile/education/${entry.id}`, { method: "DELETE" }); onDone(); } catch (problem: any) { setError(problem.message); } })} /> : null}
    </FormShell>
  );
}

export function ExperienceManager() {
  const profile = useMyProfile();
  return (
    <Manager
      rows={profile.data?.experience}
      reload={profile.reload}
      refreshing={profile.refreshing}
      refresh={profile.refresh}
      error={profile.error}
      loading={profile.loading}
      title="experience"
      empty="No experience added yet."
      render={(row: Experience) => (
        <>
          <Text style={styles.name}>{row.title}</Text>
          <Text style={styles.sub}>{[row.workplace, row.location].filter(Boolean).join(" · ")}</Text>
          <Muted>{range(row.start_date, row.end_date)}</Muted>
        </>
      )}
      form={({ entry, onDone, onClose }) => <ExperienceForm entry={entry as Experience | null} onDone={onDone} onClose={onClose} />}
    />
  );
}

function ExperienceForm({ entry, onDone, onClose }: { entry: Experience | null; onDone: () => void; onClose: () => void }) {
  const categories = useCategories();
  const [f, setF] = useState({ title: entry?.title || "", workplace: entry?.workplace || "", location: entry?.location || "", description: entry?.description || "" });
  // "others" stands for an experience that fits none of the interest categories (stored without one).
  const [category, setCategory] = useState(entry ? (entry.category_id ? String(entry.category_id) : "others") : "");
  const [start, setStart] = useState(month(entry?.start_date));
  const [end, setEnd] = useState(month(entry?.end_date));
  const [current, setCurrent] = useState(entry ? !entry.end_date : false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof typeof f) => (value: string) => setF((v) => ({ ...v, [key]: value }));

  async function save() {
    if (!f.title.trim() || !f.workplace.trim()) return setError("Enter the job title and the workplace.");
    if (!category) return setError("Choose the interest this experience belongs to, or Others.");
    if (!start) return setError("Choose when you started.");
    if (!current && !end) return setError("Choose when you finished, or mark that you still work here.");
    if (start > thisMonth()) return setError("The start date cannot be in the future.");
    if (!current && end < start) return setError("The end date is before the start date.");
    setBusy(true);
    setError("");
    try {
      const body = { title: f.title.trim(), workplace: f.workplace.trim(), category_id: category === "others" ? null : category, location: f.location.trim() || undefined, start_date: start, end_date: current ? "" : end, description: f.description.trim() || undefined };
      await api(`frontend/profile/experience${entry ? `/${entry.id}` : ""}`, { method: entry ? "PATCH" : "POST", body });
      onDone();
    } catch (problem: any) {
      setError(problem.message);
      setBusy(false);
    }
  }

  return (
    <FormShell title={entry ? "Edit experience" : "Add experience"} onClose={onClose}>
      <Input label="Job title" value={f.title} onChangeText={set("title")} placeholder="Frontend Developer" maxLength={200} />
      <Input label="Workplace" value={f.workplace} onChangeText={set("workplace")} placeholder="Company or organization" maxLength={200} />
      <Dropdown label="Interest category" value={category} placeholder="Which interest does this belong to?" options={[...categories.map((item) => ({ value: String(item.id), label: item.name })), { value: "others", label: "Others" }]} onChange={setCategory} />
      <Input label="Location (optional)" value={f.location} onChangeText={set("location")} placeholder="Dhaka, Bangladesh" maxLength={200} />
      <MonthPicker label="Start" value={start} onChange={setStart} />
      {current ? null : <MonthPicker label="End" value={end} onChange={setEnd} />}
      <Button testID="experience-current" label={current ? "✓ I currently work here" : "I currently work here"} kind={current ? "soft" : "secondary"} onPress={() => setCurrent((v) => !v)} />
      <Input label="Description" value={f.description} onChangeText={set("description")} multiline maxLength={2000} placeholder="What did you work on?" />
      {error ? <Notice>{error}</Notice> : null}
      <Button label="Save" icon="checkmark" onPress={save} busy={busy} />
      {entry ? <Button label="Delete" icon="trash-outline" kind="danger" onPress={() => confirmDelete("experience", async () => { try { await api(`frontend/profile/experience/${entry.id}`, { method: "DELETE" }); onDone(); } catch (problem: any) { setError(problem.message); } })} /> : null}
    </FormShell>
  );
}

const styles = StyleSheet.create({
  page: { padding: 14, gap: 12, paddingBottom: 36 },
  name: { fontWeight: "800", color: colors.text, fontSize: 15 },
  sub: { color: colors.green, fontWeight: "600" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingTop: 40, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  headTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  form: { padding: 16, gap: 14 },
});
