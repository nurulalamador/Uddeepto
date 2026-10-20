"use client";

import { useState } from "react";
import { CircleAlert, KeyRound, Trash2, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api";
import { Modal } from "../ui";
import { useUser } from "../shell";

const signOutHere = () => fetch("/api/auth/logout", { method: "POST" }).catch(() => {});

/** Account settings for every role: change the password and delete the account. */
export default function AccountSettings() {
  const user = useUser();
  return (
    <div className="acct">
      <p className="acct-lead">
        Signed in as <strong>{user.name}</strong>
        {user.email ? ` (${user.email})` : user.username ? ` (@${user.username})` : ""}.
      </p>
      <ChangePassword />
      <DeleteAccount role={user.role} />
    </div>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const mismatch = again.length > 0 && next !== again;
  const ready = current && next.length >= 8 && next === again && !busy && !done;

  async function submit(event) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      await api("frontend/account/password", { method: "POST", body: { currentPassword: current, newPassword: next } });
      setDone(true);
      // Every session was ended on the server, this one included, so go and sign in again.
      await signOutHere();
      setTimeout(() => window.location.assign("/login"), 2500);
    } catch (problem) {
      setError(problem.message);
      setBusy(false);
    }
  }

  return (
    <section className="card acct-card" aria-labelledby="acct-password">
      <div className="acct-card-head">
        <span className="acct-icon">
          <KeyRound size={20} />
        </span>
        <div>
          <h2 id="acct-password">Change password</h2>
          <p>Use at least 8 characters. You will be signed out on every device and sign in again with the new password.</p>
        </div>
      </div>
      <form className="form acct-form" onSubmit={submit}>
        <label>
          Current password
          <input type="password" name="current_password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} required />
        </label>
        <label>
          New password
          <input type="password" name="new_password" autoComplete="new-password" minLength={8} maxLength={128} value={next} onChange={(event) => setNext(event.target.value)} required />
        </label>
        <label>
          Confirm new password
          <input type="password" name="confirm_password" autoComplete="new-password" value={again} onChange={(event) => setAgain(event.target.value)} required aria-invalid={mismatch} />
          {mismatch && <small className="acct-bad">The two passwords do not match.</small>}
        </label>
        {error && (
          <p className="notice error" role="alert">
            <CircleAlert size={16} /> {error}
          </p>
        )}
        {done && (
          <p className="notice success" role="status">
            Password changed. You have been signed out everywhere - taking you to the sign-in page…
          </p>
        )}
        <button className="button" disabled={!ready}>
          {busy ? "Changing…" : "Change password"}
        </button>
      </form>
    </section>
  );
}

function DeleteAccount({ role }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="card acct-card acct-danger" aria-labelledby="acct-delete">
      <div className="acct-card-head">
        <span className="acct-icon red">
          <Trash2 size={20} />
        </span>
        <div>
          <h2 id="acct-delete">Delete account</h2>
          <p>Permanently remove your account. This cannot be undone.</p>
        </div>
      </div>
      <ul className="acct-list">
        <li>Your profile, contact details, picture, education, experience and CV are erased.</li>
        <li>You are signed out everywhere and can never sign in with this account again.</li>
        <li>Your posts and comments are removed. Anything that has to stay for other people (messages, applications, course or contest records) shows “Deleted user” instead of your name.</li>
        {role === "hirer" && <li>Your open job posts are closed.</li>}
      </ul>
      <button type="button" className="button acct-delete-button" onClick={() => setOpen(true)}>
        <Trash2 size={16} /> Delete my account
      </button>
      {open && (
        <Modal title="Delete your account?" onClose={() => setOpen(false)}>
          <ConfirmDelete />
        </Modal>
      )}
    </section>
  );
}

function ConfirmDelete() {
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = password && typed === "DELETE" && !busy;

  async function submit(event) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      await api("frontend/account", { method: "DELETE", body: { password } });
      await signOutHere();
      window.location.assign("/login");
    } catch (problem) {
      setError(problem.message);
      setBusy(false);
    }
  }

  return (
    <form className="form stack" onSubmit={submit}>
      <p className="notice error">
        <TriangleAlert size={16} /> This permanently deletes your account. There is no way to get it back.
      </p>
      <label>
        Your password
        <input type="password" name="delete_password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      </label>
      <label>
        Type <strong>DELETE</strong> to confirm
        <input name="delete_confirm" autoComplete="off" value={typed} onChange={(event) => setTyped(event.target.value)} placeholder="DELETE" required />
      </label>
      {error && (
        <p className="notice error" role="alert">
          <CircleAlert size={16} /> {error}
        </p>
      )}
      <button className="button acct-delete-button" disabled={!ready}>
        {busy ? "Deleting…" : "Delete my account forever"}
      </button>
    </form>
  );
}
