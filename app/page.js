"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

function stamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Home() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [publicNotes, setPublicNotes] = useState([]);
  const [mine, setMine] = useState([]);
  const [hours, setHours] = useState([]);
  const [body, setBody] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    loadPublic();
    loadHours();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setMine([]);
      return;
    }
    loadMine(session.user.id);
    loadProfile(session.user.id);
  }, [session]);

  async function loadPublic() {
    const { data } = await supabase
      .from("notes")
      .select("id, body, created_at, user_id")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(40);
    const notes = data || [];
    const ids = [...new Set(notes.map((n) => n.user_id))];
    let map = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, handle, display_name").in("id", ids);
      (profs || []).forEach((p) => {
        map[p.id] = p;
      });
    }
    setPublicNotes(notes.map((n) => ({ ...n, profiles: map[n.user_id] })));
  }

  async function loadMine(uid) {
    const { data } = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    setMine(data || []);
  }

  async function loadHours() {
    const { data } = await supabase
      .from("hourly_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(12);
    setHours(data || []);
  }

  async function loadProfile(uid) {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    setProfile(data);
  }

  async function auth(e) {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    const fn =
      mode === "signup"
        ? supabase.auth.signUp({ email, password })
        : supabase.auth.signInWithPassword({ email, password });
    const { error } = await fn;
    setBusy(false);
    if (error) setNotice(error.message);
    else if (mode === "signup") setNotice("Check your email if confirmation is on. Otherwise you are in.");
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function publish(e) {
    e.preventDefault();
    if (!session || !body.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("notes").insert({
      user_id: session.user.id,
      body: body.trim(),
      is_public: isPublic,
    });
    setBusy(false);
    if (error) {
      setNotice(error.message);
      return;
    }
    setBody("");
    await Promise.all([loadPublic(), loadMine(session.user.id)]);
  }

  async function togglePublic(note) {
    await supabase.from("notes").update({ is_public: !note.is_public }).eq("id", note.id);
    await Promise.all([loadPublic(), loadMine(session.user.id)]);
  }

  async function remove(note) {
    await supabase.from("notes").delete().eq("id", note.id);
    await Promise.all([loadPublic(), loadMine(session.user.id)]);
  }

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Morning on the porch";
    if (h < 18) return "Afternoon light";
    return "Evening rail";
  }, []);

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <div className="mark">
            <span className="lamp" /> Porch
          </div>
          <h1>{greeting}</h1>
          <p className="lede">
            Write something. Keep it in your pocket, or pin it to the public rail.
            The house changes a little every hour.
          </p>
        </div>
        <div className="nav">
          {session ? (
            <>
              <span className="pill">{profile?.handle || session.user.email}</span>
              <button className="ghost" onClick={signOut}>
                Leave
              </button>
            </>
          ) : null}
        </div>
      </header>

      <div className="grid">
        <section className="panel">
          <h2>The rail</h2>
          <div className="notes">
            {publicNotes.length === 0 && <p className="empty">Quiet so far. First one sets the tone.</p>}
            {publicNotes.map((n) => (
              <article className="note" key={n.id}>
                <p>{n.body}</p>
                <div className="meta">
                  {(n.profiles && (n.profiles.display_name || n.profiles.handle)) || "someone"} · {stamp(n.created_at)}
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside>
          <section className="panel" style={{ marginBottom: 16 }}>
            {session ? (
              <>
                <h2>Leave a note</h2>
                <form className="compose" onSubmit={publish}>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="What is sitting with you?"
                    maxLength={800}
                  />
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                    />
                    Pin to the public rail
                  </label>
                  <button disabled={busy || !body.trim()}>Put it down</button>
                </form>
                {mine.length > 0 && (
                  <div className="notes" style={{ marginTop: 18 }}>
                    {mine.map((n) => (
                      <article className="note" key={n.id}>
                        <p>{n.body}</p>
                        <div className="meta">
                          {n.is_public ? "on the rail" : "in your pocket"} · {stamp(n.created_at)}
                        </div>
                        <div className="row" style={{ marginTop: 8 }}>
                          <button className="ghost" type="button" onClick={() => togglePublic(n)}>
                            {n.is_public ? "Keep private" : "Make public"}
                          </button>
                          <button className="ghost" type="button" onClick={() => remove(n)}>
                            Tear it up
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <h2>{mode === "signup" ? "Take a seat" : "Come in"}</h2>
                <form className="auth" onSubmit={auth}>
                  <input type="email" required placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <input type="password" required minLength={6} placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button disabled={busy}>{mode === "signup" ? "Create a place" : "Step inside"}</button>
                </form>
                <p className="meta">
                  <button className="ghost" type="button" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
                    {mode === "signup" ? "I already have a key" : "I need a key"}
                  </button>
                </p>
              </>
            )}
            {notice && <p className="meta">{notice}</p>}
          </section>

          <section className="panel">
            <h2>What changed this hour</h2>
            {hours.length === 0 && <p className="empty">The first hour has not been written yet.</p>}
            {hours.map((h) => (
              <div className="hour" key={h.id}>
                <strong>{h.title}</strong>
                <p style={{ margin: "6px 0" }}>{h.body}</p>
                <time>{stamp(h.created_at)}</time>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}
