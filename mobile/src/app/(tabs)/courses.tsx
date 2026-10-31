import { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients } from "@/lib/config";
import { useCategories, useDebounced, usePaged } from "@/lib/hooks";
import { money } from "@/lib/format";
import { Avatar, Card, Chip, Dropdown, Empty, ErrorBox, FilterBar, Loading, Muted, ProgressBar, RemoteImage, Text, TopTabs } from "@/components/ui";

export type CourseRow = {
  id: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  has_cover_image: boolean;
  enrolled: boolean;
  progress_done?: string | number;
  progress_total?: string | number;
  instructor_id?: string | null;
  instructor_name?: string | null;
  instructor_has_image?: boolean;
  category_details?: { id: string; name: string }[];
};

const SORTS = [
  { value: "", label: "Newest" },
  { value: "price", label: "Price" },
  { value: "learners", label: "Most learners" },
  { value: "materials", label: "Most materials" },
];

export function CourseCover({ course, height = 130 }: { course: Pick<CourseRow, "id" | "has_cover_image">; height?: number }) {
  const placeholder = (
    <LinearGradient colors={gradients.hero} style={{ height, width: "100%", alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="book-outline" size={42} color="rgba(255,255,255,0.75)" />
    </LinearGradient>
  );
  if (!course.has_cover_image) return placeholder;
  return <RemoteImage path={`frontend/course-covers/${course.id}`} style={{ height, width: "100%" }} fallback={placeholder} />;
}

export default function CoursesTab() {
  const router = useRouter();
  const [tab, setTab] = useState<"all" | "enrolled">("all");
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("");
  const [direction, setDirection] = useState("desc");
  const query = useDebounced(text.trim());
  const categories = useCategories();
  const list = usePaged<CourseRow>(`frontend/catalog/courses?tab=${tab}&q=${encodeURIComponent(query)}&category=${category}&sort=${sort}&direction=${direction}`);

  return (
    <View style={{ flex: 1 }}>
      <TopTabs
        tabs={[
          { value: "all", label: "All courses" },
          { value: "enrolled", label: "My courses" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <FilterBar value={text} onChangeText={setText} placeholder="Search courses…">
        <Dropdown compact icon="funnel-outline" value={category} placeholder="All interests" options={[{ value: "", label: "All interests" }, ...categories.map((item) => ({ value: String(item.id), label: item.name }))]} onChange={setCategory} />
        <Dropdown compact icon="swap-vertical-outline" value={sort} placeholder="Sort" options={SORTS} onChange={setSort} />
        {sort ? <Dropdown compact value={direction} options={[{ value: "desc", label: "High → low" }, { value: "asc", label: "Low → high" }]} onChange={setDirection} /> : null}
      </FilterBar>
      {list.loading ? (
        <Loading />
      ) : list.error && !list.items.length ? (
        <ErrorBox message={list.error} onRetry={list.reload} />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(course) => course.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.6}
          refreshing={list.refreshing}
          onRefresh={list.refresh}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Empty icon="book-outline" title={tab === "enrolled" ? "No courses yet" : "No courses match"} text={tab === "enrolled" ? "Courses you enroll in will be listed here with your progress." : "Try a different search or interest."} />}
          ListFooterComponent={list.loadingMore ? <Loading /> : undefined}
          renderItem={({ item }) => <CourseCard course={item} onPress={() => router.push(`/course/${item.id}`)} />}
        />
      )}
    </View>
  );
}

export function CourseCard({ course, onPress }: { course: CourseRow; onPress: () => void }) {
  const total = Number(course.progress_total || 0);
  const done = Number(course.progress_done || 0);
  return (
    <Card testID={`course-card-${course.id}`} onPress={onPress} style={{ padding: 0, overflow: "hidden", gap: 0 }}>
      <CourseCover course={course} />
      <View style={{ padding: 14, gap: 8 }}>
        <View style={styles.chips}>
          {course.enrolled ? <Chip label="Enrolled" icon="checkmark-circle" /> : null}
          {course.category_details?.slice(0, 2).map((category) => (
            <Chip key={category.id} label={category.name} tone="gray" />
          ))}
        </View>
        <Text style={styles.title}>{course.title}</Text>
        <Text style={styles.desc} numberOfLines={2}>
          {course.description}
        </Text>
        {course.enrolled ? (
          <View style={{ gap: 4 }}>
            <ProgressBar value={total ? (done / total) * 100 : 0} />
            <Muted>
              {done} of {total} materials
            </Muted>
          </View>
        ) : null}
        <View style={styles.foot}>
          {course.instructor_name ? (
            <View style={styles.instructor}>
              <Avatar id={course.instructor_id || undefined} name={course.instructor_name} hasPicture={course.instructor_has_image} size={24} instructor />
              <Muted numberOfLines={1} style={{ flex: 1 }}>
                {course.instructor_name}
              </Muted>
            </View>
          ) : (
            <View />
          )}
          <Text style={styles.price}>{money(course.price, course.currency)}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { padding: 14, paddingBottom: 30 },
  chips: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  title: { fontSize: 17, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  desc: { color: colors.muted, lineHeight: 20 },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  instructor: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  price: { color: colors.orange, fontWeight: "800", fontSize: 16 },
});
