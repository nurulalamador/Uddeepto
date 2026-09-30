"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  Check,
  Copy,
  Edit3,
  GraduationCap,
  Lock,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { Empty, Heading, InterestIcon, Modal, State, useResource } from "../ui";
import { useUser } from "../shell";
import { EditProfileForm, EducationForm, ExperienceForm } from "./profile-forms";

const monthFormat = new Intl.DateTimeFormat("en", { month: "short", year: "numeric" });
const dayFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });
const asUtc = (value) => new Date(`${String(value).slice(0, 10)}T00:00:00Z`);

function formatRange(start, end) {
  const from = asUtc(start);
  const to = end ? asUtc(end) : new Date();
  const months = Math.max(1, (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth()) + (end ? 1 : 0));
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const length = [years ? `${years} yr${years > 1 ? "s" : ""}` : "", rest ? `${rest} mo${rest > 1 ? "s" : ""}` : ""].filter(Boolean).join(" ");
  return `${monthFormat.format(from)} – ${end ? monthFormat.format(asUtc(end)) : "Present"}${length ? ` · ${length}` : ""}`;
}

function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="pf-copy"
      aria-label={label}
      title={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

function Section({ title, icon: Icon, action, children }) {
  return (
    <section className="pf-section">
      <header>
        <h2>
          {Icon && <Icon size={19} />} {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function Timeline({ items, isSelf, onEdit, onDelete, renderMeta }) {
  return (
    <ol className="pf-timeline">
      {items.map((item) => (
        <li key={item.id}>
          <span className="pf-tl-dot" aria-hidden="true" />
          <div className="pf-tl-card">
            <div className="pf-tl-top">
              <h3>{item.title || item.institution}</h3>
              {isSelf && (
                <span className="pf-tl-actions">
                  <button type="button" aria-label="Edit" title="Edit" onClick={() => onEdit(item)}>
                    <Edit3 size={15} />
                  </button>
                  <button type="button" className="danger" aria-label="Delete" title="Delete" onClick={() => onDelete(item)}>
                    <Trash2 size={15} />
                  </button>
                </span>
              )}
            </div>
            {renderMeta(item)}
            <p className="pf-tl-date">
              <CalendarDays size={14} /> {formatRange(item.start_date, item.end_date)}
            </p>
            {item.category_name && (
              <span className="category-chip">
                <InterestIcon iconName={item.category_icon} size={13} />
                {item.category_name}
              </span>
            )}
            {item.description && <p className="pf-tl-text preserve">{item.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function ProfilePage({ refId }) {
  const me = useUser();
  const router = useRouter();
  const params = useSearchParams();
  const target = refId || params.get("user") || me.uddeepto_id || me.id;
  const resource = useResource(`frontend/profile/${target}`);
  const profile = resource.data;
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    if (profile?.uddeepto_id && window.location.pathname + window.location.search !== `/profile/${profile.uddeepto_id}`) {
      router.replace(`/profile/${profile.uddeepto_id}`);
    }
  }, [profile?.uddeepto_id, router]);

  const done = () => {
    setDialog(null);
    resource.reload();
  };

  if (!profile) return <State resource={resource}>{null}</State>;

  const isSelf = profile.is_self;
  const personal = profile.personal;
  const profileUrl = typeof window === "undefined" ? "" : `${window.location.origin}/profile/${profile.uddeepto_id}`;

  return (
    <div className="pf">
      {me.role !== "learner" && (
        <Heading eyebrow="PEOPLE BEHIND THE POSSIBILITIES" title="Profile" description="Interests, work and story." />
      )}

      <section className="pf-hero">
        <div className="pf-cover">
          {profile.has_cover_image ? <img src={`/api/backend/frontend/profile/${profile.id}/cover`} alt="" /> : <span aria-hidden="true" />}
        </div>
        <div className="pf-head">
          <div className="pf-avatar">
            {profile.has_picture ? <img src={`/api/backend/frontend/profile/${profile.id}/picture`} alt={profile.name} /> : <span>{profile.name?.[0]?.toUpperCase()}</span>}
          </div>
          <div className="pf-identity">
            <h1>{profile.name}</h1>
            {profile.headline && <p className="pf-headline">{profile.headline}</p>}
            <p className="pf-meta">
              <span>@{profile.username}</span>
              <span className="pf-role">{profile.role}</span>
              <span>Joined {monthFormat.format(new Date(profile.created_at))}</span>
            </p>
          </div>
          <div className="pf-actions">
            {isSelf && (
              <button type="button" className="button" onClick={() => setDialog({ type: "profile" })}>
                <Edit3 size={16} /> Edit profile
              </button>
            )}
            {!isSelf && me.role !== "admin" && (
              <Link className="button" href={`/messages?with=${profile.id}`}>
                <MessageCircle size={16} /> Send message
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="pf-body">
        <div className="pf-main">
          <Section title="About">
            {profile.bio ? (
              <p className="preserve pf-about">{profile.bio}</p>
            ) : (
              <p className="pf-empty">{isSelf ? "Add a short bio so people know who you are." : "No bio yet."}</p>
            )}
          </Section>

          <Section
            title="Experience"
            icon={Briefcase}
            action={
              isSelf && (
                <button type="button" className="pf-add" onClick={() => setDialog({ type: "experience" })}>
                  <Plus size={16} /> Add
                </button>
              )
            }
          >
            {profile.experience.length ? (
              <Timeline
                items={profile.experience}
                isSelf={isSelf}
                onEdit={(entry) => setDialog({ type: "experience", entry })}
                onDelete={async (entry) => {
                  if (!window.confirm(`Remove “${entry.title}” from your experience?`)) return;
                  await api(`frontend/profile/experience/${entry.id}`, { method: "DELETE" });
                  resource.reload();
                }}
                renderMeta={(item) => (
                  <p className="pf-tl-sub">
                    {item.workplace}
                    {item.location && (
                      <>
                        {" · "}
                        <MapPin size={13} /> {item.location}
                      </>
                    )}
                  </p>
                )}
              />
            ) : (
              <p className="pf-empty">{isSelf ? "Add your work experience and link it to an interest." : "No experience added yet."}</p>
            )}
          </Section>

          <Section
            title="Education"
            icon={GraduationCap}
            action={
              isSelf && (
                <button type="button" className="pf-add" onClick={() => setDialog({ type: "education" })}>
                  <Plus size={16} /> Add
                </button>
              )
            }
          >
            {profile.education.length ? (
              <Timeline
                items={profile.education.map((entry) => ({ ...entry, title: entry.institution }))}
                isSelf={isSelf}
                onEdit={(entry) => setDialog({ type: "education", entry })}
                onDelete={async (entry) => {
                  if (!window.confirm(`Remove “${entry.institution}” from your education?`)) return;
                  await api(`frontend/profile/education/${entry.id}`, { method: "DELETE" });
                  resource.reload();
                }}
                renderMeta={(item) => (
                  <p className="pf-tl-sub">
                    {[item.degree, item.field_of_study].filter(Boolean).join(" · ")}
                    {item.grade && <span className="pf-grade"> · {item.grade}</span>}
                  </p>
                )}
              />
            ) : (
              <p className="pf-empty">{isSelf ? "Add the schools, colleges and universities you attended." : "No education added yet."}</p>
            )}
          </Section>

          <Section title="Recent showcase">
            {profile.posts.length ? (
              <div className="pf-posts">
                {profile.posts.map((post) => (
                  <Link key={post.id} className="pf-post" href={`/showcase/${post.id}`}>
                    <p className="clamp-3 preserve">{post.content}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty title="Nothing shared yet" text="Showcase posts will appear here." />
            )}
          </Section>
        </div>

        <aside className="pf-side">
          <div className="pf-card pf-id-card">
            <span className="pf-id-label">Uddeepto ID</span>
            <strong className="pf-id" aria-label={`Uddeepto ID ${profile.uddeepto_id}`}>
              {profile.uddeepto_id}
            </strong>
            <div className="pf-id-actions">
              <CopyButton value={profile.uddeepto_id} label="Copy Uddeepto ID" />
              <CopyButton value={profileUrl} label="Copy profile link" />
            </div>
            <small>Share your profile link: /profile/{profile.uddeepto_id}</small>
          </div>

          <div className="pf-card">
            <h2>Interests</h2>
            {profile.interests.length ? (
              <div className="category-chips">
                {profile.interests.map((interest) => (
                  <span className="category-chip" key={interest.id}>
                    <InterestIcon iconName={interest.icon} size={13} />
                    {interest.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="pf-empty">{isSelf ? "Choose your interests from Edit profile." : "No interests added yet."}</p>
            )}
          </div>

          {personal && (
            <div className="pf-card">
              <h2>
                <Lock size={15} /> Personal details
              </h2>
              <p className="room-muted">{isSelf ? "Only you and Uddeepto admins can see this." : "Visible to admins only."}</p>
              <dl className="pf-details">
                {[
                  ["Email", personal.email],
                  ["Phone", personal.phone, Phone],
                  ["Date of birth", personal.birth_date && dayFormat.format(asUtc(personal.birth_date))],
                  ["Gender", personal.gender && personal.gender.replaceAll("_", " ")],
                  ["Current address", personal.current_address],
                  ["Permanent address", personal.permanent_address],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value || <span className="pf-empty">Not added</span>}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </aside>
      </div>

      {dialog?.type === "profile" && (
        <Modal title="Edit your profile" onClose={() => setDialog(null)}>
          <EditProfileForm profile={profile} onDone={done} />
        </Modal>
      )}
      {dialog?.type === "education" && (
        <Modal title={dialog.entry ? "Edit education" : "Add education"} onClose={() => setDialog(null)}>
          <EducationForm entry={dialog.entry} onDone={done} />
        </Modal>
      )}
      {dialog?.type === "experience" && (
        <Modal title={dialog.entry ? "Edit experience" : "Add experience"} onClose={() => setDialog(null)}>
          <ExperienceForm entry={dialog.entry} onDone={done} />
        </Modal>
      )}
    </div>
  );
}
