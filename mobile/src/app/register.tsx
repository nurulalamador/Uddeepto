import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { colors, gradients, radius, shadow } from "@/lib/config";
import { Brand, Button, Input, Notice, Text } from "@/components/ui";

const ROLES = [
  { value: "learner" as const, title: "Learn & grow", text: "Courses, contests, jobs", icon: "school-outline" as const },
  { value: "hirer" as const, title: "Hire talent", text: "Post jobs, find people", icon: "briefcase-outline" as const },
];

export default function Register() {
  const { register } = useAuth();
  const [role, setRole] = useState<"learner" | "hirer">("learner");
  const [form, setForm] = useState({ name: "", email: "", username: "", password: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit() {
    const name = form.name.trim();
    const username = form.username.trim();
    if (name.length < 2) return setError("Enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError("Enter a valid email address.");
    if (!/^[A-Za-z0-9_.-]{3,40}$/.test(username)) return setError("Username: 3-40 letters, numbers, underscore, dot or hyphen.");
    if (form.password.length < 8) return setError("Password needs at least 8 characters.");
    setBusy(true);
    setError("");
    try {
      await register({ name, email: form.email.trim(), username, password: form.password, role });
    } catch (problem: any) {
      setError(problem.message || "Could not create the account.");
      setBusy(false);
    }
  }

  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <View style={styles.glow} pointerEvents="none" />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={{ alignItems: "center" }}>
              <Brand size={44} light />
            </View>
            <View style={styles.card}>
              <Text style={styles.eyebrow}>LET’S GET STARTED</Text>
              <Text style={styles.heading}>Your next chapter.</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {ROLES.map((item) => {
                  const on = role === item.value;
                  return (
                    <Pressable key={item.value} onPress={() => setRole(item.value)} style={[styles.role, on && styles.roleOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                      <Ionicons name={item.icon} size={22} color={on ? colors.green : colors.muted} />
                      <Text style={{ fontWeight: "800", color: on ? colors.green : colors.text }}>{item.title}</Text>
                      <Text style={{ fontSize: 12, color: colors.muted }}>{item.text}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Input label="Full name" value={form.name} onChangeText={set("name")} autoComplete="name" textContentType="name" maxLength={150} />
              <Input label="Email" value={form.email} onChangeText={set("email")} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
              <Input label="Username" value={form.username} onChangeText={set("username")} autoCapitalize="none" autoCorrect={false} autoComplete="username-new" maxLength={40} />
              <View>
                <Input label="Password" value={form.password} onChangeText={set("password")} secureTextEntry={!show} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" maxLength={72} hint="At least 8 characters" />
                <Pressable onPress={() => setShow((value) => !value)} hitSlop={10} style={styles.eye} accessibilityLabel={show ? "Hide password" : "Show password"}>
                  <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} />
                </Pressable>
              </View>
              {error ? <Notice>{error}</Notice> : null}
              <Button label="Create account" icon="arrow-forward" onPress={submit} busy={busy} />
              <View style={styles.switch}>
                <Text style={styles.note}>Already a member?</Text>
                <Link href="/login" style={styles.link}>
                  Sign in
                </Link>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  glow: { position: "absolute", top: -90, right: -70, width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(231,123,56,0.35)" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 20, gap: 20 },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: 22, gap: 14, ...shadow },
  eyebrow: { color: colors.orange, fontWeight: "800", fontSize: 12, letterSpacing: 1.2 },
  heading: { fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.8, marginTop: -8 },
  role: { flex: 1, gap: 3, padding: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: "#fff" },
  roleOn: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  eye: { position: "absolute", right: 14, top: 38 },
  switch: { flexDirection: "row", justifyContent: "center", gap: 6 },
  note: { color: colors.muted, fontSize: 14 },
  link: { color: colors.green, fontWeight: "800", fontSize: 14 },
});
