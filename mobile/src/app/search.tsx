import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/config";
import { useApi, useDebounced } from "@/lib/hooks";
import { routeFor } from "@/lib/links";
import { Avatar, Card, Empty, ErrorBox, Loading, Muted, SectionTitle, Text, TextInput } from "@/components/ui";

type Result = { type: string; id: string; title: string; subtitle?: string; href: string; image?: string | null; meta?: string };
type Search = { q: string; types: string[]; labels: Record<string, string>; counts: Record<string, number>; results: Record<string, Result[]> };

const icons: Record<string, keyof typeof Ionicons.glyphMap> = { users: "person-outline", courses: "book-outline", contests: "trophy-outline", webinars: "videocam-outline", jobs: "briefcase-outline", communities: "people-outline" };

export default function SearchScreen() {
  const router = useRouter();
  const [text, setText] = useState("");
  const query = useDebounced(text.trim());
  const search = useApi<Search>(query.length >= 2 ? `frontend/search?q=${encodeURIComponent(query)}` : null);
  const data = search.data;
  const total = data ? Object.values(data.counts).reduce((sum, value) => sum + value, 0) : 0;

  function open(result: Result) {
    const route = routeFor(result.href);
    if (route) router.push(route);
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.box}>
        <Ionicons name="search-outline" size={20} color={colors.muted} />
        <TextInput autoFocus value={text} onChangeText={setText} placeholder="Search people, contests, webinars, jobs…" placeholderTextColor="#9aa7a0" style={styles.input} returnKeyType="search" autoCorrect={false} />
        {text ? <Ionicons name="close-circle" size={20} color={colors.muted} onPress={() => setText("")} /> : null}
      </View>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {query.length < 2 ? (
          <Muted style={{ textAlign: "center", padding: 24 }}>Type at least two letters to search.</Muted>
        ) : search.loading ? (
          <Loading />
        ) : search.error && !data ? (
          <ErrorBox message={search.error} onRetry={search.reload} />
        ) : total === 0 ? (
          <Empty icon="search-outline" title={`Nothing found for “${query}”`} text="Check the spelling or try a shorter word." />
        ) : (
          data?.types
            .filter((type) => data.results[type]?.length)
            .map((type) => (
              <View key={type} style={{ gap: 8 }}>
                <SectionTitle>
                  {data.labels[type] || type} ({data.counts[type]})
                </SectionTitle>
                {data.results[type].map((result) => (
                  <Card key={`${type}-${result.id}`} onPress={() => open(result)} style={styles.result}>
                    {type === "users" ? (
                      <Avatar id={result.id} name={result.title} hasPicture={Boolean(result.image)} size={40} />
                    ) : (
                      <View style={styles.icon}>
                        <Ionicons name={icons[type] || "ellipse-outline"} size={20} color={colors.green} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.title} numberOfLines={1}>
                        {result.title}
                      </Text>
                      {result.subtitle ? (
                        <Muted numberOfLines={1}>{result.subtitle}</Muted>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                  </Card>
                ))}
              </View>
            ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", alignItems: "center", gap: 8, margin: 14, marginBottom: 0, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff" },
  input: { flex: 1, minHeight: 48, fontSize: 16, color: colors.text },
  page: { padding: 14, gap: 12, paddingBottom: 40 },
  result: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  title: { fontWeight: "800", color: colors.text, fontSize: 15 },
});
