import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { createHmac } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { io as connect } from "socket.io-client";
import { db, query, server } from "./harness.js";

const sqlFile = (name) => readFile(new URL(`../../backend/database/${name}`, import.meta.url), "utf8");

test("live updates over Socket.IO: auth, notifications, messages, community chat, typing", async (t) => {
  let schema = await sqlFile("001_initial_schema.sql");
  schema = schema.replace(/CREATE EXTENSION IF NOT EXISTS (pgcrypto|citext);/g, "").replace(/\bCITEXT\b/g, "TEXT");
  await db.exec(schema);
  for (const file of ["003_platform_settings.sql", "004_instructors.sql", "005_profile_course_media.sql", "006_multiple_categories.sql", "007_course_material_files.sql", "008_contest_submission_kinds.sql", "009_webinar_speakers.sql", "010_profile_details.sql", "011_job_locations.sql", "012_notifications.sql"])
    await db.exec(await sqlFile(file));
  process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), "uddeepto-uploads-"));

  let source = await readFile(new URL("../../backend/services/frontend/src/server.js", import.meta.url), "utf8");
  source = source
    .replace(/import bcrypt from ['"]bcryptjs['"];/, () => "const bcrypt={hash:async value=>'test-only:'+value};")
    .replace(/(['"])@uddeepto\/common\1/, () => JSON.stringify(new URL("./harness.js", import.meta.url).href))
    .replace(/(['"])express\1/, () => JSON.stringify(import.meta.resolve("express")))
    .replace(/(['"])zod\1/, () => JSON.stringify(import.meta.resolve("zod")));
  await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;

  const ids = {};
  for (const [name, role] of [["Poster", "learner"], ["Fan", "learner"], ["Third", "learner"], ["Banned", "learner"]])
    ids[name] = (await query("INSERT INTO users(name,email,username,password_hash,role) VALUES($1,$2,$3,'x',$4) RETURNING id", [name, `${name}@example.com`, name, role])).rows[0].id;
  await query("UPDATE users SET account_status='suspended' WHERE id=$1", [ids.Banned]);
  const category = (await query("INSERT INTO interest_categories(name,slug,icon) VALUES('Web','web','code') RETURNING id")).rows[0].id;

  async function request(path, { as = "Poster", method = "GET", body, headers = {} } = {}) {
    const res = await fetch(base + path, { method, headers: { "x-test-user": ids[as], "Content-Type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, data: await res.json().catch(() => null) };
  }
  async function ok(path, options) {
    const r = await request(path, options);
    assert.equal(r.status, 200, `${path}: ${JSON.stringify(r.data)}`);
    return r.data;
  }

  const sockets = [];
  // Connects like the browser does: the "ticket" is the person's id in these tests.
  async function open(ticket) {
    const socket = connect(base, { transports: ["websocket"], auth: { ticket }, reconnection: false, forceNew: true });
    sockets.push(socket);
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    });
    return socket;
  }
  // Collects events so they can be awaited or asserted absent.
  function watch(socket, ...events) {
    const seen = [];
    for (const event of events) socket.on(event, (payload) => seen.push({ event, payload }));
    return {
      seen,
      async next(event, timeout = 2000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
          const index = seen.findIndex((entry) => entry.event === event);
          if (index >= 0) return seen.splice(index, 1)[0].payload;
          await new Promise((resolve) => setTimeout(resolve, 15));
        }
        throw new Error(`no "${event}" event within ${timeout}ms`);
      },
      async none(event, wait = 250) {
        await new Promise((resolve) => setTimeout(resolve, wait));
        assert.equal(seen.filter((entry) => entry.event === event).length, 0, `unexpected "${event}"`);
      },
    };
  }
  const ask = (socket, event, ...args) => new Promise((resolve) => socket.emit(event, ...args, resolve));

  try {
    await t.test("only valid tickets for active accounts may connect", async () => {
      await assert.rejects(open(""), /unauthorized/);
      await assert.rejects(open("not-a-person"), /unauthorized/);
      await assert.rejects(open(ids.Banned), /unauthorized/, "suspended accounts are refused");
      const socket = await open(ids.Poster);
      assert.equal(socket.connected, true);
      const ticket = await ok("/realtime/ticket", { method: "POST" });
      assert.ok(ticket.ticket);
    });

    await t.test("a new notification reaches the person's open browser, and taking a like back removes it", async () => {
      const post = (await query("INSERT INTO showcase_posts(creator_id,category_id,content) VALUES($1,$2,'Live post') RETURNING id", [ids.Poster, category])).rows[0].id;
      const poster = watch(await open(ids.Poster), "notification", "notification:removed");
      const second = watch(await open(ids.Poster), "notification");
      const third = watch(await open(ids.Third), "notification");
      await ok(`/showcase/${post}/reaction`, { as: "Fan", method: "PUT" });
      const pushed = await poster.next("notification");
      assert.equal(pushed.title, "Fan liked your post");
      assert.equal(pushed.read, false);
      assert.equal(pushed.actor_name, "Fan");
      assert.equal(pushed.link, `/showcase/${post}`);
      await second.next("notification");
      await third.none("notification");
      await ok(`/showcase/${post}/reaction`, { as: "Fan", method: "PUT" });
      const removed = await poster.next("notification:removed");
      assert.equal(removed.id, pushed.id);
    });

    let conversation;
    await t.test("direct messages are delivered live to both people and nobody else", async () => {
      const poster = watch(await open(ids.Poster), "message:new");
      const fan = watch(await open(ids.Fan), "message:new");
      const outsider = watch(await open(ids.Third), "message:new");
      conversation = (await ok("/messages", { method: "POST", body: { user_id: ids.Fan } })).id;
      const sent = await ok(`/messages/${conversation}`, { method: "POST", body: { content: "Hello Fan!" } });
      assert.equal(sent.content, "Hello Fan!");
      assert.equal(sent.sender_id, ids.Poster);
      assert.ok(sent.sent_at);
      for (const person of [poster, fan]) {
        const event = await person.next("message:new");
        assert.equal(event.conversation_id, conversation);
        assert.equal(event.message.id, sent.id);
        assert.equal(event.message.content, "Hello Fan!");
        assert.equal(event.sender_name, "Poster");
      }
      await outsider.none("message:new");
    });

    await t.test("typing signals reach the other person only, are throttled and need membership", async () => {
      const poster = await open(ids.Poster);
      const fan = watch(await open(ids.Fan), "typing");
      const outsider = await open(ids.Third);
      poster.emit("typing", { scope: "dm", conversation_id: conversation });
      const typing = await fan.next("typing");
      assert.equal(typing.name, "Poster");
      assert.equal(typing.conversation_id, conversation);
      poster.emit("typing", { scope: "dm", conversation_id: conversation });
      await fan.none("typing", 300);
      outsider.emit("typing", { scope: "dm", conversation_id: conversation });
      await fan.none("typing", 300);
      poster.emit("typing", { scope: "dm", conversation_id: "not-a-uuid" });
      await fan.none("typing", 200);
    });

    await t.test("community chat: only members receive messages, reactions and deletes", async () => {
      const community = await ok("/communities", { method: "POST", body: { name: "Live room", slug: "live-room", description: "x", category_ids: [category], requires_approval: false, is_private: false } });
      const detail = await ok(`/communities/${community.id}`);
      const chat = detail.chats[0].id;
      await query("INSERT INTO community_members(community_id,member_id,status,approved_at) VALUES($1,$2,'approved',now())", [community.id, ids.Fan]);

      const ownerSocket = await open(ids.Poster);
      const owner = watch(ownerSocket, "community:message", "community:reaction", "community:message_deleted", "community:chat_created", "typing");
      const memberSocket = await open(ids.Fan);
      const member = watch(memberSocket, "community:message", "community:reaction", "community:message_deleted", "typing");
      const outsiderSocket = await open(ids.Third);
      const outsider = watch(outsiderSocket, "community:message", "typing");
      assert.deepEqual(await ask(ownerSocket, "community:join", community.id), { ok: true });
      assert.deepEqual(await ask(memberSocket, "community:join", community.id), { ok: true });
      assert.deepEqual(await ask(outsiderSocket, "community:join", community.id), { ok: false }, "non-members cannot subscribe");
      assert.deepEqual(await ask(memberSocket, "community:join", "nope"), { ok: false });

      const sent = await ok(`/communities/${community.id}/chats/${chat}`, { method: "POST", body: { content: "Welcome, everyone" } });
      assert.equal(sent.sender_name, "Poster");
      assert.deepEqual(sent.reactions, []);
      for (const person of [owner, member]) {
        const event = await person.next("community:message");
        assert.equal(event.community_id, community.id);
        assert.equal(event.chat_id, chat);
        assert.equal(event.message.id, sent.id);
        assert.equal(event.message.content, "Welcome, everyone");
        assert.deepEqual(event.message.reactions, []);
      }
      await outsider.none("community:message");

      await ok(`/communities/${community.id}/chats/${chat}/messages/${sent.id}/reaction`, { as: "Fan", method: "PUT", body: { reaction: "love" } });
      const added = await owner.next("community:reaction");
      assert.deepEqual([added.message_id, added.user_id, added.reaction, added.added], [sent.id, ids.Fan, "love", true]);
      await ok(`/communities/${community.id}/chats/${chat}/messages/${sent.id}/reaction`, { as: "Fan", method: "PUT", body: { reaction: "love" } });
      assert.equal((await owner.next("community:reaction")).added, false);

      ownerSocket.emit("typing", { scope: "community", community_id: community.id, chat_id: chat });
      assert.equal((await member.next("typing")).name, "Poster");
      await owner.none("typing", 200);
      outsiderSocket.emit("typing", { scope: "community", community_id: community.id, chat_id: chat });
      await owner.none("typing", 250);

      const channel = await ok(`/communities/${community.id}/chats`, { method: "POST", body: { name: "announcements" } });
      assert.ok(channel.id);
      assert.equal((await owner.next("community:chat_created")).community_id, community.id);

      await ok(`/communities/${community.id}/chats/${chat}/messages/${sent.id}`, { method: "DELETE" });
      assert.equal((await member.next("community:message_deleted")).message_id, sent.id);

      // Removing a member ends their live feed straight away.
      await ok(`/communities/${community.id}/members/${ids.Fan}`, { method: "PATCH", body: { status: "rejected" } });
      await ok(`/communities/${community.id}/chats/${chat}`, { method: "POST", body: { content: "Members only" } });
      await owner.next("community:message");
      await member.none("community:message", 300);
    });

    await t.test("other services can push events through the protected internal route", async () => {
      const fan = watch(await open(ids.Fan), "notification");
      const token = createHmac("sha256", process.env.JWT_ACCESS_SECRET || "uddeepto-dev").update("uddeepto-internal-emit").digest("hex");
      const push = (headers) => fetch(`${base}/internal/emit`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ items: [{ rooms: [`user:${ids.Fan}`], event: "notification", payload: { id: "x", title: "From another service" } }] }) });
      assert.equal((await push({})).status, 403);
      assert.equal((await push({ "x-internal-token": "wrong" })).status, 403);
      assert.equal((await push({ "x-internal-token": token })).status, 200);
      assert.equal((await fan.next("notification")).title, "From another service");
    });
  } finally {
    for (const socket of sockets) socket.disconnect();
    await new Promise((resolve) => server.close(resolve));
    await db.close();
  }
});
