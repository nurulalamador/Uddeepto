"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, LogOut, Plus, RotateCcw, Search, Send, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { InterestIcon, useResource } from "./ui";
import Markdown from "./markdown";

const STARTERS = ["I’m new here — where should I start?", "I want a job in tech", "I love creative work"];

/** Interests found in an AI reply (by exact name) that the person has not picked yet. */
function mentioned(text, categories, selected) {
  const lower = text.toLowerCase();
  return categories.filter((item) => !selected.includes(String(item.id)) && lower.includes(item.name.toLowerCase()));
}

function AiGuide({ categories, selected, onAdd }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const list = useRef(null);
  const input = useRef(null);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function ask(history) {
    setPending(true);
    setError("");
    try {
      const answer = await api("frontend/ai/interests", { method: "POST", body: { messages: history.slice(-20).map(({ role, content }) => ({ role, content })) } });
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

  return (
    <section className="ig-ai" aria-label="AI Assistant">
      <header>
        <span className="ai-ask-icon">
          <Sparkles size={17} />
        </span>
        <div>
          <h2>Confused about which interest to choose?</h2>
          <p>Discuss with our AI Assistant — it will suggest interests that fit you.</p>
        </div>
      </header>

      <div className="ig-ai-messages" ref={list} aria-live="polite">
        {messages.length === 0 && !pending ? (
          <div className="ig-ai-empty">
            <span className="ai-welcome-icon">
              <Bot size={30} strokeWidth={1.5} />
            </span>
            <p>Tell me what you enjoy, what you want to learn or what job you’re aiming for.</p>
            <div className="ai-mini-starters">
              {STARTERS.map((starter) => (
                <button key={starter} type="button" onClick={() => send(starter)}>
                  {starter}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => {
            const picks = message.role === "assistant" ? mentioned(message.content, categories, selected) : [];
            return (
              <div key={index} className={`ai-mini-message ${message.role}`}>
                {message.role === "assistant" ? (
                  <>
                    <Markdown>{message.content}</Markdown>
                    {picks.length > 0 && (
                      <div className="ig-picks">
                        {picks.map((item) => (
                          <button key={item.id} type="button" onClick={() => onAdd(String(item.id))}>
                            <Plus size={13} /> {item.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p>{message.content}</p>
                )}
              </div>
            );
          })
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

      <form
        className="ai-mini-composer"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <textarea
          ref={input}
          aria-label="Ask the AI Assistant about interests"
          rows={1}
          maxLength={2000}
          value={text}
          placeholder="Ask about interests…"
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
        <button className="button" disabled={!text.trim() || pending} aria-label="Send">
          <Send size={16} />
        </button>
      </form>
    </section>
  );
}

/** Blocks the workspace until the person has chosen at least one interest. */
export default function InterestGate({ role }) {
  const router = useRouter();
  const dialog = useRef(null);
  const categories = useResource("users/interests");
  const [selected, setSelected] = useState([]);
  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element || done) return;
    if (!element.open) element.showModal();
    return () => element.close();
  }, [done]);

  const items = categories.data || [];
  const visible = useMemo(() => items.filter((item) => item.name.toLowerCase().includes(term.trim().toLowerCase())), [items, term]);
  const toggle = (id) => setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  const add = (id) => setSelected((current) => (current.includes(id) ? current : [...current, id]));

  async function save() {
    setBusy(true);
    setError("");
    try {
      await api("frontend/profile/interests", { method: "PUT", body: { interest_ids: selected } });
      setDone(true);
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  if (done) return null;
  return (
    <dialog
      ref={dialog}
      className="interest-gate"
      aria-labelledby="ig-title"
      onCancel={(event) => event.preventDefault()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="ig-layout">
        <section className="ig-choose">
          <header>
            <p className="ld-eyebrow">WELCOME TO UDDEEPTO</p>
            <h1 id="ig-title">Choose your interest</h1>
            <p>
              Pick one or more topics you care about. We use them to {role === "hirer" ? "personalise your profile and suggestions" : "recommend courses, contests, webinars and communities"}. You can change them anytime from your profile.
            </p>
          </header>

          <div className="search-box ig-search">
            <Search size={18} />
            <input aria-label="Search interests" placeholder="Search interests…" value={term} onChange={(event) => setTerm(event.target.value)} />
          </div>

          <div className="ig-grid" role="group" aria-label="Interests">
            {categories.loading && !items.length ? (
              <p className="ld-muted">
                <span className="spinner" /> Loading interests…
              </p>
            ) : categories.error ? (
              <p className="notice error">
                {categories.error} <button type="button" onClick={categories.reload}>Try again</button>
              </p>
            ) : visible.length ? (
              visible.map((item) => {
                const on = selected.includes(String(item.id));
                return (
                  <button key={item.id} type="button" className={`ig-option${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggle(String(item.id))}>
                    <span className="ig-option-icon">
                      <InterestIcon iconName={item.icon} size={20} />
                    </span>
                    <span className="ig-option-name">{item.name}</span>
                    <span className="ig-check" aria-hidden="true">
                      <Check size={14} />
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="ld-muted">No interests match “{term}”.</p>
            )}
          </div>

          <footer>
            {error && (
              <p role="alert" className="notice error">
                {error}
              </p>
            )}
            <div className="ig-actions">
              <button
                type="button"
                className="ig-signout"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  window.location.assign("/login");
                }}
              >
                <LogOut size={15} /> Sign out
              </button>
              <span className="ig-count">{selected.length ? `${selected.length} selected` : "Select at least one"}</span>
              <button type="button" className="button" disabled={!selected.length || busy} onClick={save}>
                {busy ? "Saving…" : "Continue"}
              </button>
            </div>
          </footer>
        </section>

        <AiGuide categories={items} selected={selected} onAdd={add} />
      </div>
    </dialog>
  );
}
