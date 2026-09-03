const base = process.env.API_URL ?? "http://localhost:8080/api";
const email = `smoke.${Date.now()}@example.com`;
const password = "SmokeTest123!";

async function request(path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${res.status} ${path}: ${JSON.stringify(body)}`);
  }
  return body;
}

console.log("1) gateway health");
const health = await fetch(base.replace(/\/api$/, "") + "/health").then((r) => r.json());
console.log(health);

console.log("2) register");
const registered = await request("/auth/register", {
  method: "POST",
  body: JSON.stringify({ name: "Smoke User", email, password }),
});
console.log({ user: registered.user });

console.log("3) /auth/me");
const me = await request("/auth/me", {
  headers: { authorization: `Bearer ${registered.tokens.accessToken}` },
});
console.log(me);

console.log("4) public service lists");
for (const path of ["/courses", "/jobs", "/contests", "/communities"]) {
  const data = await request(path);
  console.log(path, { total: data.meta?.total ?? data.items?.length ?? 0 });
}

console.log("Smoke test passed.");
