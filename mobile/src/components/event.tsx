import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, gradients, radius } from "@/lib/config";
import { dateOnly, timeOnly } from "@/lib/format";
import { Avatar, CategoryChip, Hero, InterestIcon, Text, type IconName } from "./ui";

export type Category = { id: string; name: string; icon?: string };
export type Speaker = { id: string; name: string; designation?: string; has_image?: boolean };

const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** A small calendar tile: the month on top and the day below. */
export function DateTile({ value, ended = false }: { value: string; ended?: boolean }) {
  const date = new Date(value);
  return (
    <LinearGradient colors={ended ? ["#6b7a72", "#4d5b54"] : gradients.brand} style={styles.tile}>
      <Text style={styles.tileMonth}>{months[date.getMonth()]}</Text>
      <Text style={styles.tileDay}>{date.getDate()}</Text>
    </LinearGradient>
  );
}

function Range({ start, end, light = false }: { start: string; end: string; light?: boolean }) {
  const color = light ? "rgba(255,255,255,0.9)" : colors.muted;
  return (
    <View style={{ gap: 3 }}>
      <View style={styles.line}>
        <Ionicons name="play-circle-outline" size={15} color={light ? colors.orangeLight : colors.green} />
        <Text style={{ color, fontSize: 13 }}>
          Starts <Text style={{ fontWeight: "800", color: light ? "#fff" : colors.text }}>{dateOnly(start)}</Text> · {timeOnly(start)}
        </Text>
      </View>
      <View style={styles.line}>
        <Ionicons name="stop-circle-outline" size={15} color={light ? colors.orangeLight : colors.orange} />
        <Text style={{ color, fontSize: 13 }}>
          Ends <Text style={{ fontWeight: "800", color: light ? "#fff" : colors.text }}>{dateOnly(end)}</Text> · {timeOnly(end)}
        </Text>
      </View>
    </View>
  );
}

export function SpeakerStack({ speakers, size = 30 }: { speakers: Speaker[]; size?: number }) {
  if (!speakers?.length) return null;
  const shown = speakers.slice(0, 4);
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {shown.map((speaker, index) => (
        <View key={speaker.id} style={{ marginLeft: index ? -size * 0.3 : 0, borderWidth: 2, borderColor: "#fff", borderRadius: size }}>
          <Avatar id={speaker.id} name={speaker.name} hasPicture={speaker.has_image} size={size} instructor />
        </View>
      ))}
      {speakers.length > shown.length ? <Text style={{ marginLeft: 6, color: colors.muted, fontWeight: "700", fontSize: 12 }}>+{speakers.length - shown.length}</Text> : null}
    </View>
  );
}

/** The body of a contest or webinar card in a list. */
export function EventSummary({ title, start, end, categories, fallbackCategory, chips, footer, speakers, ended }: { title: string; start: string; end: string; categories?: Category[]; fallbackCategory?: string; chips: React.ReactNode; footer: React.ReactNode; speakers?: Speaker[]; ended?: boolean }) {
  return (
    <View style={styles.card}>
      <DateTile value={start} ended={ended} />
      <View style={{ flex: 1, gap: 7 }}>
        <View style={styles.chips}>{chips}</View>
        <Text style={styles.title}>{title}</Text>
        <Range start={start} end={end} />
        {categories?.length ? (
          <View style={styles.chips}>
            {categories.slice(0, 3).map((category) => (
              <CategoryChip key={category.id} name={category.name} icon={category.icon} />
            ))}
          </View>
        ) : fallbackCategory ? (
          <View style={styles.chips}>
            <CategoryChip name={fallbackCategory} />
          </View>
        ) : null}
        {speakers?.length ? (
          <View style={styles.line}>
            <SpeakerStack speakers={speakers} />
            <Text style={{ flex: 1, color: colors.muted, fontSize: 12 }} numberOfLines={1}>
              {speakers.map((speaker) => speaker.name).join(", ")}
            </Text>
          </View>
        ) : null}
        <View style={styles.footer}>{footer}</View>
      </View>
    </View>
  );
}

/** The banner at the top of a contest or webinar page. */
export function EventHero({ eyebrow, title, description, start, end, categories, fallbackCategory, chips, facts }: { eyebrow: string; title: string; description?: string; start: string; end: string; categories?: Category[]; fallbackCategory?: string; chips: React.ReactNode; facts: { icon: IconName; text: string }[] }) {
  return (
    <Hero style={{ gap: 12 }}>
      <View style={styles.chips}>{chips}</View>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.heroTitle}>{title}</Text>
      {categories?.length || fallbackCategory ? (
        <View style={styles.chips}>
          {(categories?.length ? categories : [{ id: "x", name: fallbackCategory as string, icon: undefined }]).map((category) => (
            <View key={category.id} style={styles.glass}>
              <InterestIcon name={category.icon} size={13} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>{category.name}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      <View style={styles.times}>
        <View style={styles.time}>
          <Text style={styles.timeLabel}>STARTS</Text>
          <Text style={styles.timeDate}>{dateOnly(start)}</Text>
          <Text style={styles.timeClock}>{timeOnly(start)}</Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color={colors.orangeLight} />
        <View style={styles.time}>
          <Text style={styles.timeLabel}>ENDS</Text>
          <Text style={styles.timeDate}>{dateOnly(end)}</Text>
          <Text style={styles.timeClock}>{timeOnly(end)}</Text>
        </View>
      </View>
      <View style={styles.facts}>
        {facts.map((fact) => (
          <View key={fact.text} style={styles.glass}>
            <Ionicons name={fact.icon} size={14} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>{fact.text}</Text>
          </View>
        ))}
      </View>
    </Hero>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", gap: 12 },
  tile: { width: 54, height: 60, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  tileMonth: { color: "#ffc28b", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  tileDay: { color: "#fff", fontSize: 24, fontWeight: "800", marginTop: -2 },
  chips: { flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" },
  title: { fontSize: 16, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  line: { flexDirection: "row", alignItems: "center", gap: 6 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  eyebrow: { color: colors.orangeLight, fontWeight: "800", fontSize: 12, letterSpacing: 1.2 },
  heroTitle: { color: "#fff", fontSize: 25, fontWeight: "800", letterSpacing: -0.6, lineHeight: 30 },
  desc: { color: "rgba(255,255,255,0.88)", lineHeight: 21 },
  glass: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.18)" },
  times: { flexDirection: "row", alignItems: "center", gap: 10 },
  time: { flex: 1, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: radius.md, padding: 12, gap: 1 },
  timeLabel: { color: colors.orangeLight, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  timeDate: { color: "#fff", fontSize: 15, fontWeight: "800" },
  timeClock: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  facts: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
});
