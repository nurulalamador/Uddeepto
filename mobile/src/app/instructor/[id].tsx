import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/config";
import { useApi } from "@/lib/hooks";
import { Avatar, Card, ErrorBox, Loading, Muted, SectionTitle, Text } from "@/components/ui";
import { CourseCard, type CourseRow } from "../(tabs)/courses";

type Instructor = { id: string; name: string; designation?: string | null; details?: string | null; has_image: boolean; social_links?: Record<string, string>; courses: CourseRow[] };
const SOCIALS: [string, string, keyof typeof Ionicons.glyphMap][] = [
  ["linkedin", "LinkedIn", "logo-linkedin"],
  ["github", "GitHub", "logo-github"],
  ["website", "Website", "globe-outline"],
];
const safe = (link?: string) => (link && /^https?:\/\//i.test(link) ? link : "");

export default function InstructorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const resource = useApi<Instructor>(`frontend/instructors/${id}`);
  const person = resource.data;
  if (resource.loading) return <Loading />;
  if (!person) return <ErrorBox message={resource.error || "This instructor is not available."} onRetry={resource.reload} />;
  const links = SOCIALS.map(([key, name, icon]) => ({ key, name, icon, href: safe(person.social_links?.[key]) })).filter((link) => link.href);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Card style={{ alignItems: "center", gap: 6, padding: 20 }}>
        <Avatar id={person.id} name={person.name} hasPicture={person.has_image} size={110} instructor />
        <Text style={styles.eyebrow}>INSTRUCTOR</Text>
        <Text style={styles.name}>{person.name}</Text>
        {person.designation ? <Text style={{ color: colors.green, fontWeight: "700", textAlign: "center" }}>{person.designation}</Text> : null}
        {links.length ? (
          <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
            {links.map((link) => (
              <Pressable key={link.key} onPress={() => Linking.openURL(link.href)} style={styles.link}>
                <Ionicons name={link.icon} size={16} color={colors.green} />
                <Text style={{ color: colors.green, fontWeight: "700" }}>{link.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Card>
      {person.details ? (
        <Card>
          <Text style={styles.heading}>About</Text>
          <Text style={{ color: colors.text, lineHeight: 22, textAlign: "left" }}>{person.details}</Text>
        </Card>
      ) : null}
      <SectionTitle>Courses by {person.name}</SectionTitle>
      {person.courses.length === 0 ? <Muted>No published courses yet.</Muted> : null}
      {person.courses.map((course) => (
        <CourseCard key={course.id} course={{ ...course, enrolled: false, instructor_name: null }} onPress={() => router.push(`/course/${course.id}`)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 14, gap: 12, paddingBottom: 36 },
  eyebrow: { color: colors.orange, fontWeight: "800", fontSize: 12, letterSpacing: 1.2, marginTop: 8 },
  name: { fontSize: 24, fontWeight: "800", color: colors.text, letterSpacing: -0.5, textAlign: "center" },
  heading: { fontSize: 16, fontWeight: "800", color: colors.text },
  link: { flexDirection: "row", gap: 6, alignItems: "center", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.greenSoft },
});
