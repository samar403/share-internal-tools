import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  LayoutGrid,
  Star,
  Layers,
  Activity,
  Settings,
  ChevronDown,
  ChevronRight,
  Box,
  Command,
  X,
  Check,
  Link,
  Copy,
  Lock,
  Globe,
  MoreHorizontal,
  Download,
  Trash2,
  Pencil,
  LogOut,
  Receipt,
  Users,
  CheckSquare,
  ArrowLeft,
  ExternalLink,
  Loader2,
  Menu,
  ShieldCheck,
  Mail,
  CornerDownLeft,
} from "lucide-react";
import "./style.css";
const icons = { expenses: Receipt, contacts: Users, checklist: CheckSquare };
async function api(url, options = {}) {
  const r = await fetch("/api" + url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Parcel-Request": "1",
      ...options.headers,
    },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}
const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n || 0,
  );
function Mark({ small = false }) {
  return (
    <span className={"mark " + (small ? "small" : "")}>
      <Box size={small ? 18 : 23} strokeWidth={1.8} />
    </span>
  );
}
function App() {
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [templates, setTemplates] = useState({}),
    [tools, setTools] = useState([]),
    [events, setEvents] = useState([]),
    [page, setPage] = useState("workspace"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [modal, setModal] = useState(null),
    [active, setActive] = useState(null),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false),
    [demoEnabled, setDemoEnabled] = useState(true);
  const shared = location.pathname.startsWith("/s/");
  const toastTimer = useRef();
  const notify = (m) => {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  };
  async function refresh() {
    const [t, e] = await Promise.all([api("/tools"), api("/events")]);
    setTools(t);
    setEvents(e);
  }
  useEffect(() => {
    (async () => {
      try {
        const [t, me] = await Promise.all([api("/templates"), api("/me")]);
        setTemplates(t);
        setUser(me.user);
        setDemoEnabled(me.demoEnabled);
        if (shared)
          setActive(await api("/shared/" + location.pathname.split("/")[2]));
        else if (me.user) await refresh();
      } catch (e) {
        setError(e.message);
      } finally {
        setReady(true);
      }
    })();
  }, []);
  useEffect(() => {
    function key(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("search")?.focus();
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  async function action(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function demo() {
    await action(async () => {
      const r = await api("/auth/demo", { method: "POST" });
      setUser(r.user);
      await refresh();
    });
  }
  async function openTool(id) {
    await action(async () => {
      setActive(await api("/tools/" + id));
      setPage("tool");
      setQuery("");
    });
  }
  const navigate = (p) => {
    setPage(p);
    setActive(null);
    setQuery("");
    setError("");
    setMobile(false);
  };
  const create = (type = "expenses") => setModal({ kind: "create", type });
  const close = () => {
    setModal(null);
    setError("");
  };
  async function favorite(t, e) {
    e?.stopPropagation();
    await action(async () => {
      await api("/tools/" + t.id, {
        method: "PATCH",
        body: JSON.stringify({ favorite: !t.favorite }),
      });
      await refresh();
    });
  }
  const filtered = tools.filter(
    (t) =>
      (page !== "favorites" || t.favorite) &&
      (filter === "all" || (filter === "shared" ? t.share : !t.share)) &&
      (t.name + " " + t.description)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const total = tools.reduce((n, t) => n + t.record_count, 0);
  async function reloadActive() {
    setActive(await api("/tools/" + active.id));
    await refresh();
  }
  const exportCSV = () => {
    const fields = templates[active.type].fields;
    const cell = (v) =>
      '"' +
      String(v ?? "")
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const csv = [
      fields.map((f) => cell(f.label)).join(","),
      ...active.records.map((r) =>
        fields.map((f) => cell(r.data[f.key])).join(","),
      ),
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = active.name.replace(/[^a-z0-9]/gi, "-") + ".csv";
    a.click();
    URL.revokeObjectURL(url);
    notify("CSV exported");
  };
  if (!ready)
    return (
      <div className="loading">
        <Mark />
        <Loader2 className="spin" />
        <p>Unpacking your workspace…</p>
      </div>
    );
  if (shared)
    return (
      <>
        <header className="public-header">
          <a href="/" className="brand">
            <Mark />
            parcel<span>Shared tools, simply.</span>
          </a>
          <span className="pill">
            <Lock size={13} /> View only
          </span>
        </header>
        {active ? (
          <main className="public-main">
            <ToolView
              active={active}
              templates={templates}
              query={query}
              setQuery={setQuery}
              shared
              exportCSV={exportCSV}
            />
          </main>
        ) : (
          <div className="empty">
            <Lock size={40} />
            <h1>This parcel is unavailable</h1>
            <p>{error || "The owner may have revoked this link."}</p>
            <a className="button dark" href="/">
              Go to Parcel
            </a>
          </div>
        )}
        {toast && (
          <div className="toast">
            <Check size={16} />
            {toast}
          </div>
        )}
      </>
    );
  if (!user)
    return (
      <div className="landing">
        <header>
          <a className="brand" href="/">
            <Mark />
            parcel<span className="beta">EARLY ACCESS</span>
          </a>
          <button
            className="button subtle"
            onClick={() => setModal({ kind: "auth", mode: "login" })}
          >
            Sign in <ArrowUpRight size={16} />
          </button>
        </header>
        <main className="landing-main">
          <div className="landing-copy">
            <span className="eyebrow">
              <span className="live-dot" /> A LITTLE SOFTWARE. A LOT OF
              POSSIBILITY.
            </span>
            <h1>
              Your team's
              <br />
              next big thing
              <br />
              could be <em>small.</em>
            </h1>
            <p>
              The expense tracker. The launch checklist. That little tool
              everyone keeps asking for.
              <br />
              Give it a home. Share it like a document.
            </p>
            <div className="row">
              <button
                className="button dark large"
                onClick={() => setModal({ kind: "auth", mode: "signup" })}
              >
                Start your workspace <ArrowRight size={18} />
              </button>
              {demoEnabled && (
                <button
                  className="button outline large"
                  onClick={demo}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="spin" size={18} />
                  ) : (
                    <>
                      Explore live demo <ArrowUpRight size={18} />
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="landing-note">
              <ShieldCheck size={15} /> Private by default. Useful from day one.
            </div>
          </div>
          <div className="landing-art">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="floating-note note-one">
              <Receipt size={25} />
              <b>Expense approvals</b>
              <span>Less paperwork, more progress.</span>
              <div className="mini-receipt">
                <span>
                  Team lunch <b>$86.50</b>
                </span>
                <span>
                  Figma team plan <b>$144.00</b>
                </span>
                <span className="approved">
                  <Check size={12} /> Looks good. Approved.
                </span>
              </div>
            </div>
            <div className="floating-note note-two">
              <Users size={28} />
              <b>
                Good people.
                <br />
                One place.
              </b>
              <div className="avatar-stack">
                <i>AM</i>
                <i>JC</i>
                <i>SR</i>
                <i>+you</i>
              </div>
            </div>
            <div className="floating-note note-three">
              <CheckSquare size={27} />
              <b>Ready, set, launch.</b>
              <span>
                <Check size={15} /> Make something useful
              </span>
              <span>
                <Check size={15} /> Send a little link
              </span>
              <span>
                <span className="tiny-square" /> Do your best work
              </span>
            </div>
            <div className="art-tag">
              <Link size={16} /> Small tools. Big team energy.
            </div>
            <span className="spark">✳</span>
          </div>
        </main>
        <footer className="landing-footer">
          <span>A calmer home for your internal tools.</span>
          <span>
            MADE FOR THE WAY SMALL TEAMS WORK <ArrowUpRight size={14} />
          </span>
        </footer>
        {error && (
          <div className="global-error" role="alert">
            {error}
            <button onClick={() => setError("")} aria-label="Dismiss error">
              <X size={14} />
            </button>
          </div>
        )}
        {modal && (
          <AuthModal
            modal={modal}
            close={close}
            busy={busy}
            error={error}
            setModal={setModal}
            submit={(form) =>
              action(async () => {
                const r = await api("/auth/" + modal.mode, {
                  method: "POST",
                  body: JSON.stringify(form),
                });
                setUser(r.user);
                close();
                await refresh();
              })
            }
          />
        )}
      </div>
    );
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobile ? "mobile-open" : "")}>
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("workspace");
          }}
        >
          <Mark />
          parcel<span className="beta">BETA</span>
        </a>
        <button
          className="workspace-switch"
          onClick={() => navigate("settings")}
        >
          <span className="workspace-avatar">{user.name[0]}</span>
          <span>
            <b>
              {user.demo
                ? "Studio workspace"
                : user.name.split(" ")[0] + "’s workspace"}
            </b>
            <small>{user.demo ? "Personal demo" : "Personal workspace"}</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <span className="nav-label">YOUR SPACE</span>
        <nav>
          {[
            [LayoutGrid, "workspace", "All tools", tools.length],
            [
              Star,
              "favorites",
              "Favorites",
              tools.filter((t) => t.favorite).length,
            ],
            [Layers, "templates", "Templates", null],
            [Activity, "activity", "Activity", null],
          ].map(([Icon, key, label, count]) => (
            <button
              key={key}
              className={"nav-item " + (page === key ? "selected" : "")}
              onClick={() => navigate(key)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {count !== null && <small>{count}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span>Small is a superpower.</span>
            <p>
              One useful tool can change
              <br />
              your whole team’s day.
            </p>
            <button onClick={() => navigate("templates")}>
              Find your next idea <ArrowUpRight size={15} />
            </button>
            <span className="note-star">✳</span>
          </div>
          <button
            className={"nav-item " + (page === "settings" ? "selected" : "")}
            onClick={() => navigate("settings")}
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
          <div className="profile">
            <span className="avatar">
              {user.name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <b>{user.name}</b>
              <small>{user.demo ? "Demo account" : "Workspace owner"}</small>
            </div>
            <button
              aria-label="Sign out"
              title="Sign out"
              onClick={() =>
                action(async () => {
                  await api("/logout", { method: "POST" });
                  setUser(null);
                  setActive(null);
                  setPage("workspace");
                  setTools([]);
                })
              }
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-wrap">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-toggle"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <b>
              {page === "tool"
                ? active?.name
                : {
                    workspace: "All tools",
                    favorites: "Favorites",
                    templates: "Templates",
                    activity: "Activity",
                    settings: "Settings",
                  }[page]}
            </b>
          </div>
          <div className="topbar-right">
            <span className="saved">
              <span className="live-dot" />{" "}
              {busy
                ? "Saving…"
                : error
                  ? "Action needs attention"
                  : "All changes saved"}
            </span>
            <button
              className="help-button"
              onClick={() => setModal({ kind: "about" })}
              aria-label="About Parcel"
            >
              ?
            </button>
            <span className="avatar tiny">{user.name[0]}</span>
          </div>
        </header>
        <main>
          {error && !modal && (
            <div className="error-banner" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {(page === "workspace" || page === "favorites") && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    YOUR LITTLE CORNER OF THE INTERNET
                  </span>
                  <h1>
                    {page === "favorites"
                      ? "The ones you love."
                      : "Good things come in small tools."}
                  </h1>
                  <p>
                    {page === "favorites"
                      ? "Your everyday essentials, all together."
                      : "A home for the little things that make your team work better."}
                  </p>
                </div>
                <button className="button dark" onClick={() => create()}>
                  <Plus size={18} /> Create a tool
                </button>
              </div>
              {page === "workspace" && (
                <>
                  <section className="hero-banner">
                    <div>
                      <span className="eyebrow">LESS FRICTION. MORE FLOW.</span>
                      <h2>
                        From “we need a tool”
                        <br />
                        to <span>“here’s the link.”</span>
                      </h2>
                      <p>Start with a template. Make it yours. Pass it on.</p>
                      <button
                        className="text-button"
                        onClick={() => navigate("templates")}
                      >
                        Explore templates <ArrowUpRight size={17} />
                      </button>
                    </div>
                    <div className="banner-art" aria-hidden="true">
                      <div className="connector c-one" />
                      <div className="connector c-two" />
                      <div className="tile tile-receipt">
                        <Receipt size={31} />
                        <span>Track it.</span>
                      </div>
                      <div className="tile tile-check">
                        <CheckSquare size={31} />
                        <span>Ship it.</span>
                      </div>
                      <div className="tile tile-share">
                        <ArrowUpRight size={33} />
                        <span>Share it.</span>
                      </div>
                      <span className="banner-spark">✳</span>
                      <span className="banner-scribble">
                        little tools, big possibilities
                      </span>
                    </div>
                  </section>
                  <div className="stats-row">
                    <div>
                      <span className="stat-icon">
                        <Box size={17} />
                      </span>
                      <b>{tools.length}</b>
                      <span>tools in your workspace</span>
                    </div>
                    <div>
                      <span className="stat-icon">
                        <Globe size={17} />
                      </span>
                      <b>{tools.filter((t) => t.share).length}</b>
                      <span>shared with a link</span>
                    </div>
                    <div>
                      <span className="stat-icon">
                        <Layers size={17} />
                      </span>
                      <b>{total}</b>
                      <span>records, neatly organized</span>
                    </div>
                  </div>
                </>
              )}
              <div className="section-toolbar">
                <div className="tabs">
                  {[
                    ["all", "All tools"],
                    ["private", "Private"],
                    ["shared", "Shared"],
                  ].map(([key, label]) => (
                    <button
                      className={filter === key ? "active" : ""}
                      key={key}
                      onClick={() => setFilter(key)}
                    >
                      {label}
                      {key === "all" && (
                        <span>
                          {page === "favorites"
                            ? tools.filter((t) => t.favorite).length
                            : tools.length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <label className="search">
                  <Search size={16} />
                  <input
                    id="search"
                    placeholder="Find a little tool…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <kbd>⌘ K</kbd>
                </label>
              </div>
              <div className="tools-grid">
                {filtered.map((t) => (
                  <ToolCard
                    key={t.id}
                    tool={t}
                    open={() => openTool(t.id)}
                    favorite={(e) => favorite(t, e)}
                  />
                ))}
                {page === "workspace" && !query && filter === "all" && (
                  <button className="new-card" onClick={() => create()}>
                    <span>
                      <Plus size={25} />
                    </span>
                    <h3>Room for your next idea.</h3>
                    <p>
                      Turn a small problem into
                      <br />
                      your team’s favorite tool.
                    </p>
                    <b>
                      Create a tool <ArrowRight size={15} />
                    </b>
                  </button>
                )}
              </div>
              {filtered.length === 0 &&
                (query || page === "favorites" || filter !== "all") && (
                  <div className="empty">
                    <Search size={28} />
                    <h3>
                      {query
                        ? "No tools found"
                        : page === "favorites"
                          ? "Keep your favorites close"
                          : "Nothing here just yet"}
                    </h3>
                    <p>
                      {query
                        ? "Try another name or description."
                        : page === "favorites"
                          ? "Tap the star on a tool to find it here."
                          : "Create a tool or change the filter to see more."}
                    </p>
                  </div>
                )}
              <div className="workspace-footer">
                <span>
                  <Lock size={13} /> Your tools are private until you share
                  them.
                </span>
                <span>
                  A little more organized. A lot more possible.{" "}
                  <span className="asterisk">✳</span>
                </span>
              </div>
            </>
          )}
          {page === "templates" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">SKIP THE BLANK CANVAS</span>
                  <h1>A small start. A big head start.</h1>
                  <p>
                    Thoughtful building blocks for your team’s everyday work.
                  </p>
                </div>
              </div>
              <div className="template-grid">
                {Object.entries(templates).map(([type, t]) => (
                  <div className="template-card" key={type}>
                    <ToolCover type={type} color={t.color} />
                    <div>
                      <span className="eyebrow">READY TO MAKE YOURS</span>
                      <h2>{t.name}</h2>
                      <p>{t.description}</p>
                      <ul>
                        {t.fields.slice(0, 3).map((f) => (
                          <li key={f.key}>
                            <Check size={14} />
                            {f.label}
                          </li>
                        ))}
                      </ul>
                      <button
                        className="button dark"
                        onClick={() => create(type)}
                      >
                        Use template <ArrowUpRight size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="callout">
                <Layers size={24} />
                <div>
                  <b>Useful by design.</b>
                  <p>
                    Every template includes editable records, search, CSV
                    export, and revocable sharing. Start empty or explore with
                    sample data.
                  </p>
                </div>
              </div>
            </>
          )}
          {page === "activity" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">THE LITTLE THINGS ADD UP</span>
                  <h1>Your workspace, in motion.</h1>
                  <p>The latest 100 changes in your space.</p>
                </div>
              </div>
              <div className="activity-list">
                {events.length ? (
                  events.map((e) => (
                    <div key={e.id}>
                      <span className="activity-icon">
                        <Activity size={17} />
                      </span>
                      <div>
                        <b>{e.message}</b>
                        <small>{new Date(e.created).toLocaleString()}</small>
                      </div>
                      <span className="event-dot" />
                    </div>
                  ))
                ) : (
                  <div className="empty">
                    Create your first tool to get things moving.
                  </div>
                )}
              </div>
            </>
          )}
          {page === "settings" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">MAKE YOURSELF AT HOME</span>
                  <h1>The details of your space.</h1>
                  <p>A simple workspace. Yours to shape.</p>
                </div>
              </div>
              <section className="settings-card">
                <h2>Your account</h2>
                <div className="setting-row">
                  <span>Name</span>
                  <b>{user.name}</b>
                </div>
                <div className="setting-row">
                  <span>Email</span>
                  <b>{user.demo ? "Temporary demo account" : user.email}</b>
                </div>
                <div className="setting-row">
                  <span>Workspace</span>
                  <b>
                    {tools.length} tools · {total} records
                  </b>
                </div>
                {user.demo && (
                  <div className="callout">
                    <ShieldCheck size={24} />
                    <div>
                      <b>Make this space yours.</b>
                      <p>
                        Create an account to keep access to this demo workspace
                        after signing out.
                      </p>
                      <button
                        className="button dark"
                        onClick={() =>
                          setModal({ kind: "auth", mode: "upgrade" })
                        }
                      >
                        Save my workspace <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </section>
              <section className="settings-card">
                <h2>Simple, intentional sharing</h2>
                <p>
                  Tools start private. When you enable a link, anyone with it
                  can view and export that tool’s records. Revoke a link at any
                  time from the tool’s Share menu.
                </p>
                <p>
                  Account access uses secure password hashing and HTTP-only
                  session cookies. This release supports personal workspaces and
                  view-only sharing.
                </p>
              </section>
            </>
          )}
          {page === "tool" && active && (
            <>
              <button
                className="back-button"
                onClick={() => navigate("workspace")}
              >
                <ArrowLeft size={15} /> Back to your tools
              </button>
              <ToolView
                active={active}
                templates={templates}
                query={query}
                setQuery={setQuery}
                exportCSV={exportCSV}
                add={() => setModal({ kind: "record" })}
                edit={(r) => setModal({ kind: "record", record: r })}
                share={() => setModal({ kind: "share" })}
                remove={() => setModal({ kind: "deleteTool" })}
              />
            </>
          )}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {modal && modal.kind === "auth" && (
        <AuthModal
          modal={modal}
          close={close}
          busy={busy}
          error={error}
          setModal={setModal}
          submit={(form) =>
            action(async () => {
              const r = await api("/auth/" + modal.mode, {
                method: "POST",
                body: JSON.stringify(form),
              });
              setUser(r.user);
              close();
              notify("Your workspace is yours to keep.");
            })
          }
        />
      )}
      {modal && modal.kind !== "auth" && (
        <Modal
          close={close}
          title={
            {
              create: "A little tool. All yours.",
              record: modal.record ? "Edit record" : "Add something useful",
              share: "Good things are made to be shared.",
              deleteTool: "Delete this tool?",
              about: "Small software, shared simply.",
            }[modal.kind]
          }
        >
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {modal.kind === "create" && (
            <CreateForm
              templates={templates}
              initialType={modal.type}
              busy={busy}
              submit={(form) =>
                action(async () => {
                  const t = await api("/tools", {
                    method: "POST",
                    body: JSON.stringify(form),
                  });
                  await refresh();
                  setActive(t);
                  setPage("tool");
                  setQuery("");
                  close();
                  notify("Your new tool is ready. Make it yours.");
                })
              }
            />
          )}
          {modal.kind === "record" && (
            <RecordForm
              fields={templates[active.type].fields}
              record={modal.record}
              busy={busy}
              submit={(data) =>
                action(async () => {
                  await api(
                    "/tools/" +
                      active.id +
                      "/records" +
                      (modal.record ? "/" + modal.record.id : ""),
                    {
                      method: modal.record ? "PUT" : "POST",
                      body: JSON.stringify(data),
                    },
                  );
                  await reloadActive();
                  close();
                  notify("Record saved");
                })
              }
              remove={() =>
                setModal({
                  kind: "record",
                  record: modal.record,
                  confirmDelete: true,
                })
              }
              confirmDelete={modal.confirmDelete}
              cancelDelete={() => setModal({ ...modal, confirmDelete: false })}
              deleteRecord={() =>
                action(async () => {
                  await api(
                    "/tools/" + active.id + "/records/" + modal.record.id,
                    { method: "DELETE" },
                  );
                  await reloadActive();
                  close();
                  notify("Record deleted");
                })
              }
            />
          )}
          {modal.kind === "share" && (
            <>
              <p className="modal-description">
                Share <b>{active.name}</b> with a simple link. Anyone with the
                link can view and export its records.
              </p>
              <div className="share-access">
                <span className="access-icon">
                  {active.share ? <Globe size={22} /> : <Lock size={22} />}
                </span>
                <div>
                  <b>{active.share ? "Anyone with the link" : "Only you"}</b>
                  <small>
                    {active.share
                      ? "View-only access · no sign-in required"
                      : "This tool is private"}
                  </small>
                </div>
                <span className="pill">
                  {active.share ? "Viewer" : "Private"}
                </span>
              </div>
              {active.share ? (
                <>
                  <label className="field">
                    Shareable link
                    <input
                      readOnly
                      value={location.origin + "/s/" + active.share}
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                  <div className="row">
                    <button
                      className="button dark"
                      onClick={() =>
                        action(async () => {
                          await navigator.clipboard.writeText(
                            location.origin + "/s/" + active.share,
                          );
                          notify("Link copied to clipboard");
                        })
                      }
                    >
                      <Copy size={16} /> Copy link
                    </button>
                    <a
                      className="button outline"
                      target="_blank"
                      rel="noreferrer"
                      href={"/s/" + active.share}
                    >
                      Open <ExternalLink size={15} />
                    </a>
                  </div>
                  <button
                    className="danger-link"
                    disabled={busy}
                    onClick={() =>
                      action(async () => {
                        await api("/tools/" + active.id + "/share", {
                          method: "DELETE",
                        });
                        await reloadActive();
                        notify("Link revoked. Your tool is private.");
                      })
                    }
                  >
                    Revoke link access
                  </button>
                </>
              ) : (
                <button
                  className="button dark full"
                  disabled={busy}
                  onClick={() =>
                    action(async () => {
                      await api("/tools/" + active.id + "/share", {
                        method: "POST",
                      });
                      await reloadActive();
                      notify("Your view-only link is ready");
                    })
                  }
                >
                  <Link size={16} /> Enable sharing link
                </button>
              )}
              <p className="fine-print">
                <ShieldCheck size={14} /> You control access. Revoking
                immediately disables this link.
              </p>
            </>
          )}
          {modal.kind === "deleteTool" && (
            <>
              <p className="modal-description">
                This will permanently delete <b>{active.name}</b> and its{" "}
                {active.records.length} records. Any shared link will stop
                working.
              </p>
              <div className="row">
                <button
                  className="button danger"
                  disabled={busy}
                  onClick={() =>
                    action(async () => {
                      await api("/tools/" + active.id, { method: "DELETE" });
                      await refresh();
                      navigate("workspace");
                      close();
                      notify("Tool deleted");
                    })
                  }
                >
                  Delete tool
                </button>
                <button className="button outline" onClick={close}>
                  Keep it
                </button>
              </div>
            </>
          )}
          {modal.kind === "about" && (
            <>
              <div className="about-mark">
                <Mark />
              </div>
              <p className="modal-description">
                Parcel gives your team’s little tools a proper home. Start with
                a template, add your data, and share a view-only link.
              </p>
              <div className="callout">
                <Command size={20} />
                <div>
                  <b>A shortcut to your shortcuts</b>
                  <p>Press ⌘ K or Ctrl K to jump to search.</p>
                </div>
              </div>
              <p className="fine-print">
                An early release for personal workspaces. Custom code hosting
                and team roles are not available yet.
              </p>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
function ToolCover({ type, color }) {
  const Icon = icons[type];
  return (
    <div className={"tool-cover " + color}>
      <div className="cover-grid" />
      {type === "expenses" ? (
        <div className="receipt-art">
          <span>THE LITTLE THINGS</span>
          <div>
            <i /> <b>$144.00</b>
          </div>
          <div>
            <i /> <b>$86.50</b>
          </div>
          <div className="receipt-total">
            ALL SORTED <Check size={14} />
          </div>
        </div>
      ) : type === "contacts" ? (
        <div className="people-art">
          <span>AM</span>
          <span>JC</span>
          <span>SR</span>
          <span className="people-plus">+</span>
        </div>
      ) : (
        <div className="check-art">
          <div>
            <Check size={16} />
            <span />
          </div>
          <div>
            <Check size={16} />
            <span />
          </div>
          <div>
            <i />
            <span />
          </div>
        </div>
      )}
      <span className="cover-icon">
        <Icon size={19} />
      </span>
      <span className="cover-caption">
        {type === "expenses"
          ? "A little less admin."
          : type === "contacts"
            ? "A little more connected."
            : "A little closer to done."}
      </span>
    </div>
  );
}
function ToolCard({ tool: t, open, favorite }) {
  const Icon = icons[t.type];
  return (
    <article className="tool-card">
      <button
        className="card-open"
        onClick={open}
        aria-label={"Open " + t.name}
      >
        <ToolCover type={t.type} color={t.color} />
        <div className="card-content">
          <div className="card-title">
            <h3>{t.name}</h3>
            <ArrowUpRight size={17} />
          </div>
          <p>{t.description}</p>
          <div className="card-meta">
            <span>
              <Icon size={13} />
              {t.record_count} records
            </span>
            <span className={t.share ? "shared-badge" : ""}>
              {t.share ? <Globe size={12} /> : <Lock size={12} />}{" "}
              {t.share ? "Shared" : "Private"}
            </span>
          </div>
        </div>
      </button>
      <button
        className={"favorite " + (t.favorite ? "is-favorite" : "")}
        aria-label={(t.favorite ? "Unfavorite " : "Favorite ") + t.name}
        onClick={favorite}
      >
        <Star size={16} fill={t.favorite ? "currentColor" : "none"} />
      </button>
    </article>
  );
}
function ToolView({
  active: t,
  templates,
  query,
  setQuery,
  shared,
  exportCSV,
  add,
  edit,
  share,
  remove,
}) {
  const template = templates[t.type],
    fields = template.fields,
    records = t.records.filter((r) =>
      Object.values(r.data)
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  const Icon = icons[t.type];
  return (
    <>
      <div className="detail-heading">
        <div className={"detail-icon " + t.color}>
          <Icon size={28} />
        </div>
        <div>
          <span className="eyebrow">
            {shared
              ? "A PARCEL, SHARED WITH YOU"
              : "YOUR TOOL · " + (t.share ? "SHARED" : "PRIVATE")}
          </span>
          <h1>{t.name}</h1>
          <p>{t.description}</p>
        </div>
        {!shared && (
          <button className="button dark" onClick={share}>
            <Link size={16} /> Share tool
          </button>
        )}
      </div>
      <div className="tool-metrics">
        <div>
          <span>Total records</span>
          <b>{t.records.length}</b>
        </div>
        {t.type === "expenses" ? (
          <>
            <div>
              <span>Total expenses</span>
              <b>{money(t.records.reduce((n, r) => n + r.data.amount, 0))}</b>
            </div>
            <div>
              <span>Awaiting approval</span>
              <b>
                {t.records.filter((r) => r.data.status === "Pending").length}
              </b>
            </div>
          </>
        ) : t.type === "checklist" ? (
          <>
            <div>
              <span>Completed</span>
              <b>{t.records.filter((r) => r.data.status === "Done").length}</b>
            </div>
            <div>
              <span>Progress</span>
              <b>
                {t.records.length
                  ? Math.round(
                      (t.records.filter((r) => r.data.status === "Done")
                        .length /
                        t.records.length) *
                        100,
                    )
                  : 0}
                %
              </b>
            </div>
          </>
        ) : (
          <>
            <div>
              <span>Teams</span>
              <b>{new Set(t.records.map((r) => r.data.team)).size}</b>
            </div>
            <div>
              <span>Locations</span>
              <b>
                {
                  new Set(t.records.map((r) => r.data.location).filter(Boolean))
                    .size
                }
              </b>
            </div>
          </>
        )}
      </div>
      <div className="section-toolbar">
        <label className="search">
          <Search size={16} />
          <input
            id="search"
            placeholder="Search records…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="row">
          <button className="button outline" onClick={exportCSV}>
            <Download size={15} /> Export CSV
          </button>
          {!shared && (
            <button className="button dark" onClick={add}>
              <Plus size={16} /> Add record
            </button>
          )}
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {fields.map((f) => (
                <th key={f.key}>{f.label}</th>
              ))}
              {!shared && (
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                {fields.map((f, i) => (
                  <td key={f.key} className={i === 0 ? "primary-cell" : ""}>
                    {f.options ? (
                      <span
                        className={
                          "status status-" +
                          String(r.data[f.key])
                            .toLowerCase()
                            .replaceAll(" ", "-")
                        }
                      >
                        {r.data[f.key]}
                      </span>
                    ) : f.type === "number" ? (
                      money(r.data[f.key])
                    ) : (
                      r.data[f.key] || "—"
                    )}
                  </td>
                ))}
                {!shared && (
                  <td>
                    <button
                      className="icon-button"
                      aria-label={"Edit " + r.data[fields[0].key]}
                      onClick={() => edit(r)}
                    >
                      <Pencil size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!records.length && (
          <div className="empty">
            <Box size={28} />
            <h3>{query ? "No matching records" : "A fresh start"}</h3>
            <p>
              {query
                ? "Try a different search."
                : "Add your first record to make this tool your own."}
            </p>
            {!shared && !query && (
              <button className="button dark" onClick={add}>
                <Plus size={16} /> Add record
              </button>
            )}
          </div>
        )}
      </div>
      <div className="table-footer">
        <span>
          {records.length} of {t.records.length} records
        </span>
        {shared ? (
          <span>
            <Lock size={12} /> View-only shared tool
          </span>
        ) : (
          <button className="danger-link" onClick={remove}>
            <Trash2 size={13} /> Delete tool
          </button>
        )}
      </div>
    </>
  );
}
function Modal({ title, children, close }) {
  const ref = useRef(),
    previous = useRef(document.activeElement);
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const els = [
          ...ref.current.querySelectorAll(
            'button:not(:disabled),a,input,select,textarea,[tabindex="0"]',
          ),
        ];
        const first = els[0],
          last = els.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", key);
      previous.current?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-heading">
          <h2 id="dialog-title">{title}</h2>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function CreateForm({ templates, initialType, busy, submit }) {
  const [type, setType] = useState(initialType),
    [name, setName] = useState(templates[initialType].name),
    [description, setDescription] = useState(
      templates[initialType].description,
    ),
    [sample, setSample] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit({ type, name, description, sample });
      }}
    >
      <p className="modal-description">
        Pick a starting point. We’ll take care of the structure.
      </p>
      <div className="template-picker">
        {Object.entries(templates).map(([key, t]) => {
          const Icon = icons[key];
          return (
            <button
              type="button"
              key={key}
              onClick={() => {
                setType(key);
                setName(t.name);
                setDescription(t.description);
              }}
              className={type === key ? "chosen" : ""}
            >
              <Icon size={22} />
              <span>{t.name}</span>
              {type === key && <Check size={13} />}
            </button>
          );
        })}
      </div>
      <label className="field">
        Tool name
        <input
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field">
        A little description
        <textarea
          maxLength={240}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={sample}
          onChange={(e) => setSample(e.target.checked)}
        />
        <span>
          Include sample records
          <small>Try it out with a little inspiration.</small>
        </span>
      </label>
      <button className="button dark full" disabled={busy}>
        {busy ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}{" "}
        Create tool
      </button>
      <p className="fine-print">
        <Lock size={13} /> Private by default. Share whenever you’re ready.
      </p>
    </form>
  );
}
function RecordForm({
  fields,
  record,
  busy,
  submit,
  remove,
  confirmDelete,
  cancelDelete,
  deleteRecord,
}) {
  const [data, setData] = useState(
    record?.data ||
      Object.fromEntries(fields.map((f) => [f.key, f.options?.[0] || ""])),
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(data);
      }}
    >
      {fields.map((f) => (
        <label className="field" key={f.key}>
          {f.label}
          {f.required ? " *" : ""}
          {f.options ? (
            <select
              value={data[f.key]}
              onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
            >
              {f.options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : (
            <input
              type={f.type || "text"}
              required={f.required}
              maxLength={500}
              min={f.type === "number" ? 0 : undefined}
              step={f.type === "number" ? "0.01" : undefined}
              value={data[f.key]}
              onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
            />
          )}
        </label>
      ))}
      <button className="button dark full" disabled={busy}>
        <Check size={16} />
        {record ? "Save changes" : "Add record"}
      </button>
      {record &&
        (confirmDelete ? (
          <div className="delete-confirm">
            <p>Permanently delete this record?</p>
            <div className="row">
              <button
                type="button"
                className="button danger"
                disabled={busy}
                onClick={deleteRecord}
              >
                Yes, delete
              </button>
              <button
                type="button"
                className="button outline"
                onClick={cancelDelete}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="danger-link" type="button" onClick={remove}>
            Delete record
          </button>
        ))}
    </form>
  );
}
function AuthModal({ modal, close, busy, error, setModal, submit }) {
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const login = modal.mode === "login";
  return (
    <Modal
      close={close}
      title={
        login
          ? "Welcome back."
          : modal.mode === "upgrade"
            ? "Make this workspace yours."
            : "Make room for good things."
      }
    >
      <p className="modal-description">
        {login
          ? "Your little tools are right where you left them."
          : "A personal workspace for your team’s next useful thing."}
      </p>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit({ name, email, password });
        }}
      >
        {!login && (
          <label className="field">
            Your name
            <input
              autoComplete="name"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        <label className="field">
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            autoComplete={login ? "current-password" : "new-password"}
            minLength={10}
            maxLength={128}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <small>At least 10 characters.</small>
        </label>
        <button className="button dark full" disabled={busy}>
          {busy ? (
            <Loader2 className="spin" size={17} />
          ) : (
            <ArrowRight size={17} />
          )}{" "}
          {login ? "Sign in" : "Create account"}
        </button>
      </form>
      {modal.mode !== "upgrade" && (
        <p className="auth-switch">
          {login ? "New to Parcel?" : "Already have a workspace?"}{" "}
          <button
            onClick={() =>
              setModal({ kind: "auth", mode: login ? "signup" : "login" })
            }
          >
            {login ? "Create an account" : "Sign in"}
          </button>
        </p>
      )}
    </Modal>
  );
}
createRoot(document.getElementById("root")).render(<App />);
