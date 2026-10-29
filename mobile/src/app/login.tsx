import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ADMIN_MESSAGE, useAuth } from "@/lib/auth";
import { colors, gradients, radius, shadow } from "@/lib/config";
import { Brand, Button, Input, Notice, Text } from "@/components/ui";

export default function Login() {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!identifier.trim() || !password) return setError("Enter your username or email and your password.");
    setBusy(true);
    setError("");
    try {
      await signIn(identifier, password);
    } catch (problem: any) {
      // An administrator was already told with an alert.
      if (problem.message !== ADMIN_MESSAGE) setError(problem.message || "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <View style={styles.glow} pointerEvents="none" />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.brand}>
              <Brand size={52} light />
              <Text style={styles.tag}>Your next chapter starts here.</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.eyebrow}>GOOD TO SEE YOU AGAIN</Text>
              <Text style={styles.heading}>Welcome back.</Text>
              <Input label="Username or email" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" returnKeyType="next" />
              <View>
                <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry={!show} autoCapitalize="none" autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
                <Pressable onPress={() => setShow((value) => !value)} hitSlop={10} style={styles.eye} accessibilityLabel={show ? "Hide password" : "Show password"}>
                  <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} />
                </Pressable>
              </View>
              {error ? <Notice>{error}</Notice> : null}
              <Button label="Sign in" icon="arrow-forward" onPress={submit} busy={busy} />
              <View style={styles.switch}>
                <Text style={styles.note}>New to Uddeepto?</Text>
                <Link href="/register" style={styles.link}>
                  Create an account
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
  scroll: { flexGrow: 1, justifyContent: "center", padding: 20, gap: 26 },
  brand: { alignItems: "center", gap: 10 },
  tag: { color: "rgba(255,255,255,0.82)", fontWeight: "600", fontSize: 15 },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: 22, gap: 14, ...shadow },
  eyebrow: { color: colors.orange, fontWeight: "800", fontSize: 12, letterSpacing: 1.2 },
  heading: { fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.8, marginTop: -8 },
  eye: { position: "absolute", right: 14, top: 38 },
  switch: { flexDirection: "row", justifyContent: "center", gap: 6 },
  note: { color: colors.muted, fontSize: 14 },
  link: { color: colors.green, fontWeight: "800", fontSize: 14 },
});
