import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/config";
import { Button, Card, Hero, Loading, Muted, Notice, Text, TextInput } from "@/components/ui";
import { AiChat } from "@/components/ai-chat";

type Category = { id: string; name: string };

/** Choose interests: the first thing a new learner does, and reachable later from the profile. */
export default function Interests() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [selected, setSelected] = useState<string[]>((user?.interests || []).map((item) => item.id));
  const [term, setTerm] = useState("");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Category[]>("users/interests").then(setCategories).catch((problem) => setError(problem.message));
  }, []);

  // The signed-in user object may not carry the interests, so load the saved ones from the profile.
  useEffect(() => {
    if (!user) return;
    api<{ interests: Category[] }>(`frontend/profile/${user.id}`)
      .then((profile) => setSelected((current) => (current.length ? current : (profile.interests || []).map((item) => String(item.id)))))
      .catch(() => undefined);
  }, [user?.id]);

  const shown = (categories || []).filter((item) => item.name.toLowerCase().includes(term.trim().toLowerCase()));
  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : current.length >= 30 ? current : [...current, id]));

  async function save() {
    setBusy(true);
    setError("");
    try {
      await api("frontend/profile/interests", { method: "PUT", body: { interest_ids: selected } });
      await refreshUser();
      router.replace("/");
    } catch (problem: any) {
      setError(problem.message);
      setBusy(false);
    }
  }

  if (asking)
    return (
      <View style={{ flex: 1 }}>
        <AiChat endpoint="frontend/ai/interests" intro="Tell me what you enjoy, what you want to learn or what job you're aiming for, and I'll suggest interests." starters={["I'm new here, where should I start?", "I want a job in tech", "I love creative work"]} />
        <View style={{ padding: 12 }}>
          <Button label="Back to the list" kind="secondary" onPress={() => setAsking(false)} />
        </View>
      </View>
    );

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Hero>
        <Text style={{ color: colors.orangeLight, fontWeight: "800", fontSize: 12, letterSpacing: 1.2 }}>PERSONALISE UDDEEPTO</Text>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800", letterSpacing: -0.6 }}>What are you into?</Text>
        <Text style={{ color: "rgba(255,255,255,0.85)", lineHeight: 21 }}>Courses, contests, webinars and jobs are matched to the interests you pick.</Text>
      </Hero>
      {!categories ? (
        error ? <Notice>{error}</Notice> : <Loading />
      ) : (
        <Card>
          <View style={styles.search}>
            <Ionicons name="search-outline" size={18} color={colors.muted} />
            <TextInput value={term} onChangeText={setTerm} placeholder="Search interests…" placeholderTextColor="#9aa7a0" style={styles.searchInput} autoCorrect={false} />
          </View>
          <Muted>{selected.length} selected · pick as many as you like (up to 30). You can change them any time.</Muted>
          <View style={styles.chips}>
            {shown.map((item) => {
              const on = selected.includes(String(item.id));
              return (
                <Pressable key={item.id} onPress={() => toggle(String(item.id))} style={[styles.chip, on && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                  {on ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                  <Text style={[styles.chipText, on && { color: "#fff" }]}>{item.name}</Text>
                </Pressable>
              );
            })}
            {!shown.length ? <Muted>Nothing matches “{term}”.</Muted> : null}
          </View>
        </Card>
      )}
      <Button label="Not sure? Ask the AI assistant" icon="sparkles-outline" kind="soft" onPress={() => setAsking(true)} />
      {error && categories ? <Notice>{error}</Notice> : null}
      <Button label={selected.length ? `Save ${selected.length} interest${selected.length === 1 ? "" : "s"}` : "Choose at least one"} icon="checkmark" onPress={save} busy={busy} disabled={!selected.length} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 14, gap: 14, paddingBottom: 36 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff" },
  searchInput: { flex: 1, minHeight: 44, fontSize: 15, color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff" },
  chipOn: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { color: colors.text, fontWeight: "700", fontSize: 13 },
});
