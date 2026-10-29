import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as lucideIcons from "lucide-react-native";
import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authHeaders, fileUrl } from "@/lib/api";
import { colors, gradients, radius, shadow } from "@/lib/config";
import { initials } from "@/lib/format";
import { Text, TextInput } from "./text";

export { Text, TextInput };
export type IconName = keyof typeof Ionicons.glyphMap;

/* ------------------------------------------------------------------------------------------------ brand */

/** The website's logo mark: a white "u" on a green gradient with an orange star. */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size * 0.28, alignItems: "center", justifyContent: "center", ...shadow }}>
      <Text style={{ color: "#fff", fontSize: size * 0.62, fontWeight: "800", marginTop: -size * 0.06, marginLeft: -size * 0.04 }}>u</Text>
      <Text style={{ position: "absolute", top: size * 0.04, right: size * 0.1, color: colors.orangeLight, fontSize: size * 0.28 }}>✦</Text>
    </LinearGradient>
  );
}
export function Brand({ size = 40, light = false }: { size?: number; light?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: size * 0.25 }}>
      <LogoMark size={size} />
      <Text style={{ fontSize: size * 0.7, fontWeight: "800", letterSpacing: -1, color: light ? "#fff" : colors.text }}>
        uddeepto<Text style={{ color: colors.orange }}>.</Text>
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------------------------------------ layout */

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress)
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.88, transform: [{ scale: 0.995 }] }]}>
        {children}
      </Pressable>
    );
  return <View style={[styles.card, style]}>{children}</View>;
}

/** A banner with the website's dark green gradient and the orange glow in the corner. */
export function Hero({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, style]}>
      <View style={styles.glow} pointerEvents="none" />
      {children}
    </LinearGradient>
  );
}

export function Title({ children, style }: { children: ReactNode; style?: any }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}
export function Muted({ children, style, numberOfLines }: { children: ReactNode; style?: any; numberOfLines?: number }) {
  return (
    <Text style={[styles.muted, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}
export function SectionTitle({ children, action, onAction }: { children: ReactNode; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{children}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.link}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Button({ label, onPress, kind = "primary", icon, busy, disabled, style }: { label: string; onPress: () => void; kind?: "primary" | "secondary" | "danger" | "soft"; icon?: IconName; busy?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const off = disabled || busy;
  const fg = kind === "primary" || kind === "danger" ? "#fff" : colors.green;
  const content = (
    <>
      {busy ? <ActivityIndicator color={fg} size="small" /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </>
  );
  const pressed = (state: { pressed: boolean }) => ({ opacity: off ? 0.55 : state.pressed ? 0.88 : 1 });
  if (kind === "primary")
    return (
      <Pressable onPress={onPress} disabled={off} accessibilityRole="button" style={(state) => [pressed(state), style]}>
        <LinearGradient colors={["#1f8c62", "#17684a"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.button, { borderColor: colors.green }]}>
          {content}
        </LinearGradient>
      </Pressable>
    );
  const look = kind === "danger" ? { backgroundColor: colors.red, borderColor: colors.red } : kind === "soft" ? { backgroundColor: colors.greenSoft, borderColor: colors.greenSoft } : { backgroundColor: colors.card, borderColor: colors.borderStrong };
  return (
    <Pressable onPress={onPress} disabled={off} accessibilityRole="button" style={(state) => [styles.button, look, pressed(state), style]}>
      {content}
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string; hint?: string }) {
  const { label, hint, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput placeholderTextColor="#9aa7a0" {...rest} style={[styles.input, rest.multiline && { minHeight: 96, textAlignVertical: "top" }, style]} />
      {hint ? <Muted>{hint}</Muted> : null}
    </View>
  );
}

/* ------------------------------------------------------------------------------------------------ pictures */

const memory = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
/** One download per address, however many pictures ask for it at the same moment (the same avatar on many posts). */
function fetchPicture(url: string): Promise<string> {
  const known = memory.get(url);
  if (known) return Promise.resolve(known);
  let run = inflight.get(url);
  if (!run) {
    run = (async () => {
      const file = new File(Paths.cache, `img-${key(url)}-${session}`);
      if (!file.exists) await File.downloadFileAsync(url, file, { headers: authHeaders() || {} });
      memory.set(url, file.uri);
      return file.uri;
    })().finally(() => inflight.delete(url));
    inflight.set(url, run);
  }
  return run;
}
const session = Date.now().toString(36);
const key = (value: string) => {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(36);
};

/**
 * A picture that needs the signed-in person's token. It is fetched with the token into the cache folder and then shown from
 * there, which works the same for every kind of picture the API serves (profile, instructor, cover, post).
 */
export function RemoteImage({ path, style, contentFit = "cover", fallback }: { path: string; style?: any; contentFit?: "cover" | "contain"; fallback?: ReactNode }) {
  const url = fileUrl(path);
  const [uri, setUri] = useState<string | null>(memory.get(url) || null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setFailed(false);
    if (memory.has(url)) {
      setUri(memory.get(url) as string);
      return;
    }
    setUri(null);
    fetchPicture(url)
      .then((uri) => live && setUri(uri))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [url]);

  if (failed) return <>{fallback ?? <View style={[style, { backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" }]}><Ionicons name="image-outline" size={22} color={colors.subtle} /></View>}</>;
  if (!uri) return <View style={[style, { backgroundColor: colors.surfaceMuted }]} />;
  return <Image source={{ uri }} style={style} contentFit={contentFit} transition={120} onError={() => setFailed(true)} />;
}

export function Avatar({ id, name, hasPicture, size = 40, instructor = false }: { id?: string; name?: string | null; hasPicture?: boolean; size?: number; instructor?: boolean }) {
  const letters = (
    <LinearGradient colors={["#ffe9d6", "#ffd3b0"]} style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: colors.orange, fontWeight: "800", fontSize: size * 0.38 }}>{initials(name)}</Text>
    </LinearGradient>
  );
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }}>
      {hasPicture && id ? <RemoteImage path={instructor ? `frontend/instructors/${id}/image` : `frontend/profile/${id}/picture`} style={{ width: size, height: size }} fallback={letters} /> : letters}
    </View>
  );
}

/* ------------------------------------------------------------------------------------------------ small pieces */

export function Chip({ label, tone = "green", icon }: { label: string; tone?: "green" | "orange" | "gray" | "red"; icon?: IconName }) {
  const palette = { green: [colors.greenSoft, colors.green], orange: [colors.orangeSoft, "#c9611f"], gray: ["#eef1ef", colors.muted], red: [colors.redSoft, colors.red] }[tone];
  return (
    <View style={[styles.chip, { backgroundColor: palette[0] }]}>
      {icon ? <Ionicons name={icon} size={12} color={palette[1]} /> : null}
      <Text style={{ color: palette[1], fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

/** Two or three tabs at the top of a screen (Contest | Webinar, Inbox | Community ...). */
export function TopTabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string; badge?: number }[]; value: T; onChange: (value: T) => void }) {
  return (
    <View style={styles.tabs}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable key={tab.value} onPress={() => onChange(tab.value)} accessibilityRole="tab" accessibilityState={{ selected: active }} style={{ flex: 1 }}>
            {active ? (
              <LinearGradient colors={["#1f8c62", "#17684a"]} style={styles.tab}>
                <Text style={[styles.tabText, { color: "#fff" }]}>{tab.label}</Text>
              </LinearGradient>
            ) : (
              <View style={styles.tab}>
                <Text style={styles.tabText}>{tab.label}</Text>
                {tab.badge ? (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{tab.badge > 99 ? "99+" : tab.badge}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** A row of small filter pills. */
export function Pills<T extends string>({ items, value, onChange }: { items: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return (
    <View style={styles.pills}>
      {items.map((item) => {
        const on = item.value === value;
        return (
          <Pressable key={item.value} onPress={() => onChange(item.value)} style={[styles.pill, on && { backgroundColor: colors.green, borderColor: colors.green }]}>
            <Text style={{ color: on ? "#fff" : colors.muted, fontWeight: "700", fontSize: 13 }}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function IconButton({ icon, onPress, badge, label, color = colors.text }: { icon: IconName; onPress: () => void; badge?: number; label: string; color?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={badge ? `${label}, ${badge} new` : label} hitSlop={6} style={styles.iconButton}>
      <Ionicons name={icon} size={23} color={color} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Loading({ text }: { text?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.green} />
      {text ? <Muted style={{ marginTop: 8 }}>{text}</Muted> : null}
    </View>
  );
}
export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={34} color={colors.muted} />
      <Text style={[styles.muted, { textAlign: "center", marginVertical: 8 }]}>{message}</Text>
      {onRetry ? <Button label="Try again" kind="secondary" onPress={onRetry} /> : null}
    </View>
  );
}
export function Empty({ icon = "file-tray-outline", title, text }: { icon?: IconName; title: string; text?: string }) {
  return (
    <View style={styles.center}>
      <LinearGradient colors={["#fff0e5", "#ffe3cf"]} style={styles.emptyIcon}>
        <Ionicons name={icon} size={26} color={colors.orange} />
      </LinearGradient>
      <Text style={[styles.title, { fontSize: 16, textAlign: "center" }]}>{title}</Text>
      {text ? <Text style={[styles.muted, { textAlign: "center", marginTop: 4 }]}>{text}</Text> : null}
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.track}>
      <LinearGradient colors={[colors.green, colors.orange]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fill, { width: `${Math.max(0, Math.min(100, value))}%` }]} />
    </View>
  );
}

export function Notice({ tone = "error", children }: { tone?: "error" | "success"; children: ReactNode }) {
  const error = tone === "error";
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: error ? colors.redSoft : colors.greenSoft, padding: 12, borderRadius: radius.md }}>
      <Ionicons name={error ? "alert-circle" : "checkmark-circle"} size={18} color={error ? colors.red : colors.green} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, color: error ? colors.red : colors.green, fontWeight: "600", lineHeight: 19 }}>{children}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------------------------------------ choosing */

export type Option = { value: string; label: string; hint?: string };

export function Sheet({ visible, title, onClose, children, footer }: { visible: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.grab} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.muted} />
          </Pressable>
        </View>
        {children}
        {footer}
      </View>
    </Modal>
  );
}

function OptionList({ options, selected, onPick, searchable }: { options: Option[]; selected: string[]; onPick: (value: string) => void; searchable: boolean }) {
  const [term, setTerm] = useState("");
  const shown = useMemo(() => (term.trim() ? options.filter((option) => option.label.toLowerCase().includes(term.trim().toLowerCase())) : options), [options, term]);
  return (
    <>
      {searchable ? (
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={colors.muted} />
          <TextInput value={term} onChangeText={setTerm} placeholder="Search…" placeholderTextColor="#9aa7a0" style={styles.searchInput} autoCorrect={false} />
        </View>
      ) : null}
      <FlatList
        data={shown}
        keyExtractor={(option) => option.value || "none"}
        style={{ maxHeight: 380 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Muted style={{ textAlign: "center", padding: 18 }}>Nothing matches “{term}”.</Muted>}
        renderItem={({ item }) => {
          const on = selected.includes(item.value);
          return (
            <Pressable onPress={() => onPick(item.value)} style={[styles.option, on && { backgroundColor: colors.greenSoft }]} accessibilityRole="button" accessibilityState={{ selected: on }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionText, on && { color: colors.green, fontWeight: "800" }]}>{item.label}</Text>
                {item.hint ? <Muted>{item.hint}</Muted> : null}
              </View>
              {on ? <Ionicons name="checkmark-circle" size={22} color={colors.green} /> : <Ionicons name="ellipse-outline" size={20} color={colors.borderStrong} />}
            </Pressable>
          );
        }}
      />
    </>
  );
}

/** A field that opens a list to pick one option from (instead of showing every option at once). */
export function Dropdown({ label, value, options, onChange, placeholder = "Select", compact = false, icon, searchable }: { label?: string; value: string; options: Option[]; onChange: (value: string) => void; placeholder?: string; compact?: boolean; icon?: IconName; searchable?: boolean }) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);
  return (
    <View style={{ gap: 6, flex: compact ? 1 : undefined }}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <Pressable onPress={() => setOpen(true)} style={[styles.select, compact && { minHeight: 42, paddingHorizontal: 12 }]} accessibilityRole="button" accessibilityLabel={label || placeholder}>
        {icon ? <Ionicons name={icon} size={17} color={colors.green} /> : null}
        <Text style={[styles.selectText, !current && { color: "#9aa7a0" }]} numberOfLines={1}>
          {current ? current.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      <Sheet visible={open} title={label || placeholder} onClose={() => setOpen(false)}>
        <OptionList
          options={options}
          selected={[value]}
          searchable={searchable ?? options.length > 8}
          onPick={(next) => {
            onChange(next);
            setOpen(false);
          }}
        />
      </Sheet>
    </View>
  );
}

/** Pick several options from a list; the choices show as chips under the field. */
export function MultiSelect({ label, values, options, onChange, placeholder = "Choose", max }: { label?: string; values: string[]; options: Option[]; onChange: (values: string[]) => void; placeholder?: string; max?: number }) {
  const [open, setOpen] = useState(false);
  const chosen = options.filter((option) => values.includes(option.value));
  return (
    <View style={{ gap: 8 }}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <Pressable onPress={() => setOpen(true)} style={styles.select} accessibilityRole="button" accessibilityLabel={label || placeholder}>
        <Text style={[styles.selectText, !chosen.length && { color: "#9aa7a0" }]} numberOfLines={1}>
          {chosen.length ? `${chosen.length} selected` : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      {chosen.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {chosen.map((option) => (
            <Pressable key={option.value} onPress={() => onChange(values.filter((value) => value !== option.value))} style={styles.pickedChip} accessibilityLabel={`Remove ${option.label}`}>
              <Text style={{ color: colors.green, fontWeight: "700", fontSize: 13 }}>{option.label}</Text>
              <Ionicons name="close" size={14} color={colors.green} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <Sheet visible={open} title={label || placeholder} onClose={() => setOpen(false)} footer={<Button label={`Done${chosen.length ? ` (${chosen.length})` : ""}`} onPress={() => setOpen(false)} style={{ marginTop: 10 }} />}>
        <OptionList
          options={options}
          selected={values}
          searchable={options.length > 8}
          onPick={(value) => onChange(values.includes(value) ? values.filter((item) => item !== value) : max && values.length >= max ? values : [...values, value])}
        />
      </Sheet>
    </View>
  );
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** A month and a year ("2024-03") chosen from two lists. */
export function MonthPicker({ label, value, onChange, optional = false }: { label: string; value: string; onChange: (value: string) => void; optional?: boolean }) {
  const [year, month] = value ? value.split("-") : ["", ""];
  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 70 }, (_, index) => String(now + 1 - index));
  }, []);
  const set = (nextYear: string, nextMonth: string) => onChange(nextYear && nextMonth ? `${nextYear}-${nextMonth}` : nextYear ? `${nextYear}-01` : "");
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Dropdown compact value={month} placeholder="Month" options={[...(optional ? [{ value: "", label: "—" }] : []), ...MONTHS.map((name, index) => ({ value: String(index + 1).padStart(2, "0"), label: name }))]} onChange={(next) => set(year || String(new Date().getFullYear()), next)} />
        <Dropdown compact value={year} placeholder="Year" options={[...(optional ? [{ value: "", label: "—" }] : []), ...years.map((item) => ({ value: item, label: item }))]} searchable onChange={(next) => (next ? set(next, month || "01") : onChange(""))} />
      </View>
    </View>
  );
}

/** Bottom padding that keeps a bar above the phone's navigation buttons or gesture line. */
export function useBottomInset(extra = 0) {
  return useSafeAreaInsets().bottom + extra;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 8, ...shadow },
  hero: { borderRadius: radius.xl, padding: 20, gap: 6, overflow: "hidden" },
  glow: { position: "absolute", top: -70, right: -50, width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(231,123,56,0.38)" },
  title: { fontSize: 18, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  section: { fontSize: 17, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  link: { color: colors.green, fontWeight: "700", fontSize: 13 },
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48, paddingHorizontal: 18, borderRadius: radius.md, borderWidth: 1 },
  buttonText: { fontWeight: "800", fontSize: 15 },
  inputLabel: { fontSize: 13, fontWeight: "700", color: colors.text },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: colors.text, backgroundColor: "#fff" },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  tabs: { flexDirection: "row", backgroundColor: "#e6eee9", borderRadius: 16, padding: 4, marginHorizontal: 14, marginTop: 12 },
  tab: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 12 },
  tabText: { fontWeight: "800", color: colors.muted, fontSize: 14 },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  tabBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  pills: { flexDirection: "row", gap: 8, flexWrap: "wrap", paddingHorizontal: 14, paddingTop: 10 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff" },
  iconButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 1, right: 0, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: colors.card },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  center: { alignItems: "center", justifyContent: "center", padding: 32 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  track: { height: 8, borderRadius: 4, backgroundColor: "#e3eae6", overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(10,25,18,0.5)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 8 },
  grab: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 8 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, marginBottom: 6 },
  searchInput: { flex: 1, minHeight: 44, fontSize: 15, color: colors.text },
  option: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, paddingHorizontal: 12, borderRadius: radius.md },
  optionText: { fontSize: 15, color: colors.text, fontWeight: "600" },
  select: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, backgroundColor: "#fff" },
  selectText: { flex: 1, fontSize: 15, color: colors.text },
  pickedChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.greenSoft },
});

/** A search box with the filters under it (dropdowns passed as children). */
export function FilterBar({ value, onChangeText, placeholder = "Search…", children }: { value: string; onChangeText: (text: string) => void; placeholder?: string; children?: ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 10, gap: 8 }}>
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={colors.muted} />
        <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9aa7a0" style={styles.searchInput} returnKeyType="search" autoCorrect={false} />
        {value ? (
          <Pressable onPress={() => onChangeText("")} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.subtle} />
          </Pressable>
        ) : null}
      </View>
      {children ? <View style={{ flexDirection: "row", gap: 8 }}>{children}</View> : null}
    </View>
  );
}

/** An interest's icon: the name of a Lucide icon stored with the interest ("code", "palette", "music-4" ...). */
export function InterestIcon({ name, size = 16, color = colors.green }: { name?: string | null; size?: number; color?: string }) {
  const pascal = String(name || "")
    .trim()
    .replace(/[_\s]+/g, "-")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  const Icon = (lucideIcons as Record<string, any>)[pascal] || lucideIcons.Star;
  return <Icon size={size} color={color} />;
}

/** A category chip with its icon. */
export function CategoryChip({ name, icon, tone = "green" }: { name: string; icon?: string | null; tone?: "green" | "orange" | "gray" }) {
  const palette = { green: [colors.greenSoft, colors.green], orange: [colors.orangeSoft, "#c9611f"], gray: ["#eef1ef", colors.muted] }[tone];
  return (
    <View style={[styles.chip, { backgroundColor: palette[0] }]}>
      <InterestIcon name={icon} size={13} color={palette[1]} />
      <Text style={{ color: palette[1], fontSize: 12, fontWeight: "700" }}>{name}</Text>
    </View>
  );
}
