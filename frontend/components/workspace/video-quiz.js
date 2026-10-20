"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CircleAlert, RotateCcw, Rewind, X } from "lucide-react";
import { api } from "@/lib/api";
import VideoPlayer from "./video-player";

const STEPS = 3;
const titles = { 1: "Quick check · 1 of 3", 2: "Quick check · 2 of 3", 3: "Final check" };
const rewindNote = {
  1: "Watch the first part again from the start",
  2: "Watch the second part again",
  3: "Watch the last part again",
};

/**
 * A lecture video that stops at 1/3 and 2/3 of its length, and again at the end, to ask a few questions.
 * The learner can only go on after answering enough of them correctly, and passing the last check
 * completes the material. After a failed check the video goes back to the start of the part the questions
 * were about. The server decides what counts: this component only asks and shows.
 */
export default function QuizVideo({ courseId, material, file, quiz, onViewed }) {
  const video = useRef(null);
  const [passed, setPassed] = useState(quiz.passed || []);
  const [panel, setPanel] = useState(null); // { checkpoint, state: loading|ready|error|submitting|result, ... }
  const [skip, setSkip] = useState(false); // the server could not write questions: play without check-points
  const passedRef = useRef(passed);
  const panelRef = useRef(null);
  const skipRef = useRef(false);
  const warmed = useRef(false);
  const base = `frontend/courses/${courseId}/materials/${material.id}/quiz`;
  passedRef.current = passed;
  panelRef.current = panel;

  /** The first check-point (1 or 2) the learner has not passed yet; the video cannot be played past it. */
  const nextGate = skip ? 0 : [1, 2].find((checkpoint) => !passed.includes(checkpoint)) || 0;

  async function open(checkpoint) {
    if (panelRef.current) return;
    const element = video.current;
    element?.pause();
    if (document.fullscreenElement && !document.fullscreenElement.contains(element)) document.exitFullscreen?.().catch(() => {});
    setPanel({ checkpoint, state: "loading" });
    try {
      const data = await api(`${base}/${checkpoint}`);
      if (!data.available) {
        // No questions could be written right now, so do not hold the learner back.
        skipRef.current = true;
        setSkip(true);
        setPanel(null);
        if (checkpoint === STEPS) onViewed();
        else element?.play().catch(() => {});
        return;
      }
      setPassed(data.passed || []);
      setPanel({ checkpoint, state: "ready", questions: data.questions, answers: data.questions.map(() => null) });
    } catch (error) {
      setPanel({ checkpoint, state: "error", message: error.message });
    }
  }

  /** The first check-point the video has reached but the learner has not passed yet. */
  function reached() {
    const element = video.current;
    if (!element || !element.duration || skipRef.current) return 0;
    for (const checkpoint of [1, 2]) {
      if (!passedRef.current.includes(checkpoint) && element.currentTime >= (element.duration * checkpoint) / STEPS) return checkpoint;
    }
    return 0;
  }

  function guard() {
    if (panelRef.current) return;
    const checkpoint = reached();
    if (!checkpoint) return;
    const element = video.current;
    // Park the video exactly at the check-point, so nothing can carry it further.
    element.currentTime = Math.max(0, (element.duration * checkpoint) / STEPS - 0.05);
    open(checkpoint);
  }

  function warmUp() {
    // Starting playback is a good moment to have the questions written, so they are ready by the first check-point.
    if (warmed.current) return;
    warmed.current = true;
    api(`${base}/1`).catch(() => {});
  }

  function ended() {
    if (skipRef.current) {
      // Questions are unavailable: asking for the last check-point is how the server completes the lesson.
      api(`${base}/${STEPS}`).then(onViewed).catch(() => {});
      return;
    }
    const checkpoint = reached() || (passedRef.current.includes(STEPS) ? 0 : STEPS);
    if (checkpoint) open(checkpoint);
  }

  async function submit() {
    const current = panelRef.current;
    setPanel({ ...current, state: "submitting" });
    try {
      const result = await api(`${base}/${current.checkpoint}`, { method: "POST", body: { answers: current.answers } });
      if (result.passed) setPassed((value) => [...new Set([...value, current.checkpoint])]);
      setPanel({ ...current, state: "result", result });
      if (result.completed) onViewed();
    } catch (error) {
      setPanel({ ...current, state: "ready", message: error.message });
    }
  }

  function carryOn() {
    const done = panelRef.current?.checkpoint;
    setPanel(null);
    if (done && done < STEPS) video.current?.play().catch(() => {});
  }

  /** After a failed check: back to where the part those questions covered begins, and play it again. */
  function watchAgain() {
    const current = panelRef.current;
    const element = video.current;
    setPanel(null);
    if (!element || !current) return;
    element.currentTime = (element.duration * (current.checkpoint - 1)) / STEPS;
    element.play().catch(() => {});
  }

  useEffect(() => {
    const element = video.current;
    return () => element?.pause();
  }, []);

  const current = panel;
  const markers = skip ? [] : [1, 2].map((checkpoint) => ({ at: checkpoint / STEPS, done: passed.includes(checkpoint) }));
  return (
    <div className="quiz-video">
      <VideoPlayer
        src={file.url}
        videoRef={video}
        label={material.name}
        limit={nextGate ? nextGate / STEPS : null}
        markers={markers}
        onPlay={warmUp}
        onTimeUpdate={guard}
        onSeeking={guard}
        onEnded={ended}
      >
        {current && (
          <div className="quiz-panel" role="dialog" aria-label={titles[current.checkpoint]}>
            <header>
              <strong>{titles[current.checkpoint]}</strong>
              <small>
                {current.checkpoint === STEPS
                  ? "Answer at least 2 of 3 correctly to complete this lesson."
                  : "Answer at least 2 of 3 correctly to keep watching."}
              </small>
            </header>

            {current.state === "loading" && (
              <div className="loading" role="status">
                <span className="spinner" /> Preparing your questions…
              </div>
            )}

            {current.state === "error" && (
              <div className="quiz-body">
                <p className="notice error" role="alert">
                  <CircleAlert size={16} /> {current.message}
                </p>
                <div className="quiz-actions">
                  <button type="button" className="button" onClick={() => { setPanel(null); open(current.checkpoint); }}>
                    <RotateCcw size={16} /> Try again
                  </button>
                </div>
              </div>
            )}

            {["ready", "submitting", "result"].includes(current.state) && (
              <div className="quiz-body">
                {current.questions.map((item, index) => {
                  const graded = current.result?.results?.[index];
                  const review = current.result?.review?.[index];
                  return (
                    <fieldset key={item.id} className={`quiz-question${graded === true ? " right" : graded === false ? " wrong" : ""}`} disabled={current.state !== "ready"}>
                      <legend>
                        {index + 1}. {item.question}
                      </legend>
                      {item.options.map((option, choice) => (
                        <label key={choice} className={`quiz-option${current.answers[index] === choice ? " chosen" : ""}${review && review.correct_index === choice ? " correct" : ""}`}>
                          <input
                            type="radio"
                            name={`q-${item.id}`}
                            checked={current.answers[index] === choice}
                            onChange={() => setPanel((value) => ({ ...value, answers: value.answers.map((answer, position) => (position === index ? choice : answer)) }))}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                      {graded === true && <small className="quiz-feedback right"><Check size={14} /> Correct{review?.explanation ? ` - ${review.explanation}` : ""}</small>}
                      {graded === false && <small className="quiz-feedback wrong"><X size={14} /> Not quite</small>}
                    </fieldset>
                  );
                })}

                {current.message && (
                  <p className="notice error" role="alert">
                    <CircleAlert size={16} /> {current.message}
                  </p>
                )}

                {current.state !== "result" && (
                  <div className="quiz-actions">
                    <button type="button" className="button" disabled={current.state === "submitting" || current.answers.some((answer) => answer === null)} onClick={submit}>
                      {current.state === "submitting" ? "Checking…" : "Submit answers"}
                    </button>
                  </div>
                )}

                {current.state === "result" && (
                  <div className="quiz-actions">
                    <p className={`quiz-score ${current.result.passed ? "right" : "wrong"}`} role="status">
                      {current.result.correct} of {current.result.total} correct.{" "}
                      {current.result.passed
                        ? current.result.completed
                          ? "Lesson completed - well done!"
                          : "You can keep watching."
                        : `You need at least ${current.result.needed} to continue. ${rewindNote[current.checkpoint]} and try again.`}
                    </p>
                    {current.result.passed ? (
                      <button type="button" className="button" onClick={carryOn}>
                        {current.result.completed ? "Done" : "Continue watching"}
                      </button>
                    ) : (
                      <button type="button" className="button" onClick={watchAgain}>
                        <Rewind size={16} /> Watch again
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </VideoPlayer>
      {!current && !passed.includes(STEPS) && !skip && (
        <p className="quiz-hint">
          Questions will appear a third of the way through, two thirds of the way through and at the end. Passing the final check completes this lesson.
        </p>
      )}
    </div>
  );
}
