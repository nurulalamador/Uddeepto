"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Crown, Hash, Lock, LogOut, MessageCircle, Plus, Send, Shield, SmilePlus, Trash2, Users, X } from "lucide-react";
import { api } from "@/lib/api";
import { Action, State, useResource } from "../ui";
import { useShellActions, useUser } from "../shell";
import { CategoryChips } from "./courses";

const reactionEmoji = { like: "👍", love: "❤️", celebrate: "🎉", insightful: "💡", curious: "🤔" };
const reactionLabel = { like: "Like", love: "Love", celebrate: "Celebrate", insightful: "Insightful", curious: "Curious" };
const roleLabel = { owner: "Owner", moderator: "Moderator", admin: "Admin", member: "Member" };

const time = (value) => new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
function dayLabel(value) {
  const day = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return "Today";
  if (day.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(day);
}

function Avatar({ id, name, hasPicture, size = 38 }) {
  return hasPicture ? (
    <img className="room-avatar" style={{ width: size, height: size }} src={`/api/backend/frontend/profile/${id}/picture`} alt="" />
  ) : (
    <span className="room-avatar placeholder" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function CommunityPage({ communityId }) {
  const info = useResource(`frontend/communities/${communityId}`);
  const { setDetailSubtitle } = useShellActions();
  const community = info.data;

  useEffect(() => {
    setDetailSubtitle?.(community?.name || "");
    return () => setDetailSubtitle?.("");
  }, [community?.name, setDetailSubtitle]);

  if (!community) return <State resource={info}>{null}</State>;
  if (community.membership !== "approved") return <JoinPanel community={community} reload={info.reload} />;
  return <Room community={community} reload={info.reload} />;
}

function JoinPanel({ community, reload }) {
  const pending = community.membership === "pending";
  const blocked = community.membership === "blocked";
  const declined = community.membership === "rejected";
  return (
    <div className="community-join">
      <div className="card stack">
        <div className="community-join-head">
          <span className="community-join-icon">
            <Users size={28} />
          </span>
          <div>
            <h1>{community.name}</h1>
            <p className="community-join-meta">
              {community.is_private && (
                <>
                  <Lock size={14} /> Private ·{" "}
                </>
              )}
              {Number(community.member_count)} member{Number(community.member_count) === 1 ? "" : "s"} · created by {community.creator_name}
            </p>
          </div>
        </div>
        <CategoryChips categories={community.category_details} />
        <p className="preserve">{community.description}</p>
        {blocked ? (
          <p className="notice error">You can’t join this community.</p>
        ) : declined ? (
          <p className="notice">Your request to join was declined.</p>
        ) : pending ? (
          <p className="notice">Your request is waiting for approval. You’ll get access to the channels once a moderator approves it.</p>
        ) : (
          <Action
            onClick={async () => {
              await api(`communities/${community.id}/join`, { method: "POST" });
              reload();
            }}
          >
            {community.requires_approval ? "Request to join" : "Join community"}
          </Action>
        )}
        <Link className="text-link" href="/communities">
          Back to communities
        </Link>
      </div>
    </div>
  );
}

function Room({ community, reload }) {
  const router = useRouter();
  const params = useSearchParams();
  const channelId = params.get("channel") || "";
  const channel = community.chats.find((chat) => chat.id === channelId) || null;
  const select = (id) => router.replace(`/communities/${community.id}?channel=${id}`, { scroll: false });

  return (
    <div className="community-room">
      <section className="room-main" aria-label={channel ? `#${channel.name}` : "Chat"}>
        {channel ? (
          <ChatPanel key={channel.id} community={community} channel={channel} />
        ) : (
          <div className="room-empty">
            <span className="room-empty-icon">
              <MessageCircle size={34} strokeWidth={1.5} />
            </span>
            <h2>No channel selected</h2>
            <p>Pick a channel from the sidebar to read and join the conversation.</p>
          </div>
        )}
      </section>
      <Sidebar community={community} channelId={channelId} select={select} reload={reload} />
    </div>
  );
}

function Sidebar({ community, channelId, select, reload }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const members = useResource(showMembers ? `frontend/communities/${community.id}/members` : null);

  async function addChannel(event) {
    event.preventDefault();
    setError("");
    try {
      const created = await api(`frontend/communities/${community.id}/chats`, {
        method: "POST",
        body: { name: name.trim(), description: description.trim() || undefined },
      });
      setName("");
      setDescription("");
      setAdding(false);
      reload();
      select(created.id);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <aside className="room-side" aria-label="Community sidebar">
      <div className="room-side-section room-about">
        <div className="room-about-top">
          <h1>{community.name}</h1>
          {community.role && <span className="community-tag solid">{roleLabel[community.role]}</span>}
        </div>
        <CategoryChips categories={community.category_details} limit={3} />
        {community.description && <p className="clamp-3">{community.description}</p>}
        <p className="room-count">
          <Users size={14} /> {Number(community.member_count)} member{Number(community.member_count) === 1 ? "" : "s"}
          {community.is_private && (
            <>
              <Lock size={14} /> Private
            </>
          )}
        </p>
      </div>

      <div className="room-side-section">
        <div className="room-side-heading">
          <h2>Channels</h2>
          {community.can_manage && (
            <button type="button" className="room-icon-button" aria-label="Create channel" onClick={() => setAdding((value) => !value)}>
              {adding ? <X size={16} /> : <Plus size={16} />}
            </button>
          )}
        </div>
        {adding && (
          <form className="room-add-channel" onSubmit={addChannel}>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Channel name" maxLength={150} required autoFocus />
            <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description (optional)" maxLength={500} />
            {error && <p className="inline-error">{error}</p>}
            <button className="button" disabled={!name.trim()}>
              Create channel
            </button>
          </form>
        )}
        <nav className="room-channels" aria-label="Channels">
          {community.chats.length ? (
            community.chats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                className={chat.id === channelId ? "active" : ""}
                aria-current={chat.id === channelId ? "true" : undefined}
                onClick={() => select(chat.id)}
              >
                <Hash size={16} />
                <span>{chat.name}</span>
              </button>
            ))
          ) : (
            <p className="room-muted">No channels yet.</p>
          )}
        </nav>
      </div>

      {community.can_manage && community.pending.length > 0 && (
        <div className="room-side-section">
          <div className="room-side-heading">
            <h2>Requests</h2>
            <span className="room-badge">{community.pending.length}</span>
          </div>
          <ul className="room-requests">
            {community.pending.map((member) => (
              <li key={member.member_id}>
                <span>
                  <strong>{member.name}</strong>
                  <small>@{member.username}</small>
                </span>
                {["approved", "rejected"].map((status) => (
                  <Action
                    key={status}
                    className={status === "approved" ? "room-approve" : "room-reject"}
                    aria-label={`${status === "approved" ? "Approve" : "Reject"} ${member.name}`}
                    onClick={async () => {
                      await api(`frontend/communities/${community.id}/members/${member.member_id}`, { method: "PATCH", body: { status } });
                      reload();
                    }}
                  >
                    {status === "approved" ? "Approve" : "Reject"}
                  </Action>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="room-side-section">
        <button type="button" className="room-collapse" aria-expanded={showMembers} onClick={() => setShowMembers((value) => !value)}>
          <span>
            <Users size={16} /> Members
          </span>
          <span className="room-muted">{showMembers ? "Hide" : "Show"}</span>
        </button>
        {showMembers && (
          <State resource={members}>
            <ul className="room-members">
              {(members.data || []).map((member) => (
                <li key={member.id}>
                  <Avatar id={member.id} name={member.name} hasPicture={member.has_picture} size={30} />
                  <Link href={`/profile/${member.id}`}>{member.name}</Link>
                  {member.is_owner ? <Crown size={14} className="room-role" aria-label="Owner" /> : member.is_moderator ? <Shield size={14} className="room-role" aria-label="Moderator" /> : null}
                </li>
              ))}
            </ul>
          </State>
        )}
      </div>

      {community.role !== "owner" && community.role !== "admin" && (
        <Action
          className="room-leave"
          onClick={async () => {
            if (!window.confirm(`Leave ${community.name}?`)) return;
            await api(`frontend/communities/${community.id}/membership`, { method: "DELETE" });
            router.push("/communities");
          }}
        >
          <LogOut size={15} /> Leave community
        </Action>
      )}
    </aside>
  );
}

function ChatPanel({ community, channel }) {
  const me = useUser();
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [picker, setPicker] = useState(null);
  const list = useRef(null);
  const stick = useRef(true);
  const base = `frontend/communities/${community.id}/chats/${channel.id}`;

  const load = useCallback(async () => {
    try {
      const data = await api(base);
      setMessages(data);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
      setMessages((current) => current || []);
    }
  }, [base]);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 4000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const element = list.current;
    if (element && stick.current) element.scrollTop = element.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!picker) return;
    const close = (event) => {
      if (!event.target.closest?.(".reaction-picker, .reaction-add")) setPicker(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [picker]);

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await api(base, { method: "POST", body: { content } });
      setText("");
      stick.current = true;
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  }

  async function react(message, reaction) {
    setPicker(null);
    setMessages((current) =>
      current.map((item) => {
        if (item.id !== message.id) return item;
        const existing = item.reactions.find((entry) => entry.reaction === reaction);
        let reactions;
        if (existing?.mine) {
          reactions = item.reactions
            .map((entry) => (entry.reaction === reaction ? { ...entry, count: Number(entry.count) - 1, mine: false } : entry))
            .filter((entry) => Number(entry.count) > 0);
        } else if (existing) {
          reactions = item.reactions.map((entry) => (entry.reaction === reaction ? { ...entry, count: Number(entry.count) + 1, mine: true } : entry));
        } else {
          reactions = [...item.reactions, { reaction, count: 1, mine: true }];
        }
        return { ...item, reactions };
      }),
    );
    try {
      await api(`${base}/messages/${message.id}/reaction`, { method: "PUT", body: { reaction } });
    } catch (requestError) {
      setError(requestError.message);
    }
    load();
  }

  async function remove(message) {
    if (!window.confirm("Delete this message?")) return;
    try {
      await api(`${base}/messages/${message.id}`, { method: "DELETE" });
      setMessages((current) => current.filter((item) => item.id !== message.id));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  let lastDay = "";
  let lastSender = "";
  let lastTime = 0;

  return (
    <>
      <header className="room-head">
        <span className="room-head-icon">
          <Hash size={18} />
        </span>
        <div>
          <h2>{channel.name}</h2>
          {channel.description && <p>{channel.description}</p>}
        </div>
      </header>

      <div
        className="room-messages"
        ref={list}
        onScroll={(event) => {
          const element = event.currentTarget;
          stick.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
        }}
      >
        {messages === null ? (
          <div className="loading" role="status">
            <span className="spinner" /> Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <div className="room-empty small">
            <h3>Welcome to #{channel.name}</h3>
            <p>This is the start of the channel. Say hello!</p>
          </div>
        ) : (
          messages.map((message) => {
            const day = new Date(message.created_at).toDateString();
            const stamp = new Date(message.created_at).getTime();
            const newDay = day !== lastDay;
            const grouped = !newDay && message.sender_id === lastSender && stamp - lastTime < 5 * 60 * 1000;
            lastDay = day;
            lastSender = message.sender_id;
            lastTime = stamp;
            const mine = message.sender_id === me.id;
            return (
              <div key={message.id}>
                {newDay && (
                  <div className="room-day">
                    <span>{dayLabel(message.created_at)}</span>
                  </div>
                )}
                <article className={`room-message${grouped ? " grouped" : ""}${mine ? " mine" : ""}`}>
                  <div className="room-message-gutter">
                    {grouped ? <time className="room-hover-time">{time(message.created_at)}</time> : <Avatar id={message.sender_id} name={message.sender_name} hasPicture={message.sender_has_picture} />}
                  </div>
                  <div className="room-message-body">
                    {!grouped && (
                      <header>
                        <Link href={`/profile/${message.sender_id}`}>{message.sender_name}</Link>
                        <time>{time(message.created_at)}</time>
                      </header>
                    )}
                    <p className="preserve">{message.content}</p>
                    {(message.reactions.length > 0 || picker === message.id) && (
                      <div className="reaction-row">
                        {message.reactions.map((entry) => (
                          <button
                            key={entry.reaction}
                            type="button"
                            className={`reaction-chip${entry.mine ? " mine" : ""}`}
                            aria-pressed={entry.mine}
                            title={reactionLabel[entry.reaction]}
                            onClick={() => react(message, entry.reaction)}
                          >
                            <span>{reactionEmoji[entry.reaction]}</span> {Number(entry.count)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="room-message-actions">
                    <div className="reaction-anchor">
                      <button type="button" className="reaction-add" aria-label="Add reaction" title="Add reaction" onClick={() => setPicker(picker === message.id ? null : message.id)}>
                        <SmilePlus size={16} />
                      </button>
                      {picker === message.id && (
                        <div className="reaction-picker" role="menu">
                          {Object.keys(reactionEmoji).map((reaction) => (
                            <button key={reaction} type="button" role="menuitem" title={reactionLabel[reaction]} aria-label={reactionLabel[reaction]} onClick={() => react(message, reaction)}>
                              {reactionEmoji[reaction]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {(mine || community.can_manage) && (
                      <button type="button" className="reaction-add danger" aria-label="Delete message" title="Delete message" onClick={() => remove(message)}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </article>
              </div>
            );
          })
        )}
      </div>

      {error && (
        <p className="room-error" role="alert">
          {error}
        </p>
      )}
      <form
        className="room-composer"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <textarea
          aria-label={`Message #${channel.name}`}
          value={text}
          rows={1}
          maxLength={4000}
          placeholder={`Message #${channel.name}`}
          onChange={(event) => {
            setText(event.target.value);
            event.target.style.height = "auto";
            event.target.style.height = `${Math.min(event.target.scrollHeight, 140)}px`;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }}
        />
        <button className="button" disabled={!text.trim() || sending} aria-label="Send message">
          <Send size={18} />
        </button>
      </form>
    </>
  );
}
