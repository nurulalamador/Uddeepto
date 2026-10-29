import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useCategories } from "@/lib/hooks";
import { label } from "@/lib/format";
import { colors } from "@/lib/config";
import { Button, Dropdown, Input, Notice, Text } from "@/components/ui";

const TYPES = ["permanent", "contract", "internship", "part_time", "freelance", "one_time"];

/** Day, month and year for the application deadline (the deadline is the end of that day). */
function DatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [year, month, day] = value ? value.split("-") : ["", "", ""];
  const years = Array.from({ length: 4 }, (_, index) => String(new Date().getFullYear() + index));
  const daysIn = year && month ? new Date(Number(year), Number(month), 0).getDate() : 31;
  const set = (y: string, m: string, d: string) => onChange(y && m && d ? `${y}-${m}-${d}` : "");
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Dropdown compact value={day || ""} placeholder="Day" options={[{ value: "", label: "—" }, ...Array.from({ length: daysIn }, (_, index) => ({ value: String(index + 1).padStart(2, "0"), label: String(index + 1) }))]} onChange={(next) => set(year || years[0], month || "01", next)} />
        <Dropdown compact value={month || ""} placeholder="Month" options={[{ value: "", label: "—" }, ...["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((name, index) => ({ value: String(index + 1).padStart(2, "0"), label: name }))]} onChange={(next) => set(year || years[0], next, day || "01")} />
        <Dropdown compact value={year || ""} placeholder="Year" options={[{ value: "", label: "—" }, ...years.map((item) => ({ value: item, label: item }))]} onChange={(next) => set(next, month || "01", day || "01")} />
      </View>
    </View>
  );
}

export default function JobPost() {
  const router = useRouter();
  const categories = useCategories();
  const bottom = 30;
  const [f, setF] = useState({ title: "", description: "", location: "", salary_min: "", salary_max: "" });
  const [type, setType] = useState("permanent");
  const [category, setCategory] = useState("");
  const [mode, setMode] = useState("onsite");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof typeof f) => (value: string) => setF((current) => ({ ...current, [key]: value }));

  async function submit() {
    if (!f.title.trim() || !f.description.trim()) return setError("Enter a title and a description.");
    if (!category) return setError("Choose the interest category this job belongs to.");
    const remote = mode === "remote";
    if (!remote && !f.location.trim()) return setError("Enter where the job is located, or choose Remote.");
    const min = f.salary_min ? Number(f.salary_min) : null;
    const max = f.salary_max ? Number(f.salary_max) : null;
    if ((min !== null && Number.isNaN(min)) || (max !== null && Number.isNaN(max))) return setError("Salary must be a number.");
    if (min !== null && max !== null && max < min) return setError("The maximum salary is below the minimum.");
    setBusy(true);
    setError("");
    try {
      await api("jobs", {
        method: "POST",
        body: {
          title: f.title.trim(),
          description: f.description.trim(),
          type,
          category_id: category,
          is_remote: remote,
          location: f.location.trim() || null,
          latitude: null,
          longitude: null,
          salary_min: min,
          salary_max: max,
          application_deadline: deadline ? new Date(`${deadline}T23:59:00`).toISOString() : null,
          status: "open",
        },
      });
      router.back();
    } catch (problem: any) {
      setError(problem.message);
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView contentContainerStyle={[styles.page, { paddingBottom: bottom }]} keyboardShouldPersistTaps="handled">
        <Input label="Job title" value={f.title} onChangeText={set("title")} maxLength={250} />
        <Input label="Description" value={f.description} onChangeText={set("description")} multiline style={{ minHeight: 140 }} />
        <Dropdown label="Interest category" value={category} placeholder="Which interest does this job belong to?" options={categories.map((item) => ({ value: String(item.id), label: item.name }))} onChange={setCategory} />
        <Dropdown label="Type" value={type} options={TYPES.map((item) => ({ value: item, label: label(item) }))} onChange={setType} />
        <Dropdown label="Work mode" value={mode} options={[{ value: "onsite", label: "On-site / Hybrid" }, { value: "remote", label: "Remote" }]} onChange={setMode} />
        {mode === "remote" ? null : <Input label="Location" value={f.location} onChangeText={set("location")} placeholder="Dhaka, Bangladesh" maxLength={250} />}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input label="Salary min" value={f.salary_min} onChangeText={set("salary_min")} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Salary max" value={f.salary_max} onChangeText={set("salary_max")} keyboardType="decimal-pad" />
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>Application deadline (optional)</Text>
          <DatePicker value={deadline} onChange={setDeadline} />
        </View>
        {error ? <Notice>{error}</Notice> : null}
        <Button label="Post this job" icon="send" onPress={submit} busy={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ page: { padding: 16, gap: 14 } });
