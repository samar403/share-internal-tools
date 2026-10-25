import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
let server,
  dir,
  log = "";
const port = 43117,
  base = `http://127.0.0.1:${port}`;
before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "parcel-test-"));
  server = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dir },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (b) => (log += b));
  server.stderr.on("data", (b) => (log += b));
  for (let n = 0; n < 80; n++) {
    try {
      if ((await fetch(base + "/api/health")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(log);
});
after(async () => {
  if (server && server.exitCode === null) {
    server.kill();
    await new Promise((r) => server.once("exit", r));
  }
  await rm(dir, { recursive: true, force: true });
});
function client() {
  let cookie = "";
  return async (url, method = "GET", body) => {
    const r = await fetch(base + "/api" + url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Parcel-Request": "1",
        Cookie: cookie,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const c = r.headers.get("set-cookie");
    if (c) cookie = c.split(";")[0];
    return { status: r.status, data: await r.json() };
  };
}
test("complete workspace lifecycle, isolation, validation and revocable sharing", async () => {
  const a = client(),
    b = client(),
    guest = client();
  assert.equal((await guest("/tools")).status, 401);
  assert.equal((await a("/auth/demo", "POST")).status, 200);
  assert.equal((await b("/auth/demo", "POST")).status, 200);
  assert.equal((await a("/tools")).data.length, 3);
  const created = await a("/tools", "POST", {
    name: "Operations expenses",
    description: "Our spending",
    type: "expenses",
    sample: false,
  });
  assert.equal(created.status, 201);
  const id = created.data.id;
  assert.equal(created.data.records.length, 0);
  assert.equal((await b("/tools/" + id)).status, 404);
  assert.equal((await b("/tools/" + id, "DELETE")).status, 404);
  assert.equal(
    (
      await a("/tools/" + id + "/records", "POST", {
        title: "Bad",
        person: "Alex",
        amount: -4,
        category: "Office",
        status: "Pending",
      })
    ).status,
    400,
  );
  const r = await a("/tools/" + id + "/records", "POST", {
    title: "Team lunch",
    person: "Alex",
    amount: 42.5,
    category: "Meals",
    status: "Pending",
  });
  assert.equal(r.status, 201);
  assert.equal(
    (
      await a("/tools/" + id + "/records/" + r.data.id, "PUT", {
        ...r.data.data,
        status: "Approved",
      })
    ).status,
    200,
  );
  assert.equal(
    (await a("/tools/" + id)).data.records[0].data.status,
    "Approved",
  );
  assert.equal(
    (await a("/tools/" + id, "PATCH", { favorite: true })).status,
    200,
  );
  assert.equal((await a("/tools/" + id)).data.favorite, true);
  const share = await a("/tools/" + id + "/share", "POST");
  const publicTool = await guest("/shared/" + share.data.token);
  assert.equal(publicTool.status, 200);
  assert.equal(publicTool.data.records.length, 1);
  assert.equal(publicTool.data.user_id, undefined);
  assert.equal(publicTool.data.share, undefined);
  assert.equal(
    (await guest("/tools/" + id + "/records", "POST", {})).status,
    401,
  );
  assert.equal((await a("/tools/" + id + "/share", "DELETE")).status, 200);
  assert.equal((await guest("/shared/" + share.data.token)).status, 404);
  assert.equal(
    (await a("/tools/" + id + "/records/" + r.data.id, "DELETE")).status,
    200,
  );
  assert.equal((await a("/tools/" + id)).data.records.length, 0);
  assert.equal((await a("/tools/" + id, "DELETE")).status, 200);
  assert.equal((await a("/tools/" + id)).status, 404);
  assert.ok(
    (await a("/events")).data.some(
      (e) => e.message === "Deleted Operations expenses",
    ),
  );
});
test("accounts persist, login works, and demo upgrades retain data", async () => {
  const a = client(),
    b = client();
  assert.equal((await a("/auth/demo", "POST")).status, 200);
  const ids = (await a("/tools")).data.map((t) => t.id);
  const credentials = {
    name: "Test Owner",
    email: "owner@example.com",
    password: "correct-horse-battery",
  };
  assert.equal((await a("/auth/upgrade", "POST", credentials)).status, 200);
  assert.deepEqual(
    (await a("/tools")).data.map((t) => t.id),
    ids,
  );
  assert.equal((await a("/me")).data.user.demo, 0);
  await a("/logout", "POST");
  assert.equal((await a("/tools")).status, 401);
  assert.equal(
    (
      await a("/auth/login", "POST", {
        ...credentials,
        password: "incorrect-password",
      })
    ).status,
    401,
  );
  assert.equal((await a("/auth/login", "POST", credentials)).status, 200);
  assert.deepEqual(
    (await a("/tools")).data.map((t) => t.id),
    ids,
  );
  assert.equal(
    (
      await b("/auth/signup", "POST", {
        name: "New User",
        email: "new@example.com",
        password: "a-secure-test-password",
      })
    ).status,
    200,
  );
  assert.equal((await b("/tools")).data.length, 0);
  assert.equal((await b("/tools/" + ids[0])).status, 404);
});
test("same-origin mutation guard and security headers", async () => {
  const r = await fetch(base + "/api/auth/demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(r.status, 403);
  assert.equal(r.headers.get("x-frame-options"), "DENY");
  assert.match(
    r.headers.get("content-security-policy"),
    /frame-ancestors 'none'/,
  );
  assert.equal(r.headers.get("cache-control"), "no-store");
});
