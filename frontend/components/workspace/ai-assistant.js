"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Check, Copy, Plus, RotateCcw, Send, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useUser } from "../shell";
import { UserAvatar } from "../ui";
import Markdown from "../markdown";

const SUGGESTIONS = [
  { title: "Explain a concept", prompt: "Explain recursion to a beginner with a simple Python example." },
  { title: "Plan my learning", prompt: "Make me a 4-week study plan to learn web development from scratch, with weekly goals." },
  { title: "Solve a math problem", prompt: "Solve step by step: find the derivative of $f(x) = x^2 \\sin(x)$ and explain each rule you use." },
  { title: "Prepare for interviews", prompt: "Give me 5 common junior developer interview questions with short model answers." },
  { title: "Write better code", prompt: "What is the difference between `let`, `const` and `var` in JavaScript? Show a table." },
  { title: "বাংলায় ব্যাখ্যা", prompt: "ডাটাবেস নরমালাইজেশন কী? সহজ উদাহরণসহ বাংলায় বুঝিয়ে দাও।" },
];

const storageKey = (userId) => `uddeepto-ai-chat-${userId}`;

function CopyReply({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="ai-action"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function AiAssistant() {
  const user = useUser();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const list = useRef(null);
  const input = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(user.id)) || "[]");
      if (Array.isArray(saved)) setMessages(saved.filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string"));
    } catch {
      /* no saved chat */
    }
    setLoaded(true);
  }, [user.id]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey(user.id), JSON.stringify(messages.slice(-40)));
    } catch {
      /* storage unavailable */
    }
  }, [messages, loaded, user.id]);

  useEffect(() => {
    const element = list.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const ask = useCallback(
    async (history) => {
      setPending(true);
      setError("");
      try {
        const answer = await api("frontend/ai/chat", {
          method: "POST",
          body: { messages: history.slice(-24).map(({ role, content }) => ({ role, content })) },
        });
        setMessages([...history, { role: "assistant", content: answer.reply, truncated: answer.truncated }]);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setPending(false);
        input.current?.focus();
      }
    },
    [],
  );

  function send(content = text) {
    const value = content.trim();
    if (!value || pending) return;
    const history = [...messages, { role: "user", content: value }];
    setMessages(history);
    setText("");
    if (input.current) input.current.style.height = "auto";
    ask(history);
  }

  const empty = messages.length === 0;

  return (
    <div className="ai-page">
      <header className="ai-head">
        <span className="ai-logo">
          <Sparkles size={20} />
        </span>
        <div>
          <h1>AI Assistant</h1>
          <p>Ask anything about your courses, code, maths or career.</p>
        </div>
        <button
          type="button"
          className="button secondary"
          disabled={empty && !pending}
          onClick={() => {
            setMessages([]);
            setError("");
          }}
        >
          <Plus size={16} /> New chat
        </button>
      </header>

      <div className="ai-messages" ref={list} aria-live="polite">
        {empty && !pending ? (
          <div className="ai-welcome">
            <span className="ai-welcome-icon">
              <Bot size={34} strokeWidth={1.5} />
            </span>
            <h2>How can I help you learn today?</h2>
            <p>Pick a starting point or type your own question below.</p>
            <div className="ai-suggestions">
              {SUGGESTIONS.map((item) => (
                <button key={item.title} type="button" onClick={() => send(item.prompt)}>
                  <strong>{item.title}</strong>
                  <span>{item.prompt.replace(/\$/g, "")}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <article key={index} className={`ai-message ${message.role}`}>
              {message.role === "assistant" ? (
                <span className="ai-avatar">
                  <Bot size={18} />
                </span>
              ) : (
                <UserAvatar id={user.id} name={user.name} hasPicture={user.has_picture} size={34} />
              )}
              <div className="ai-bubble">
                {message.role === "assistant" ? (
                  <>
                    <Markdown>{message.content}</Markdown>
                    {message.truncated && <p className="ai-note">The answer was cut short. Ask me to continue.</p>}
                    <div className="ai-actions">
                      <CopyReply text={message.content} />
                    </div>
                  </>
                ) : (
                  <p className="preserve">{message.content}</p>
                )}
              </div>
            </article>
          ))
        )}
        {pending && (
          <article className="ai-message assistant">
            <span className="ai-avatar">
              <Bot size={18} />
            </span>
            <div className="ai-bubble">
              <span className="ai-typing" role="status" aria-label="The assistant is thinking">
                <i />
                <i />
                <i />
              </span>
            </div>
          </article>
        )}
        {error && (
          <div className="ai-error" role="alert">
            <span>{error}</span>
            {messages.at(-1)?.role === "user" && (
              <button type="button" className="ai-action" onClick={() => ask(messages)} disabled={pending}>
                <RotateCcw size={14} /> Try again
              </button>
            )}
          </div>
        )}
      </div>

      <form
        className="ai-composer"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <textarea
          ref={input}
          aria-label="Message the AI assistant"
          value={text}
          rows={1}
          maxLength={8000}
          placeholder="Ask a question…  (Enter to send, Shift+Enter for a new line)"
          onChange={(event) => {
            setText(event.target.value);
            event.target.style.height = "auto";
            event.target.style.height = `${Math.min(event.target.scrollHeight, 180)}px`;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }}
        />
        <button className="button" disabled={!text.trim() || pending} aria-label="Send message">
          <Send size={18} />
        </button>
      </form>
      <p className="ai-disclaimer">AI can make mistakes. Double-check important information.</p>
    </div>
  );
}
