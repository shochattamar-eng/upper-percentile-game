import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://eduozrpdvhkrsabrbbbf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_SU3W871v2lrteKkSGSOuCw_-Mw6os5S";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STORAGE_KEY = "upper_percentile_session";
const QUESTION_TIME = 40;

const MAIN_QUESTIONS = [
  { label: "שאלת ה-90%", prompt: "שאלה ראשונה", type: "multiple", options: ["א", "ב", "ג"], correctAnswers: ["א"] },
  { label: "שאלת ה-80%", prompt: "שאלה 2", type: "multiple", options: ["א", "ב", "ג"], correctAnswers: ["ב"] },
  { label: "שאלת ה-70%", prompt: "שאלה 3", type: "text", correctAnswers: ["אחד", "אחת", "1"] },
  { label: "שאלת ה-60%", prompt: "שאלה 4", type: "multiple", options: ["א", "ב", "ג"], correctAnswers: ["ב"] },
  { label: "שאלת ה-50%", prompt: "שאלה 5", type: "text", correctAnswers: ["פיטבול"] },
  { label: "שאלת ה-40%", prompt: "שאלה 6", type: "text", correctAnswers: ["מ"] },
  { label: "שאלת ה-35%", prompt: "שאלה 7", type: "text", inputMode: "numeric", correctAnswers: ["5"] },
  { label: "שאלת ה-30%", prompt: "שאלה 8", type: "text", correctAnswers: ["בגין", "מנחם בגין"] },
  { label: "שאלת ה-25%", prompt: "שאלה 9", type: "multiple", options: ["א", "ב", "ג", "ד"], correctAnswers: ["ד"] },
  { label: "שאלת ה-20%", prompt: "שאלה 10", type: "multiple", options: ["א", "ב", "ג"], correctAnswers: ["א"] },
  { label: "שאלת ה-15%", prompt: "שאלה 11", type: "text", correctAnswers: ["לוב"] },
  { label: "שאלת ה-10%", prompt: "שאלה 12", type: "text", correctAnswers: ["צמד"] },
  { label: "שאלת ה-5%", prompt: "שאלה 13", type: "text", inputMode: "numeric", correctAnswers: ["20"] },
  { label: "שאלת ה-1%", prompt: "שאלה 14", type: "text", correctAnswers: ["י"] },
];

const BONUS_QUESTIONS = [
  { label: "בונוס 90%", prompt: "שאלת ה-90%", type: "multiple", options: ["א", "ב", "ג"], correctAnswers: ["ג"] },
  { label: "בונוס 70%", prompt: "שאלת ה-70%", type: "text", correctAnswers: ["נאור", "נאור בן חיים"] },
  { label: "בונוס 50%", prompt: "שאלת ה-50%", type: "text", correctAnswers: ["יזהר", "יזהר לוי"] },
  { label: "בונוס 30%", prompt: "שאלת ה-30%", type: "text", correctAnswers: ["להחזיק את המורכבות"] },
  { label: "בונוס 10%", prompt: "שאלת ה-10%", type: "text", correctAnswers: ["אדם", "אדם שגב", "שגב"] },
  { label: "בונוס 1%", prompt: "שאלת ה-1%", type: "text", correctAnswers: ["ל"] },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function roomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function nowIso() {
  return new Date().toISOString();
}

function normalize(v) {
  return String(v ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/״/g, '"')
    .replace(/׳/g, "'")
    .toLowerCase();
}

function isCorrect(question, answer) {
  return question.correctAnswers.some((a) => normalize(a) === normalize(answer));
}

function getSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  const session = { sessionId: uid(), name: "" };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

function setSessionName(name) {
  const s = getSession();
  s.name = name;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function isBonusStatus(status) {
  return String(status).startsWith("bonus_");
}

function isLive(status) {
  return status === "live" || status === "bonus_live";
}

function isResult(status) {
  return status === "result" || status === "bonus_result";
}

function isIdle(status) {
  return status === "idle" || status === "bonus_idle";
}

function isFinished(status) {
  return status === "finished" || status === "bonus_finished";
}

function getQuestions(status) {
  return isBonusStatus(status) ? BONUS_QUESTIONS : MAIN_QUESTIONS;
}

function getQuestionDbIndex(status, questionIndex) {
  return isBonusStatus(status) ? 100 + questionIndex : questionIndex;
}

function card() {
  return { background: "white", borderRadius: 22, padding: 20, boxShadow: "0 10px 30px rgba(0,0,0,0.08)" };
}

function btn(primary = false) {
  return {
    padding: "12px 16px",
    borderRadius: 14,
    border: primary ? "2px solid #111827" : "1px solid #d1d5db",
    background: primary ? "#111827" : "#fff",
    color: primary ? "#fff" : "#111827",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 700,
  };
}

function Page({ children }) {
  return <div style={{ minHeight: "100vh", background: "#f3f4f6", padding: 24, direction: "rtl", fontFamily: "Arial, sans-serif" }}>{children}</div>;
}

async function createRoom(title) {
  const { data, error } = await supabase
    .from("upper_rooms")
    .insert({ code: roomCode(), title, status: "idle", question_index: 0, time_left: QUESTION_TIME, started_at: null, alive_count: 40, skips_count: 0, wrong_count: 0 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getRoomByCode(code) {
  const { data, error } = await supabase.from("upper_rooms").select("*").eq("code", code).maybeSingle();
  if (error) throw error;
  return data;
}

async function getRoom(id) {
  const { data, error } = await supabase.from("upper_rooms").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

async function joinPlayer(roomId, sessionId, name) {
  const existing = await supabase.from("upper_players").select("*").eq("room_id", roomId).eq("session_id", sessionId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;
  const { data, error } = await supabase
    .from("upper_players")
    .insert({ room_id: roomId, session_id: sessionId, name, is_alive: true, skip_used: false, last_correct: null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getPlayers(roomId) {
  const { data, error } = await supabase.from("upper_players").select("*").eq("room_id", roomId).order("created_at");
  if (error) throw error;
  return data || [];
}

async function getPlayerAnswer(roomId, playerId, status, questionIndex) {
  const idx = getQuestionDbIndex(status, questionIndex);
  const { data, error } = await supabase
    .from("upper_answers")
    .select("*")
    .eq("room_id", roomId)
    .eq("player_id", playerId)
    .eq("question_index", idx)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function submitAnswer(roomId, playerId, status, questionIndex, answer, usedSkip = false) {
  const idx = getQuestionDbIndex(status, questionIndex);
  const exists = await getPlayerAnswer(roomId, playerId, status, questionIndex);
  if (exists) return exists;
  const { data, error } = await supabase
    .from("upper_answers")
    .insert({ room_id: roomId, player_id: playerId, question_index: idx, answer, used_skip: usedSkip })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getAnswers(roomId, status, questionIndex) {
  const idx = getQuestionDbIndex(status, questionIndex);
  const { data, error } = await supabase.from("upper_answers").select("*").eq("room_id", roomId).eq("question_index", idx);
  if (error) throw error;
  return data || [];
}

async function startQuestion(room) {
  const nextStatus = isBonusStatus(room.status) ? "bonus_live" : "live";
  const { error } = await supabase
    .from("upper_rooms")
    .update({ status: nextStatus, started_at: nowIso(), time_left: QUESTION_TIME, skips_count: 0, wrong_count: 0 })
    .eq("id", room.id);
  if (error) throw error;
}

async function revealQuestion(room) {
  const questions = getQuestions(room.status);
  const question = questions[room.question_index];
  const answers = await getAnswers(room.id, room.status, room.question_index);
  const players = await getPlayers(room.id);

  let wrongCount = 0;
  let skipsCount = 0;
  let aliveCount = 0;

  for (const player of players) {
    const ans = answers.find((a) => a.player_id === player.id);
    const usedSkip = Boolean(ans?.used_skip);
    let correct = false;

    if (usedSkip) {
      correct = true;
      skipsCount += 1;
    } else if (ans) {
      correct = isCorrect(question, ans.answer || "");
    }

    const patch = { last_correct: correct };

    if (player.is_alive) {
      if (correct) {
        aliveCount += 1;
      } else {
        patch.is_alive = false;
        wrongCount += 1;
      }
    }

    if (usedSkip) patch.skip_used = true;

    const { error } = await supabase.from("upper_players").update(patch).eq("id", player.id);
    if (error) throw error;
  }

  const nextStatus = isBonusStatus(room.status) ? "bonus_result" : "result";
  const { error } = await supabase.from("upper_rooms").update({ status: nextStatus, wrong_count: wrongCount, skips_count: skipsCount, alive_count: aliveCount }).eq("id", room.id);
  if (error) throw error;
}

async function nextQuestion(room) {
  const questions = getQuestions(room.status);
  const lastIndex = questions.length - 1;
  const isBonus = isBonusStatus(room.status);

  if (room.question_index >= lastIndex) {
    const finalStatus = isBonus ? "bonus_finished" : "finished";
    const { error } = await supabase.from("upper_rooms").update({ status: finalStatus }).eq("id", room.id);
    if (error) throw error;
    return;
  }

  const nextStatus = isBonus ? "bonus_idle" : "idle";
  const { error } = await supabase
    .from("upper_rooms")
    .update({ question_index: room.question_index + 1, status: nextStatus, started_at: null, wrong_count: 0, skips_count: 0 })
    .eq("id", room.id);
  if (error) throw error;
}

async function startBonusRound(room) {
  const players = await getPlayers(room.id);
  for (const player of players) {
    const { error } = await supabase.from("upper_players").update({ is_alive: true, last_correct: null }).eq("id", player.id);
    if (error) throw error;
  }
  const { error } = await supabase
    .from("upper_rooms")
    .update({ status: "bonus_idle", question_index: 0, started_at: null, wrong_count: 0, skips_count: 0, alive_count: players.length })
    .eq("id", room.id);
  if (error) throw error;
}

function Logo() {
  return (
    <div style={{ textAlign: "center", marginBottom: 20 }}>
      <img src="/logo.webp" alt="האחוזון העליון" style={{ maxWidth: 220, width: "100%", height: "auto" }} onError={(e) => (e.currentTarget.style.display = "none")} />
      <div style={{ fontSize: 30, fontWeight: 800, marginTop: 6 }}>האחוזון העליון</div>
    </div>
  );
}

function Home({ onCreate, onJoin }) {
  const [title, setTitle] = useState("האחוזון העליון");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  return (
    <Page>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <Logo />
        <div style={{ ...card(), maxWidth: 700, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", marginTop: 0 }}>משחק אונליין</h2>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: 14, borderRadius: 12, border: "1px solid #d1d5db", marginBottom: 12, fontSize: 18 }} />
          <button style={{ ...btn(true), width: "100%", marginBottom: 16 }} onClick={async () => { const room = await createRoom(title); onCreate(room); }}>פתח חדר מנחה</button>
          <div style={{ height: 1, background: "#e5e7eb", margin: "16px 0" }} />
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="קוד חדר" style={{ width: "100%", padding: 14, borderRadius: 12, border: "1px solid #d1d5db", marginBottom: 12, fontSize: 18 }} />
          <button style={{ ...btn(), width: "100%" }} onClick={async () => { const room = await getRoomByCode(code); if (!room) { setErr("קוד לא נמצא"); return; } onJoin(room); }}>הצטרפות כשחקן</button>
          {err && <div style={{ color: "#b91c1c", marginTop: 12 }}>{err}</div>}
        </div>
      </div>
    </Page>
  );
}

function Host({ room, onExit }) {
  const [state, setState] = useState(room);
  const [players, setPlayers] = useState([]);

  const questions = useMemo(() => getQuestions(state.status), [state.status]);
  const question = questions[state.question_index] || questions[0];
  const isLastMainResult = state.status === "result" && !isBonusStatus(state.status) && state.question_index === MAIN_QUESTIONS.length - 1;
  const liveSeconds = state.started_at ? Math.max(0, QUESTION_TIME - Math.floor((Date.now() - new Date(state.started_at).getTime()) / 1000)) : QUESTION_TIME;

  async function refresh() {
    const [r, p] = await Promise.all([getRoom(state.id), getPlayers(state.id)]);
    setState(r);
    setPlayers(p);
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (isLive(state.status) && liveSeconds === 0) revealQuestion(state).then(refresh);
  }, [liveSeconds, state.status]);

  return (
    <Page>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Logo />
        <div style={{ ...card(), marginBottom: 16 }}>
          <div><b>קוד חדר:</b> {state.code}</div>
          <div style={{ marginTop: 8, wordBreak: "break-all" }}><b>קישור לשחקנים:</b> {`${window.location.origin}?code=${state.code}`}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
            <button style={btn()} onClick={() => navigator.clipboard.writeText(`${window.location.origin}?code=${state.code}`)}>העתק קישור</button>
            <button style={btn()} onClick={onExit}>יציאה</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 20 }}>
          <div style={card()}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
              <div style={card()}><div style={{ color: "#6b7280", fontSize: 14 }}>מחוברים</div><div style={{ fontSize: 30, fontWeight: 800 }}>{players.length}</div></div>
              <div style={card()}><div style={{ color: "#6b7280", fontSize: 14 }}>עדיין במשחק</div><div style={{ fontSize: 30, fontWeight: 800 }}>{state.alive_count}</div></div>
              <div style={card()}><div style={{ color: "#6b7280", fontSize: 14 }}>נפלו בשאלה</div><div style={{ fontSize: 30, fontWeight: 800 }}>{state.wrong_count}</div></div>
              <div style={card()}><div style={{ color: "#6b7280", fontSize: 14 }}>דילגו</div><div style={{ fontSize: 30, fontWeight: 800 }}>{isBonusStatus(state.status) ? 0 : state.skips_count}</div></div>
            </div>

            <div style={{ color: "#6b7280", marginBottom: 8 }}>{isBonusStatus(state.status) ? "סבב בונוס" : "משחק ראשי"} · {question.label}</div>
            <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 12 }}>{question.prompt}</div>

            {isLive(state.status) && <div style={{ background: "#eff6ff", color: "#1d4ed8", padding: 14, borderRadius: 14, textAlign: "center", fontWeight: 800, marginBottom: 14 }}>נותרו {liveSeconds} שניות</div>}
            {isResult(state.status) && <div style={{ background: "#f3f4f6", padding: 14, borderRadius: 14, textAlign: "center", fontWeight: 800, marginBottom: 14 }}>השאלה הסתיימה</div>}
            {isFinished(state.status) && <div style={{ background: "#fef3c7", padding: 14, borderRadius: 14, textAlign: "center", fontWeight: 800, marginBottom: 14 }}>הסבב הסתיים</div>}

            {question.type === "multiple" ? (
              <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
                {question.options.map((opt, i) => <div key={i} style={{ padding: 14, borderRadius: 12, border: "1px solid #d1d5db", background: isResult(state.status) && question.correctAnswers.includes(opt) ? "#dcfce7" : "#fff" }}>{opt}</div>)}
              </div>
            ) : (
              <div style={{ padding: 14, borderRadius: 12, border: "1px solid #d1d5db", background: "#fafafa", marginBottom: 16 }}>
                תשובה בתיבת טקסט
                {isResult(state.status) && <div style={{ marginTop: 8, color: "#166534", fontWeight: 700 }}>תשובה נכונה: {question.correctAnswers.join(" / ")}</div>}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {isIdle(state.status) && <button style={btn(true)} onClick={async () => { await startQuestion(state); refresh(); }}>התחל שאלה</button>}
              {isResult(state.status) && !isLastMainResult && <button style={btn()} onClick={async () => { await nextQuestion(state); refresh(); }}>שאלה הבאה</button>}
              {isLastMainResult && <button style={btn(true)} onClick={async () => { await startBonusRound(state); refresh(); }}>התחל סבב בונוס</button>}
            </div>
          </div>

          <div style={card()}>
            <h3 style={{ marginTop: 0 }}>שחקנים</h3>
            <div style={{ display: "grid", gap: 10 }}>
              {players.map((p) => (
                <div key={p.id} style={{ padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div style={{ color: "#6b7280", fontSize: 14 }}>{p.is_alive ? "פעיל" : "לא נספר פעיל"}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: p.is_alive ? "#15803d" : "#9ca3af" }}>{p.is_alive ? "במשחק" : "ממשיך מהצד"}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}

function Player({ room, onExit }) {
  const session = getSession();
  const [state, setState] = useState(room);
  const [player, setPlayer] = useState(null);
  const [name, setName] = useState(session.name || "");
  const [draftText, setDraftText] = useState("");
  const [draftChoice, setDraftChoice] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const questions = useMemo(() => getQuestions(state.status), [state.status]);
  const question = questions[state.question_index] || questions[0];
  const showSkip = !isBonusStatus(state.status) && state.question_index >= 4 && isLive(state.status) && player?.is_alive && !player?.skip_used;
  const liveSeconds = state.started_at ? Math.max(0, QUESTION_TIME - Math.floor((Date.now() - new Date(state.started_at).getTime()) / 1000)) : QUESTION_TIME;

  async function refresh() {
    const [r, players] = await Promise.all([getRoom(state.id), getPlayers(state.id)]);
    setState(r);
    const me = players.find((p) => p.session_id === session.sessionId) || null;
    setPlayer(me);
    if (me) {
      const ans = await getPlayerAnswer(r.id, me.id, r.status, r.question_index);
      setSubmitted(Boolean(ans));
      if (ans) {
        setDraftText(ans.answer || "");
        setDraftChoice(ans.answer || null);
      }
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setDraftText("");
    setDraftChoice(null);
    setSubmitted(false);
    if (player) getPlayerAnswer(state.id, player.id, state.status, state.question_index).then((ans) => {
      if (ans) {
        setSubmitted(true);
        setDraftText(ans.answer || "");
        setDraftChoice(ans.answer || null);
      }
    });
  }, [state.question_index, state.status]);

  async function join() {
    setSessionName(name);
    await joinPlayer(state.id, session.sessionId, name);
    refresh();
  }

  async function submitCurrent() {
    if (!player || submitted || !isLive(state.status)) return;
    const value = question.type === "multiple" ? draftChoice : draftText;
    if (!String(value || "").trim()) return;
    await submitAnswer(state.id, player.id, state.status, state.question_index, value, false);
    setSubmitted(true);
    refresh();
  }

  async function doSkip() {
    if (!player || submitted || !showSkip) return;
    await submitAnswer(state.id, player.id, state.status, state.question_index, "SKIP", true);
    setSubmitted(true);
    refresh();
  }

  return (
    <Page>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <Logo />
        {!player ? (
          <div style={{ ...card(), maxWidth: 650, margin: "0 auto" }}>
            <h2 style={{ marginTop: 0 }}>כניסה למשחק</h2>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="השם שלך" style={{ width: "100%", padding: 14, borderRadius: 12, border: "1px solid #d1d5db", marginBottom: 12, fontSize: 18 }} />
            <button style={{ ...btn(true), marginLeft: 12 }} onClick={join}>הצטרפי למשחק</button>
            <button style={btn()} onClick={onExit}>חזרה</button>
          </div>
        ) : (
          <div style={{ ...card(), maxWidth: 850, margin: "0 auto" }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <div style={{ padding: "10px 14px", borderRadius: 999, background: player.is_alive ? "#dcfce7" : "#e5e7eb" }}>{player.is_alive ? "פעיל במשחק" : "לא נספר פעיל, אבל ממשיך לענות"}</div>
              {showSkip && <div style={{ padding: "10px 14px", borderRadius: 999, background: "#ede9fe" }}>אפשר לדלג בשאלה הזאת</div>}
              {isBonusStatus(state.status) && <div style={{ padding: "10px 14px", borderRadius: 999, background: "#fef3c7" }}>סבב בונוס · בלי דלג</div>}
            </div>

            <div style={{ color: "#6b7280", marginBottom: 8 }}>{question.label}</div>
            <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 16 }}>{question.prompt}</div>

            {isLive(state.status) && <div style={{ background: "#eff6ff", color: "#1d4ed8", padding: 14, borderRadius: 14, textAlign: "center", fontWeight: 800, marginBottom: 16 }}>נותרו {liveSeconds} שניות</div>}
            {isIdle(state.status) && <div style={{ background: "#f3f4f6", padding: 14, borderRadius: 14, textAlign: "center", fontWeight: 800, marginBottom: 16 }}>ממתינים למנחה</div>}
            {isResult(state.status) && <div style={{ background: player.last_correct ? "#dcfce7" : "#fee2e2", padding: 14, borderRadius: 14, textAlign: "center", fontWeight: 800, marginBottom: 16 }}>{player.last_correct ? "צדקת" : "טעית"}</div>}

            {question.type === "multiple" ? (
              <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
                {question.options.map((opt, i) => (
                  <button key={i} disabled={!isLive(state.status) || submitted} onClick={() => setDraftChoice(opt)} style={{ padding: 14, borderRadius: 12, border: draftChoice === opt ? "2px solid #111827" : "1px solid #d1d5db", background: draftChoice === opt ? "#111827" : "#fff", color: draftChoice === opt ? "#fff" : "#111827", fontSize: 18, cursor: "pointer" }}>{opt}</button>
                ))}
              </div>
            ) : (
              <input value={draftText} onChange={(e) => setDraftText(e.target.value)} disabled={!isLive(state.status) || submitted} inputMode={question.inputMode || "text"} placeholder={question.inputMode === "numeric" ? "כתבי מספר" : "כתבי תשובה"} style={{ width: "100%", padding: 16, borderRadius: 12, border: "1px solid #d1d5db", marginBottom: 16, fontSize: 20 }} />
            )}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {isLive(state.status) && !submitted && <button style={btn(true)} onClick={submitCurrent}>הגש תשובה</button>}
              {submitted && <div style={{ padding: "12px 16px", borderRadius: 12, background: "#e5e7eb", fontWeight: 700 }}>התשובה ננעלה</div>}
              {showSkip && !submitted && <button style={btn()} onClick={doSkip}>דלג</button>}
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}

export default function App() {
  const [room, setRoom] = useState(null);
  const [mode, setMode] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;
    getRoomByCode(code.toUpperCase()).then((r) => {
      if (r) {
        setRoom(r);
        setMode("player");
      }
    });
  }, []);

  if (!room) return <Home onCreate={(r) => { setRoom(r); setMode("host"); }} onJoin={(r) => { setRoom(r); setMode("player"); }} />;
  if (mode === "host") return <Host room={room} onExit={() => { setRoom(null); setMode(null); }} />;
  return <Player room={room} onExit={() => { setRoom(null); setMode(null); }} />;
}