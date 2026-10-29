import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { api, authHeaders, fileUrl } from "@/lib/api";
import { colors, radius } from "@/lib/config";
import { Button, Notice, Text } from "./ui";

const STEPS = 3;
const titles: Record<number, string> = { 1: "Quick check · 1 of 3", 2: "Quick check · 2 of 3", 3: "Final check" };
const rewindNote: Record<number, string> = { 1: "Watch the first part again from the start", 2: "Watch the second part again", 3: "Watch the last part again" };

type Question = { id: string; question: string; options: string[] };
type Result = { passed: boolean; completed?: boolean; correct: number; total: number; needed: number; results?: boolean[]; review?: { correct_index: number; explanation?: string }[] };
type Panel = { checkpoint: number; state: "loading" | "ready" | "submitting" | "result" | "error"; questions?: Question[]; answers?: (number | null)[]; result?: Result; message?: string };

/**
 * A lecture video that stops at 1/3 and 2/3 of its length, and again at the end, to ask a few questions.
 * Passing the last check completes the material; the server decides what counts, this screen only asks and shows.
 */
export function QuizVideo({ courseId, materialId, path, passedAlready, onViewed }: { courseId: string; materialId: string; path: string; passedAlready: number[]; onViewed: () => void }) {
  const base = `frontend/courses/${courseId}/materials/${materialId}/quiz`;
  const player = useVideoPlayer({ uri: fileUrl(path), headers: authHeaders() }, (instance) => {
    instance.timeUpdateEventInterval = 0.4;
  });
  const [passed, setPassed] = useState<number[]>(passedAlready);
  const [panel, setPanel] = useState<Panel | null>(null);
  const passedRef = useRef(passed);
  const panelRef = useRef<Panel | null>(null);
  const skipRef = useRef(false);
  const warmed = useRef(false);
  passedRef.current = passed;
  panelRef.current = panel;

  const open = useCallback(
    async (checkpoint: number) => {
      if (panelRef.current) return;
      player.pause();
      setPanel({ checkpoint, state: "loading" });
      try {
        const data = await api<{ available: boolean; passed?: number[]; questions: Question[] }>(`${base}/${checkpoint}`);
        if (!data.available) {
          // No questions could be written right now, so the learner is not held back.
          skipRef.current = true;
          setPanel(null);
          if (checkpoint === STEPS) onViewed();
          else player.play();
          return;
        }
        if (data.passed) setPassed(data.passed);
        setPanel({ checkpoint, state: "ready", questions: data.questions, answers: data.questions.map(() => null) });
      } catch (problem: any) {
        setPanel({ checkpoint, state: "error", message: problem.message });
      }
    },
    [base, onViewed, player],
  );

  const reached = useCallback(
    (time: number) => {
      if (skipRef.current || !player.duration) return 0;
      for (const checkpoint of [1, 2]) if (!passedRef.current.includes(checkpoint) && time >= (player.duration * checkpoint) / STEPS) return checkpoint;
      return 0;
    },
    [player],
  );

  useEffect(() => {
    const progress = player.addListener("timeUpdate", ({ currentTime }) => {
      const checkpoint = reached(currentTime);
      if (!checkpoint || panelRef.current) return;
      player.pause();
      player.currentTime = Math.max(0, (player.duration * checkpoint) / STEPS - 0.05);
      open(checkpoint);
    });
    const playing = player.addListener("playingChange", ({ isPlaying }) => {
      if (isPlaying && !warmed.current) {
        warmed.current = true;
        // Starting playback is a good moment to have the questions written, so they are ready by the first check-point.
        api(`${base}/1`).catch(() => {});
      }
    });
    const ended = player.addListener("playToEnd", () => {
      if (skipRef.current) return onViewed();
      const checkpoint = reached(player.duration) || (passedRef.current.includes(STEPS) ? 0 : STEPS);
      if (checkpoint) open(checkpoint);
    });
    return () => {
      progress.remove();
      playing.remove();
      ended.remove();
    };
  }, [player, reached, open, base, onViewed]);

  async function submit() {
    const current = panelRef.current;
    if (!current?.answers) return;
    setPanel({ ...current, state: "submitting" });
    try {
      const result = await api<Result>(`${base}/${current.checkpoint}`, { method: "POST", body: { answers: current.answers } });
      if (result.passed) setPassed((value) => [...new Set([...value, current.checkpoint])]);
      setPanel({ ...current, state: "result", result });
      if (result.completed) onViewed();
    } catch (problem: any) {
      setPanel({ ...current, state: "ready", message: problem.message });
    }
  }
  function carryOn() {
    const done = panelRef.current?.checkpoint;
    setPanel(null);
    if (done && done < STEPS) player.play();
  }
  function watchAgain() {
    const current = panelRef.current;
    setPanel(null);
    if (!current) return;
    player.currentTime = (player.duration * (current.checkpoint - 1)) / STEPS;
    player.play();
  }

  const current = panel;
  const result = current?.result;
  const answered = current?.answers?.filter((answer) => answer !== null).length || 0;

  return (
    <View>
      <View style={styles.box}>
        <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls contentFit="contain" fullscreenOptions={{ enable: false }} />
      </View>
      <Text style={styles.hint}>Questions appear at 1/3, 2/3 and the end of the video. Pass them to complete the lesson.</Text>

      <Modal visible={Boolean(current)} animationType="slide" onRequestClose={() => {}} statusBarTranslucent navigationBarTranslucent>
        <View style={styles.modal}>
          {current ? (
            <>
              <View style={styles.head}>
                <Ionicons name="list-circle-outline" size={22} color={colors.green} />
                <Text style={styles.headTitle}>{titles[current.checkpoint]}</Text>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  {[1, 2, 3].map((step) => (
                    <View key={step} style={[styles.dot, passed.includes(step) && { backgroundColor: colors.green }, step === current.checkpoint && { borderColor: colors.orange }]} />
                  ))}
                </View>
              </View>

              {current.state === "loading" ? (
                <View style={styles.center}>
                  <Text style={{ color: colors.muted }}>Preparing your questions…</Text>
                </View>
              ) : current.state === "error" ? (
                <View style={styles.center}>
                  <Notice>{current.message || "Could not load the questions."}</Notice>
                  <Button label="Try again" kind="secondary" onPress={() => { setPanel(null); setTimeout(() => open(current.checkpoint), 0); }} style={{ marginTop: 12 }} />
                  <Button label="Back to the video" kind="soft" onPress={() => { setPanel(null); if (current.checkpoint < STEPS) player.currentTime = Math.max(0, (player.duration * (current.checkpoint - 1)) / STEPS); }} style={{ marginTop: 8 }} />
                </View>
              ) : (
                <>
                  <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
                    {current.questions?.map((item, index) => {
                      const graded = result?.results?.[index];
                      const review = result?.review?.[index];
                      return (
                        <View key={item.id} style={[styles.question, graded === true && { borderColor: colors.green }, graded === false && { borderColor: colors.red }]}>
                          <Text style={styles.qText}>
                            {index + 1}. {item.question}
                          </Text>
                          {item.options.map((option, choice) => {
                            const chosen = current.answers?.[index] === choice;
                            const correct = review?.correct_index === choice;
                            return (
                              <Pressable
                                key={choice}
                                disabled={current.state !== "ready"}
                                onPress={() => setPanel((value) => (value ? { ...value, answers: value.answers?.map((answer, position) => (position === index ? choice : answer)) } : value))}
                                style={[styles.option, chosen && { borderColor: colors.green, backgroundColor: colors.greenSoft }, correct && { borderColor: colors.green }, graded === false && chosen && { borderColor: colors.red, backgroundColor: colors.redSoft }]}
                              >
                                <Text style={styles.key}>{String.fromCharCode(65 + choice)}</Text>
                                <Text style={{ flex: 1, color: colors.text }}>{option}</Text>
                                {correct ? <Ionicons name="checkmark-circle" size={20} color={colors.green} /> : chosen && graded === false ? <Ionicons name="close-circle" size={20} color={colors.red} /> : null}
                              </Pressable>
                            );
                          })}
                          {graded === true ? <Text style={{ color: colors.green, fontWeight: "700" }}>Correct{review?.explanation ? ` - ${review.explanation}` : ""}</Text> : null}
                          {graded === false ? <Text style={{ color: colors.red, fontWeight: "700" }}>Not quite</Text> : null}
                        </View>
                      );
                    })}
                    {current.message ? <Notice>{current.message}</Notice> : null}
                  </ScrollView>
                  <View style={styles.foot}>
                    {current.state === "result" && result ? (
                      <>
                        <Notice tone={result.passed ? "success" : "error"}>
                          {result.correct} of {result.total} correct.{" "}
                          {result.passed ? (result.completed ? "Lesson completed - well done!" : "You can keep watching.") : `You need at least ${result.needed} to continue. ${rewindNote[current.checkpoint]} and try again.`}
                        </Notice>
                        {result.passed ? <Button label={result.completed ? "Done" : "Continue watching"} icon="play" onPress={carryOn} /> : <Button label="Watch again" icon="play-back" onPress={watchAgain} />}
                      </>
                    ) : (
                      <>
                        <Text style={{ color: colors.muted, textAlign: "center" }}>
                          {answered} of {current.questions?.length || 0} answered
                        </Text>
                        <Button label="Submit answers" icon="checkmark" onPress={submit} busy={current.state === "submitting"} disabled={answered < (current.questions?.length || 1)} />
                      </>
                    )}
                  </View>
                </>
              )}
            </>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000", borderRadius: 14, overflow: "hidden" },
  hint: { color: colors.muted, fontSize: 12, marginTop: 6 },
  modal: { flex: 1, backgroundColor: colors.bg, paddingTop: 36 },
  head: { flexDirection: "row", alignItems: "center", gap: 8, padding: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  headTitle: { flex: 1, fontWeight: "800", fontSize: 17, color: colors.text },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border, borderWidth: 2, borderColor: "transparent" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  question: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, gap: 8, borderWidth: 1.5, borderColor: colors.border },
  qText: { fontWeight: "800", color: colors.text, fontSize: 15, lineHeight: 21 },
  option: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: "#fff" },
  key: { width: 24, height: 24, borderRadius: 12, textAlign: "center", lineHeight: 24, backgroundColor: colors.surfaceMuted, fontWeight: "800", color: colors.muted, overflow: "hidden" },
  foot: { padding: 14, gap: 10, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
});
