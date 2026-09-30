"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { useUser } from "../shell";
import Markdown from "../markdown";

const NOUN = { video: "lecture video", document: "document", text: "lesson", other: "file" };
const STARTERS = {
  video: ["Summarize this lecture", "What are the key ideas?", "Quiz me on this topic"],
  document: ["Summarize this document", "Explain the hardest part simply", "Give me practice questions"],
  text: ["Summarize this lesson", "Explain it with an example", "Give me practice questions"],
  other: ["What is this file about?", "How should I use it?", "Give me practice questions"],
};

/** Compact "ask about this material" chat that sits above the material list. */
export default function MaterialAi({ courseId, material }) {
  const user = useUser();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [context, setContext] = useState("");
  const list = useRef(null);
  const input = useRef(null);
  const noun = NOUN[material.type] || "material";

  useEffect(() => {
    const element = list.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [messages, pending, open]);

  if (user.role !== "learner") return null;

  async function ask(history) {
    setPending(true);
    setError("");
    try {
      const answer = await api(`frontend/courses/${courseId}/materials/${material.id}/ai`, {
        method: "POST",
        body: { messages: history.slice(-20).map(({ role, content }) => ({ role, content })) },
      });
      setContext(answer.context);
      setMessages([...history, { role: "assistant", content: answer.reply }]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(false);
      input.current?.focus();
    }
  }

  function send(content = text) {
    const value = content.trim();
    if (!value || pending) return;
    const history = [...messages, { role: "user", content: value }];
    setMessages(history);
    setText("");
    if (input.current) input.current.style.height = "auto";
    ask(history);
  }

  if (!open)
    return (
      <button type="button" className="ai-ask" onClick={() => setOpen(true)}>
        <span className="ai-ask-icon">
          <Sparkles size={17} />
        </span>
        <span>
          Ask anything about this {noun}
          <small>AI assistant · Bangla or English</small>
        </span>
        <ChevronDown size={17} />
      </button>
    );

  return (
    <section className="ai-mini" aria-label={`Ask about this ${noun}`}>
      <header>
        <span className="ai-ask-icon">
          <Sparkles size={16} />
        </span>
        <strong>Ask about this {noun}</strong>
        <button type="button" className="ai-mini-close" aria-label="Close AI chat" onClick={() => setOpen(false)}>
          <X size={16} />
        </button>
      </header>

      <div className="ai-mini-messages" ref={list} aria-live="polite">
        {messages.length === 0 && !pending ? (
          <div className="ai-mini-empty">
            <p>Ask a question and I’ll help you understand this {noun}.</p>
            <div className="ai-mini-starters">
              {(STARTERS[material.type] || STARTERS.other).map((starter) => (
                <button key={starter} type="button" onClick={() => send(starter)}>
                  {starter}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={index} className={`ai-mini-message ${message.role}`}>
              {message.role === "assistant" ? <Markdown>{message.content}</Markdown> : <p>{message.content}</p>}
            </div>
          ))
        )}
        {pending && (
          <div className="ai-mini-message assistant">
            <span className="ai-typing" role="status" aria-label="The assistant is thinking">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
        {error && (
          <div className="ai-error" role="alert">
            <span>{error}</span>
            {messages.at(-1)?.role === "user" && (
              <button type="button" className="ai-action" onClick={() => ask(messages)} disabled={pending}>
                <RotateCcw size={13} /> Try again
              </button>
            )}
          </div>
        )}
      </div>

      {context === "metadata" && (
        <p className="ai-mini-note">I can only see this {noun}’s title and description, not its full content.</p>
      )}

      <form
        className="ai-mini-composer"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <textarea
          ref={input}
          aria-label={`Ask about this ${noun}`}
          rows={1}
          maxLength={8000}
          value={text}
          placeholder={`Ask anything about this ${noun}…`}
          onChange={(event) => {
            setText(event.target.value);
            event.target.style.height = "auto";
            event.target.style.height = `${Math.min(event.target.scrollHeight, 110)}px`;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }}
        />
        <button className="button" disabled={!text.trim() || pending} aria-label="Send question">
          <Send size={16} />
        </button>
      </form>
    </section>
  );
}
