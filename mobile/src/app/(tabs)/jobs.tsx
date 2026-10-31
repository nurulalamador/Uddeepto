import { useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/config";
import { useCategories, useDebounced, usePaged } from "@/lib/hooks";
import { label, salary } from "@/lib/format";
import { JobsMap } from "@/components/jobs-map";
import { Card, Chip, Dropdown, Empty, ErrorBox, FilterBar, Loading, Muted, TopTabs, Text } from "@/components/ui";

export type JobRow = {
  id: string;
  title: string;
  status: string;
  type: string;
  salary_min: string | null;
  salary_max: string | null;
  currency: string;
  salary_period: string | null;
  location: string | null;
  is_remote: boolean;
  creator_name: string;
  application_status: string | null;
  application_deadline: string | null;
  category_details?: { id: string; name: string }[];
};

const TYPES = ["permanent", "contract", "internship", "part_time", "freelance", "one_time"];
const SORTS = [
  { value: "", label: "Newest" },
  { value: "salary", label: "Highest salary" },
  { value: "deadline", label: "Deadline" },
];

export default function JobsTab() {
  const [tab, setTab] = useState<"explore" | "applied">("explore");
  const [text, setText] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const query = useDebounced(text.trim());
  const categories = useCategories();
  const router = useRouter();
  const filters = `tab=${tab}&q=${encodeURIComponent(query)}&type=${type}&category=${category}&sort=${sort}`;
  const list = usePaged<JobRow>(view === "list" || tab === "applied" ?`frontend/jobs?${filters}` : null);

  return (
    <View style={{ flex: 1 }}>
      <TopTabs
        tabs={[
          { value: "explore", label: "Explore jobs" },
          { value: "applied", label: "My applications" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <FilterBar value={text} onChangeText={setText} placeholder={tab === "explore" ? "Search jobs or places…" : "Search your applications…"}>
        <Dropdown compact icon="briefcase-outline" value={type} placeholder="Any type" options={[{ value: "", label: "Any type" }, ...TYPES.map((item) => ({ value: item, label: label(item) }))]} onChange={setType} />
        <Dropdown compact icon="funnel-outline" value={category} placeholder="All interests" options={[{ value: "", label: "All interests" }, ...categories.map((item) => ({ value: String(item.id), label: item.name }))]} onChange={setCategory} />
        <Dropdown compact icon="swap-vertical-outline" value={sort} placeholder="Sort" options={SORTS} onChange={setSort} />
      </FilterBar>
      {view === "map" && tab === "explore" ? (
        <JobsMap query={filters} onOpen={(id) => router.push(`/job/${id}`)} />
      ) : list.loading ? (
        <Loading />
      ) : list.error && !list.items.length ? (
        <ErrorBox message={list.error} onRetry={list.reload} />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(job) => job.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.6}
          refreshing={list.refreshing}
          onRefresh={list.refresh}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Empty icon="briefcase-outline" title={tab === "explore" ? "No jobs match" : "No applications yet"} text={tab === "explore" ? "Try a different search." : "Jobs you apply to will be listed here with their status."} />}
          ListFooterComponent={list.loadingMore ? <Loading /> : undefined}
          renderItem={({ item }) => <JobCard job={item} onPress={() => router.push(`/job/${item.id}`)} />}
        />
      )}
      {tab === "explore" ? (
        <Pressable onPress={() => setView(view === "map" ? "list" : "map")} style={styles.float} accessibilityRole="button" accessibilityLabel={view === "map" ? "Show list view" : "Show map view"}>
          <Ionicons name={view === "map" ? "list" : "map"} size={18} color="#fff" />
          <Text style={styles.floatText}>{view === "map" ? "List" : "Map"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function JobCard({ job, onPress }: { job: JobRow; onPress: () => void }) {
  return (
    <Card testID={`job-card-${job.id}`} onPress={onPress}>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {job.application_status ? <Chip label={job.application_status === "applied" ? "Applied" : `Applied · ${label(job.application_status)}`} tone={job.application_status === "accepted" ? "green" : job.application_status === "rejected" ? "red" : "orange"} /> : null}
        {job.status !== "open" ? <Chip label={label(job.status)} tone="gray" /> : null}
      </View>
      <Text style={styles.title}>{job.title}</Text>
      <Muted>{job.creator_name}</Muted>
      <View style={styles.meta}>
        <Ionicons name="location-outline" size={14} color={colors.muted} />
        <Muted>
          {job.is_remote ? "Remote" : job.location || "Location not specified"} · {label(job.type)}
        </Muted>
      </View>
      <Text style={styles.salary}>{salary(job)}</Text>
      {job.category_details?.length ? (
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {job.category_details.map((category) => (
            <Chip key={category.id} label={category.name} />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 14, marginTop: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff" },
  searchInput: { flex: 1, minHeight: 44, fontSize: 15, color: colors.text },
  list: { padding: 14, paddingBottom: 30 },
  title: { fontSize: 16, fontWeight: "800", color: colors.text },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  salary: { color: colors.orange, fontWeight: "800" },
  float: { position: "absolute", right: 16, bottom: 16, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999, backgroundColor: colors.green, elevation: 6, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  floatText: { color: "#fff", fontWeight: "800" },
});
