import express from "express";
import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = process.env.DATA_DIR || path.join(root, "data");
mkdirSync(data, { recursive: true });
const db = new DatabaseSync(path.join(data, "parcel.sqlite"));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE,password TEXT,demo INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires INTEGER);
CREATE TABLE IF NOT EXISTS tools(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),name TEXT,description TEXT,type TEXT,color TEXT,favorite INTEGER DEFAULT 0,share TEXT UNIQUE,created TEXT);
CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,tool_id TEXT REFERENCES tools(id) ON DELETE CASCADE,data TEXT,created TEXT);
CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),message TEXT,created TEXT);`);
const run = (sql, ...args) => db.prepare(sql).run(...args),
  get = (sql, ...args) => db.prepare(sql).get(...args),
  all = (sql, ...args) => db.prepare(sql).all(...args);
const now = () => new Date().toISOString(),
  id = () => randomUUID();
const templates = {
  expenses: {
    name: "Expense approvals",
    description: "Less chasing receipts. More getting things done.",
    color: "peach",
    fields: [
      { key: "title", label: "Expense", required: true },
      { key: "person", label: "Submitted by", required: true },
      { key: "amount", label: "Amount (USD)", type: "number", required: true },
      {
        key: "category",
        label: "Category",
        options: ["Software", "Travel", "Office", "Meals"],
      },
      {
        key: "status",
        label: "Status",
        options: ["Pending", "Approved", "Declined"],
      },
    ],
    seed: [
      {
        title: "Figma · team plan",
        person: "Alex Morgan",
        amount: 144,
        category: "Software",
        status: "Pending",
      },
      {
        title: "Team lunch",
        person: "Jamie Chen",
        amount: 86.5,
        category: "Meals",
        status: "Approved",
      },
      {
        title: "Design offsite train",
        person: "Sam Rivera",
        amount: 62,
        category: "Travel",
        status: "Pending",
      },
    ],
  },
  contacts: {
    name: "Team directory",
    description: "Good people. One handy place to find them.",
    color: "lavender",
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "email", label: "Email", type: "email", required: true },
      { key: "role", label: "Role", required: true },
      {
        key: "team",
        label: "Team",
        options: ["Design", "Engineering", "Operations", "Marketing"],
      },
      { key: "location", label: "Location" },
    ],
    seed: [
      {
        name: "Alex Morgan",
        email: "alex@example.com",
        role: "Product designer",
        team: "Design",
        location: "London",
      },
      {
        name: "Jamie Chen",
        email: "jamie@example.com",
        role: "Software engineer",
        team: "Engineering",
        location: "New York",
      },
      {
        name: "Sam Rivera",
        email: "sam@example.com",
        role: "Operations lead",
        team: "Operations",
        location: "Remote",
      },
    ],
  },
  checklist: {
    name: "Launch checklist",
    description: "From the first little task to the big moment.",
    color: "lime",
    fields: [
      { key: "task", label: "Task", required: true },
      { key: "owner", label: "Owner", required: true },
      { key: "due", label: "Due date", type: "date" },
      {
        key: "priority",
        label: "Priority",
        options: ["Medium", "High", "Low"],
      },
      {
        key: "status",
        label: "Status",
        options: ["To do", "In progress", "Done"],
      },
    ],
    seed: [
      {
        task: "Polish the onboarding flow",
        owner: "Alex Morgan",
        due: "",
        priority: "High",
        status: "In progress",
      },
      {
        task: "Review launch copy",
        owner: "Sam Rivera",
        due: "",
        priority: "Medium",
        status: "To do",
      },
      {
        task: "Check mobile layouts",
        owner: "Jamie Chen",
        due: "",
        priority: "High",
        status: "Done",
      },
    ],
  },
};
const log = (uid, message) =>
  run("INSERT INTO events VALUES(?,?,?,?)", id(), uid, message, now());
function createTool(uid, input, sample = false) {
  const t = templates[input.type];
  if (!t) throw new Error("Choose a valid template.");
  const tid = id();
  run(
    "INSERT INTO tools VALUES(?,?,?,?,?,?,0,NULL,?)",
    tid,
    uid,
    input.name || t.name,
    input.description || t.description,
    input.type,
    t.color,
    now(),
  );
  if (sample)
    for (const r of t.seed)
      run(
        "INSERT INTO records VALUES(?,?,?,?)",
        id(),
        tid,
        JSON.stringify(r),
        now(),
      );
  log(uid, `Created ${input.name || t.name}`);
  return tid;
}
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "1" ? 1 : false);
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  });
  if (req.path.startsWith("/api")) res.set("Cache-Control", "no-store");
  next();
});
app.use(express.json({ limit: "64kb" }));
app.use("/api", (req, res, next) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.get("X-Parcel-Request") !== "1"
  )
    return res.status(403).json({ error: "Invalid request origin." });
  next();
});
function session(req, res, uid) {
  const token = randomBytes(32).toString("hex");
  run(
    "INSERT INTO sessions VALUES(?,?,?)",
    token,
    uid,
    Date.now() + 7 * 86400000,
  );
  res.cookie("parcel_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.COOKIE_SECURE === "1",
    maxAge: 7 * 86400000,
    path: "/",
  });
}
app.use("/api", (req, res, next) => {
  const token = (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("parcel_session="))
    ?.split("=")[1];
  req.token = token;
  req.user = token
    ? get(
        "SELECT u.id,u.name,u.email,u.demo FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?",
        token,
        Date.now(),
      )
    : null;
  next();
});
const limits = new Map();
app.use("/api/auth", (req, res, next) => {
  const k = req.ip,
    t = Date.now(),
    v = limits.get(k);
  if (!v || v.until < t) limits.set(k, { n: 1, until: t + 60000 });
  else if (++v.n > 20)
    return res
      .status(429)
      .json({ error: "Too many attempts. Try again in a minute." });
  if (limits.size > 10000)
    for (const [key, value] of limits) if (value.until < t) limits.delete(key);
  next();
});
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.get("/api/templates", (req, res) => res.json(templates));
app.get("/api/me", (req, res) =>
  res.json({
    user: req.user || null,
    demoEnabled: process.env.DEMO_ENABLED !== "0",
  }),
);
app.post("/api/auth/demo", (req, res) => {
  if (process.env.DEMO_ENABLED === "0")
    return res.status(403).json({ error: "Demo is disabled." });
  if (req.user) return res.json({ user: req.user });
  const uid = id();
  run(
    "INSERT INTO users VALUES(?,?,?,?,1)",
    uid,
    "Alex Morgan",
    `demo-${uid}@example.com`,
    null,
  );
  for (const type of Object.keys(templates)) createTool(uid, { type }, true);
  session(req, res, uid);
  res.json({
    user: get("SELECT id,name,email,demo FROM users WHERE id=?", uid),
  });
});
app.post("/api/auth/:action", (req, res) => {
  const { action } = req.params;
  if (!["login", "signup", "upgrade"].includes(action))
    return res.status(404).json({ error: "Not found." });
  const { email, password, name } = req.body || {};
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 128
  )
    return res
      .status(400)
      .json({
        error: "Use a valid email and a password of 10–128 characters.",
      });
  const normalized = email.toLowerCase().trim();
  let u = get("SELECT * FROM users WHERE email=?", normalized);
  if (action === "login") {
    const salt = u?.password?.split(":")[0] || "missing";
    const actual = scryptSync(password, salt, 64),
      expected = Buffer.from(
        u?.password?.split(":")[1] || "00".repeat(64),
        "hex",
      );
    if (
      !u?.password ||
      expected.length !== actual.length ||
      !timingSafeEqual(actual, expected)
    )
      return res.status(401).json({ error: "Email or password is incorrect." });
  } else {
    if (u)
      return res
        .status(409)
        .json({ error: "An account with this email already exists." });
    if (typeof name !== "string" || !name.trim() || name.length > 80)
      return res
        .status(400)
        .json({ error: "Enter your name (up to 80 characters)." });
    if (action === "upgrade" && !req.user?.demo)
      return res.status(400).json({ error: "Open a demo workspace first." });
    const salt = randomBytes(16).toString("hex"),
      hash = salt + ":" + scryptSync(password, salt, 64).toString("hex");
    const uid = action === "upgrade" ? req.user.id : id();
    if (action === "upgrade")
      run(
        "UPDATE users SET name=?,email=?,password=?,demo=0 WHERE id=?",
        name.trim(),
        normalized,
        hash,
        uid,
      );
    else
      run(
        "INSERT INTO users VALUES(?,?,?,?,0)",
        uid,
        name.trim(),
        normalized,
        hash,
      );
    u = { id: uid };
    log(uid, "Created your Parcel account");
  }
  if (req.token) run("DELETE FROM sessions WHERE token=?", req.token);
  session(req, res, u.id);
  res.json({
    user: get("SELECT id,name,email,demo FROM users WHERE id=?", u.id),
  });
});
app.post("/api/logout", (req, res) => {
  if (req.token) run("DELETE FROM sessions WHERE token=?", req.token);
  res.clearCookie("parcel_session", { path: "/" });
  res.json({ ok: true });
});
const toolData = (t) => ({
  ...t,
  favorite: !!t.favorite,
  records: all(
    "SELECT * FROM records WHERE tool_id=? ORDER BY created DESC",
    t.id,
  ).map((r) => ({ ...r, data: JSON.parse(r.data) })),
});
app.get("/api/shared/:token", (req, res) => {
  const t = get("SELECT * FROM tools WHERE share=?", req.params.token);
  if (!t)
    return res
      .status(404)
      .json({ error: "This link is unavailable or has been revoked." });
  const { user_id, share, ...safe } = toolData(t);
  res.json(safe);
});
app.use("/api", (req, res, next) =>
  req.user
    ? next()
    : res.status(401).json({ error: "Sign in to open your workspace." }),
);
app.get("/api/tools", (req, res) =>
  res.json(
    all(
      "SELECT t.*, (SELECT COUNT(*) FROM records r WHERE r.tool_id=t.id) AS record_count FROM tools t WHERE user_id=? ORDER BY created DESC",
      req.user.id,
    ).map((t) => ({ ...t, favorite: !!t.favorite })),
  ),
);
app.get("/api/events", (req, res) =>
  res.json(
    all(
      "SELECT * FROM events WHERE user_id=? ORDER BY created DESC LIMIT 100",
      req.user.id,
    ),
  ),
);
app.post("/api/tools", (req, res) => {
  const { name, description, type, sample } = req.body || {};
  if (
    !templates[type] ||
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 80 ||
    typeof description !== "string" ||
    description.length > 240
  )
    return res
      .status(400)
      .json({
        error:
          "Choose a template, a name (1–80 characters), and a description up to 240 characters.",
      });
  if (
    get("SELECT COUNT(*) AS n FROM tools WHERE user_id=?", req.user.id).n >= 100
  )
    return res
      .status(400)
      .json({ error: "This workspace supports up to 100 tools." });
  const tid = createTool(
    req.user.id,
    { name: name.trim(), description, type },
    !!sample,
  );
  res.status(201).json(toolData(get("SELECT * FROM tools WHERE id=?", tid)));
});
app.use("/api/tools/:id", (req, res, next) => {
  req.tool = get(
    "SELECT * FROM tools WHERE id=? AND user_id=?",
    req.params.id,
    req.user.id,
  );
  if (!req.tool) return res.status(404).json({ error: "Tool not found." });
  next();
});
app.get("/api/tools/:id", (req, res) => res.json(toolData(req.tool)));
app.patch("/api/tools/:id", (req, res) => {
  if (typeof req.body.favorite !== "boolean")
    return res.status(400).json({ error: "Favorite must be a boolean." });
  run(
    "UPDATE tools SET favorite=? WHERE id=?",
    Number(req.body.favorite),
    req.tool.id,
  );
  res.json({ ok: true });
});
app.delete("/api/tools/:id", (req, res) => {
  run("DELETE FROM tools WHERE id=?", req.tool.id);
  log(req.user.id, `Deleted ${req.tool.name}`);
  res.json({ ok: true });
});
app.post("/api/tools/:id/share", (req, res) => {
  const token = req.tool.share || randomBytes(24).toString("hex");
  run("UPDATE tools SET share=? WHERE id=?", token, req.tool.id);
  log(req.user.id, `Enabled a view-only link for ${req.tool.name}`);
  res.json({ token });
});
app.delete("/api/tools/:id/share", (req, res) => {
  run("UPDATE tools SET share=NULL WHERE id=?", req.tool.id);
  log(req.user.id, `Revoked the shared link for ${req.tool.name}`);
  res.json({ ok: true });
});
function validateRecord(type, input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Enter a valid record.");
  const result = {};
  for (const f of templates[type].fields) {
    let v = input[f.key] ?? "";
    if (f.type === "number") {
      if (
        v === "" ||
        !Number.isFinite(Number(v)) ||
        Number(v) < 0 ||
        Number(v) > 1e9
      )
        throw new Error(`${f.label} must be a number between 0 and 1 billion.`);
      v = Math.round(Number(v) * 100) / 100;
    } else {
      if (typeof v !== "string" || v.length > 500)
        throw new Error(`${f.label} must be text under 500 characters.`);
      v = v.trim();
    }
    if (f.required && v === "") throw new Error(`${f.label} is required.`);
    if (f.options && !f.options.includes(v))
      throw new Error(`Choose a valid ${f.label.toLowerCase()}.`);
    if (f.type === "email" && !/^\S+@\S+\.\S+$/.test(v))
      throw new Error("Enter a valid email.");
    if (
      f.type === "date" &&
      v &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)))
    )
      throw new Error("Enter a valid date.");
    result[f.key] = v;
  }
  return result;
}
app.post("/api/tools/:id/records", (req, res) => {
  let data;
  try {
    data = validateRecord(req.tool.type, req.body);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  const rid = id();
  run(
    "INSERT INTO records VALUES(?,?,?,?)",
    rid,
    req.tool.id,
    JSON.stringify(data),
    now(),
  );
  log(req.user.id, `Added a record to ${req.tool.name}`);
  res.status(201).json({ id: rid, data });
});
app.put("/api/tools/:id/records/:record", (req, res) => {
  if (
    !get(
      "SELECT id FROM records WHERE id=? AND tool_id=?",
      req.params.record,
      req.tool.id,
    )
  )
    return res.status(404).json({ error: "Record not found." });
  let data;
  try {
    data = validateRecord(req.tool.type, req.body);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  run(
    "UPDATE records SET data=? WHERE id=?",
    JSON.stringify(data),
    req.params.record,
  );
  log(req.user.id, `Updated a record in ${req.tool.name}`);
  res.json({ ok: true });
});
app.delete("/api/tools/:id/records/:record", (req, res) => {
  const result = run(
    "DELETE FROM records WHERE id=? AND tool_id=?",
    req.params.record,
    req.tool.id,
  );
  if (!result.changes)
    return res.status(404).json({ error: "Record not found." });
  log(req.user.id, `Removed a record from ${req.tool.name}`);
  res.json({ ok: true });
});
app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));
app.use(express.static(path.join(root, "dist")));
app.get("/{*path}", (req, res) =>
  res.sendFile(path.join(root, "dist", "index.html")),
);
app.use((err, req, res, next) => {
  console.error(err.message);
  res
    .status(err.status || 500)
    .json({
      error:
        err.status === 413
          ? "Request too large."
          : "Something went wrong. Please try again.",
    });
});
const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () =>
  console.log(`Parcel running on port ${port}`),
);
