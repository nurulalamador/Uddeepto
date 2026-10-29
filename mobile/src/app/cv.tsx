import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import * as Print from "expo-print";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors, radius } from "@/lib/config";
import { useApi } from "@/lib/hooks";
import { dateTime } from "@/lib/format";
import { download, shareFile } from "@/lib/files";
import { ACCENTS, TEMPLATES, blankCertification, blankEducation, blankExperience, blankProject, cvFromProfile, cvHtml, fileNameFor, isBlank, normalizeCv, type Cv } from "@/lib/cv";
import { Button, Card, Chip, Dropdown, ErrorBox, Input, Loading, Muted, MonthPicker, Notice, SectionTitle, Text } from "@/components/ui";

type Saved = { has_cv: boolean; file_name?: string; file_size?: number; source?: "uploaded" | "generated"; template?: string; updated_at?: string; data?: any };

/** Makes the PDF from the CV details with the phone's print engine. */
async function makePdf(template: string, cv: Cv) {
  const { uri } = await Print.printToFileAsync({ html: cvHtml(template, cv), width: 595, height: 842 });
  return { uri, name: fileNameFor(cv) };
}

export default function CvScreen() {
  const { user } = useAuth();
  const profile = useApi<any>(user ? `frontend/profile/${user.id}` : null);
  const saved = useApi<Saved>("frontend/cv");
  if (profile.loading || saved.loading) return <Loading />;
  if (!profile.data || !saved.data) return <ErrorBox message={profile.error || saved.error || "Could not load your CV."} onRetry={() => { profile.reload(); saved.reload(); }} />;
  return <Generator profile={profile.data} saved={saved.data} reloadSaved={saved.reload} />;
}

function Generator({ profile, saved, reloadSaved }: { profile: any; saved: Saved; reloadSaved: () => Promise<void> }) {
  const [template, setTemplate] = useState(TEMPLATES.some((item) => item.id === saved.template) ? (saved.template as string) : "classic");
  const [cv, setCv] = useState<Cv>(() => (saved.has_cv && saved.source === "generated" && saved.data ? normalizeCv(saved.data) : cvFromProfile(profile)));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(false);
  const bottom = 24;
  const scroll = useRef<any>(null);

  const set = (patch: Partial<Cv>) => setCv((value) => ({ ...value, ...patch }));
  const personal = (key: keyof Cv["personal"]) => (text: string) => setCv((value) => ({ ...value, personal: { ...value.personal, [key]: text } }));

  async function run(kind: string, work: () => Promise<void>) {
    setBusy(kind);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (problem: any) {
      setError(problem.message || "Something went wrong.");
    } finally {
      setBusy("");
    }
  }

  const needsName = () => {
    if (isBlank(cv)) {
      setError("Add your name first.");
      return true;
    }
    return false;
  };

  const share = () =>
    run("share", async () => {
      if (needsName()) return;
      const pdf = await makePdf(template, cv);
      await shareFile(pdf.uri, "application/pdf", pdf.name);
    });

  const save = () =>
    run("save", async () => {
      if (needsName()) return;
      const pdf = await makePdf(template, cv);
      const form = new FormData();
      form.append("file", { uri: pdf.uri, name: pdf.name, type: "application/pdf" } as any);
      form.append("source", "generated");
      form.append("template", template);
      form.append("data", JSON.stringify(cv));
      await api("frontend/cv", { method: "PUT", form });
      await reloadSaved();
      setNotice("CV saved. It is now your current CV and can be used when you apply for jobs.");
      scroll.current?.scrollTo({ y: 0, animated: true });
    });

  const upload = () =>
    run("upload", async () => {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      const form = new FormData();
      form.append("file", { uri: asset.uri, name: asset.name, type: "application/pdf" } as any);
      form.append("source", "uploaded");
      await api("frontend/cv", { method: "PUT", form });
      await reloadSaved();
      setNotice("Your CV was uploaded.");
    });

  const view = () =>
    run("view", async () => {
      const file = await download("frontend/cv/file", saved.file_name || "cv.pdf");
      await shareFile(file.uri, "application/pdf", saved.file_name);
    });

  const remove = () =>
    Alert.alert("Remove your CV?", "Employers will no longer see it with your applications.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          run("remove", async () => {
            await api("frontend/cv", { method: "DELETE" });
            await reloadSaved();
            setNotice("Your CV was removed.");
          }),
      },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView ref={scroll} contentContainerStyle={[styles.page, { paddingBottom: bottom + 80 }]} keyboardShouldPersistTaps="handled">
        {notice ? <Notice tone="success">{notice}</Notice> : null}
        {error ? <Notice>{error}</Notice> : null}

        <Card>
          <Text style={styles.heading}>Your current CV</Text>
          {saved.has_cv ? (
            <>
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                <Chip label={saved.source === "generated" ? "Made in the CV generator" : "Uploaded PDF"} icon="document-text-outline" />
              </View>
              <Text style={{ fontWeight: "700", color: colors.text }}>{saved.file_name}</Text>
              <Muted>Updated {dateTime(saved.updated_at)}</Muted>
              <View style={styles.actions}>
                <Button label="View / share" icon="share-outline" kind="soft" onPress={view} busy={busy === "view"} style={{ flex: 1 }} />
                <Button label="Remove" icon="trash-outline" kind="secondary" onPress={remove} busy={busy === "remove"} style={{ flex: 1 }} />
              </View>
            </>
          ) : (
            <Muted>You have no CV yet. Make one below, or upload a PDF.</Muted>
          )}
          <Button label={saved.has_cv ? "Replace with a PDF" : "Upload a PDF"} icon="cloud-upload-outline" kind="secondary" onPress={upload} busy={busy === "upload"} />
        </Card>

        <SectionTitle>Make a CV</SectionTitle>
        <Card>
          <Dropdown label="Template" value={template} options={TEMPLATES.map((item) => ({ value: item.id, label: item.name, hint: item.blurb }))} onChange={setTemplate} />
          <Dropdown label="Accent colour" value={cv.accent} options={ACCENTS.map((item) => ({ value: item.id, label: item.name }))} onChange={(accent) => set({ accent })} />
          <Button label="Start again from my profile" icon="refresh-outline" kind="secondary" onPress={() => Alert.alert("Start again?", "Replace everything here with the details from your profile?", [{ text: "Cancel", style: "cancel" }, { text: "Replace", onPress: () => setCv(cvFromProfile(profile)) }])} />
        </Card>

        <Card>
          <Text style={styles.heading}>About you</Text>
          <Input label="Full name" value={cv.personal.name} onChangeText={personal("name")} />
          <Input label="Headline" value={cv.personal.headline} onChangeText={personal("headline")} placeholder="e.g. Junior web developer" />
          <Input label="Email" value={cv.personal.email} onChangeText={personal("email")} autoCapitalize="none" keyboardType="email-address" />
          <Input label="Phone" value={cv.personal.phone} onChangeText={personal("phone")} keyboardType="phone-pad" />
          <Input label="Address" value={cv.personal.address} onChangeText={personal("address")} />
          <Input label="Website / portfolio" value={cv.personal.website} onChangeText={personal("website")} autoCapitalize="none" />
          <Input label="Summary" value={cv.summary} onChangeText={(summary) => set({ summary })} multiline />
        </Card>

        <ListSection title="Experience" empty="No experience added." addLabel="Add experience" rows={cv.experience} onChange={(experience) => set({ experience })} blank={blankExperience}>
          {(row, update) => (
            <>
              <Input label="Job title" value={row.title} onChangeText={(title) => update({ title })} />
              <Input label="Workplace" value={row.workplace} onChangeText={(workplace) => update({ workplace })} />
              <Input label="Location" value={row.location} onChangeText={(location) => update({ location })} />
              <MonthPicker label="Start" value={row.start} onChange={(start) => update({ start })} />
              {row.current ? null : <MonthPicker label="End" value={row.end} onChange={(end) => update({ end })} optional />}
              <Button label={row.current ? "✓ I currently work here" : "I currently work here"} kind={row.current ? "soft" : "secondary"} onPress={() => update({ current: !row.current })} />
              <Input label="What did you do? (one point per line)" value={row.description} onChangeText={(description) => update({ description })} multiline />
            </>
          )}
        </ListSection>

        <ListSection title="Education" empty="No education added." addLabel="Add education" rows={cv.education} onChange={(education) => set({ education })} blank={blankEducation}>
          {(row, update) => (
            <>
              <Input label="Institution" value={row.institution} onChangeText={(institution) => update({ institution })} />
              <Input label="Degree" value={row.degree} onChangeText={(degree) => update({ degree })} />
              <Input label="Field of study" value={row.field} onChangeText={(field) => update({ field })} />
              <MonthPicker label="Start" value={row.start} onChange={(start) => update({ start })} />
              <MonthPicker label="End" value={row.end} onChange={(end) => update({ end })} optional />
              <Input label="Grade" value={row.grade} onChangeText={(grade) => update({ grade })} />
            </>
          )}
        </ListSection>

        <Card>
          <Text style={styles.heading}>Skills & languages</Text>
          <Input label="Skills (separate with commas)" value={cv.skills.join(", ")} onChangeText={(text) => set({ skills: text.split(",").map((item) => item.trimStart()) })} onBlur={() => set({ skills: cv.skills.map((item) => item.trim()).filter(Boolean) })} />
          <Input label="Languages (separate with commas)" value={cv.languages.join(", ")} onChangeText={(text) => set({ languages: text.split(",").map((item) => item.trimStart()) })} onBlur={() => set({ languages: cv.languages.map((item) => item.trim()).filter(Boolean) })} />
        </Card>

        <ListSection title="Projects" empty="No projects added." addLabel="Add project" rows={cv.projects} onChange={(projects) => set({ projects })} blank={blankProject}>
          {(row, update) => (
            <>
              <Input label="Project name" value={row.name} onChangeText={(name) => update({ name })} />
              <Input label="Link" value={row.link} onChangeText={(link) => update({ link })} autoCapitalize="none" />
              <Input label="Description (one point per line)" value={row.description} onChangeText={(description) => update({ description })} multiline />
            </>
          )}
        </ListSection>

        <ListSection title="Certifications" empty="No certifications added." addLabel="Add certification" rows={cv.certifications} onChange={(certifications) => set({ certifications })} blank={blankCertification}>
          {(row, update) => (
            <>
              <Input label="Title" value={row.title} onChangeText={(title) => update({ title })} />
              <Input label="Issuer" value={row.issuer} onChangeText={(issuer) => update({ issuer })} />
              <Input label="Year" value={row.year} onChangeText={(year) => update({ year })} keyboardType="number-pad" maxLength={4} />
            </>
          )}
        </ListSection>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: Math.max(bottom - 12, 12) }]}>
        <Button label="Preview" icon="eye-outline" kind="secondary" onPress={() => !needsName() && setPreview(true)} style={{ flex: 1 }} />
        <Button label="Share PDF" icon="share-outline" kind="secondary" onPress={share} busy={busy === "share"} style={{ flex: 1 }} />
        <Button label="Save CV" icon="save-outline" onPress={save} busy={busy === "save"} style={{ flex: 1 }} />
      </View>

      <Modal visible={preview} animationType="slide" onRequestClose={() => setPreview(false)}>
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View style={styles.previewHead}>
            <Text style={styles.heading}>Preview</Text>
            <Pressable onPress={() => setPreview(false)} hitSlop={10}>
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
          </View>
          <WebView originWhitelist={["*"]} source={{ html: cvHtml(template, cv) }} style={{ flex: 1 }} scalesPageToFit />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function ListSection<T>({ title, rows, onChange, blank, children, empty, addLabel }: { title: string; rows: T[]; onChange: (rows: T[]) => void; blank: () => T; children: (row: T, update: (patch: Partial<T>) => void) => ReactNode; empty: string; addLabel: string }) {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open !== null && open >= rows.length) setOpen(null);
  }, [rows.length, open]);
  const move = (index: number, to: number) => {
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
    setOpen(to);
  };
  return (
    <Card>
      <Text style={styles.heading}>{title}</Text>
      {rows.length === 0 ? <Muted>{empty}</Muted> : null}
      {rows.map((row, index) => {
        const label = Object.values(row as any).find((value) => typeof value === "string" && value) as string | undefined;
        const isOpen = open === index;
        return (
          <View key={index} style={styles.row}>
            <Pressable onPress={() => setOpen(isOpen ? null : index)} style={styles.rowHead}>
              <Text style={{ flex: 1, fontWeight: "700", color: colors.text }} numberOfLines={1}>
                {label || `${title} ${index + 1}`}
              </Text>
              <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
            </Pressable>
            {isOpen ? (
              <View style={{ gap: 10, paddingTop: 10 }}>
                {children(row, (patch) => onChange(rows.map((item, position) => (position === index ? { ...item, ...patch } : item))))}
                <View style={styles.actions}>
                  <Button label="Up" icon="arrow-up" kind="secondary" onPress={() => move(index, index - 1)} style={{ flex: 1 }} />
                  <Button label="Down" icon="arrow-down" kind="secondary" onPress={() => move(index, index + 1)} style={{ flex: 1 }} />
                  <Button label="Delete" icon="trash-outline" kind="danger" onPress={() => onChange(rows.filter((_, position) => position !== index))} style={{ flex: 1 }} />
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
      <Button
        label={addLabel}
        icon="add"
        kind="soft"
        onPress={() => {
          onChange([...rows, blank()]);
          setOpen(rows.length);
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { padding: 14, gap: 12 },
  heading: { fontSize: 16, fontWeight: "800", color: colors.text },
  actions: { flexDirection: "row", gap: 8 },
  row: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, backgroundColor: colors.surfaceMuted },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  bar: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 10, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  previewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: colors.border },
});
