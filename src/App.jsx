import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://eduozrpdvhkrsabrbbbf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_SU3W871v2lrteKkSGSOuCw_-Mw6os5S";
const QUESTION_TIME = 40;
const STORAGE_KEY = "upper_percentile_session";

const QUESTIONS = [
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

const hasBackend = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const supabase = hasBackend ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const uid = () => Math.random().toString(36).slice(2, 10);
const roomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const iso = () => new Date().toISOString();

function normalizeAnswer(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/״/g, '"')
    .replace(/׳/g, "'")
    .toLowerCase();
}

function isCorrectAnswer(question, answer) {
  return question.correctAnswers.some((a) => normalizeAnswer(a) === normalizeAnswer(answer));
}

function getSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  const value = { sessionId: uid(), name: "" };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  return value;
}

function setSessionName(name) {
  const session = getSession();
  session.name = name;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function cardStyle() {
  return {
    background: "white",
    borderRadius: 22,
    padding: 20,
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  };
}

function buttonStyle(active = false) {
  return {
    padding: "12px 16px",
    borderRadius: 14,
    border: active ? "2px solid #111827" : "1px solid #d1d5db",
    background: active ? "#111827" : "#fff",
    color: active ? "#fff" : "#111827",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 600,
  };
}

function answerButtonStyle(selected = false, correct = false) {
  return {
    padding: "14px 16px",
    borderRadius: 14,
    border: correct ? "2px solid #16a34a" : selected ? "2px solid #111827" : "1px solid #d1d5db",
    background: correct ? "#f0fdf4" : selected ? "#111827" : "#fff",
    color: correct ? "#14532d" : selected ? "#fff" : "#111827",
    cursor: "pointer",
    fontSize: 18,
    width: "100%",
  };
}

async function createRoomOnline(title) {
  const code = roomCode();
  const { data, error } = await supabase
    .from("upper_rooms")
    .insert({ code, title, status: "idle", question_index: 0, time_left: QUESTION_TIME, alive_count: 40, skips_count: 0, wrong_count: 0 })
    .select()
    .single();
  if (error) throw error;

  const questionRows = QUESTIONS.map((q, idx) => ({
    room_id: data.id,
    idx,
    label: q.label,
    prompt: q.prompt,
    type: q.type,
    options: q.options || [],
    correct_answers: q.correctAnswers,
    input_mode: q.inputMode || null,
  }));
  const qInsert = await supabase.from("upper_questions").insert(questionRows);
  if (qInsert.error) throw qInsert.error;
  return data;
}

async function getRoomByCode(code) {
  const { data, error } = await supabase.from("upper_rooms").select("*").eq("code", code).maybeSingle();
  if (error) throw error;
  return data;
}

async function getQuestions(roomId) {
  const { data, error } = await supabase.from("upper_questions").select("*").eq("room_id", roomId).order("idx");
  if (error) throw error;
  return (data || []).map((q) => ({
    id: q.id,
    label: q.label,
    prompt: q.prompt,
    type: q.type,
    options: q.options || [],
    correctAnswers: q.correct_answers || [],
    inputMode: q.input_mode || undefined,
  }));
}

async function joinRoom(roomId, name, sessionId) {
  const existing = await supabase.from("upper_players").select("*").eq("room_id", roomId).eq("session_id", sessionId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;
  const { data, error } = await supabase
    .from("upper_players")
    .insert({ room_id: roomId, name, session_id: sessionId, is_alive: true, skip_used: false })
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

async function getRoomState(roomId) {
  const room = await supabase.from("upper_rooms").select("*").eq("id", roomId).single();
  if (room.error) throw room.error;
  return room.data;
}

async function startQuestion(roomId) {
  const { error } = await supabase
    .from("upper_rooms")
    .update({ status: "live", time_left: QUESTION_TIME, started_at: iso(), wrong_count: 0, skips_count: 0 })
    .eq("id", roomId);
  if (error) throw error;
}

async function goNext(room) {
  const nextIndex = room.question_index + 1;
  const status = nextIndex >= QUESTIONS.length ? "finished" : "idle";
  const { error } = await supabase
    .from("upper_rooms")
    .update({ question_index: Math.min(nextIndex, QUESTIONS.length - 1), status, time_left: QUESTION_TIME, started_at: null, wrong_count: 0, skips_count: 0 })
    .eq("id", room.id);
  if (error) throw error;
}

async function submitPlayerAnswer(roomId, playerId, questionIndex, answer, usedSkip = false) {
  const { error } = await supabase
    .from("upper_answers")
    .upsert({ room_id: roomId, player_id: playerId, question_index: questionIndex, answer, used_skip: usedSkip }, { onConflict: "room_id,player_id,question_index" });
  if (error) throw error;
}

async function getAnswers(roomId, questionIndex) {
  const { data, error } = await supabase
    .from("upper_answers")
    .select("*")
    .eq("room_id", roomId)
    .eq("question_index", questionIndex);
  if (error) throw error;
  return data || [];
}

async function revealRoom(room, questions) {
  const players = await getPlayers(room.id);
  const answers = await getAnswers(room.id, room.question_index);
  const question = questions[room.question_index];
  let wrongCount = 0;
  let skipsCount = 0;
  let aliveCount = 0;

  for (const player of players) {
    const ans = answers.find((a) => a.player_id === player.id);
    const usedSkip = Boolean(ans?.used_skip);
    if (usedSkip) skipsCount += 1;

    let correct = false;
    if (usedSkip) {
      correct = true;
    } else if (question.type === "multiple") {
      correct = isCorrectAnswer(question, ans?.answer || "");
    } else {
      correct = isCorrectAnswer(question, ans?.answer || "");
    }

    const patch = { last_correct: correct };
    if (player.is_alive) {
      if (!correct) {
        patch.is_alive = false;
        wrongCount += 1;
      } else {
        aliveCount += 1;
      }
    }
    if (usedSkip) patch.skip_used = true;

    const upd = await supabase.from("upper_players").update(patch).eq("id", player.id);
    if (upd.error) throw upd.error;
  }

  const roomUpd = await supabase
    .from("upper_rooms")
    .update({ status: "result", wrong_count: wrongCount, skips_count: skipsCount, alive_count: aliveCount })
    .eq("id", room.id);
  if (roomUpd.error) throw roomUpd.error;
}

function Home({ onCreate, onJoin }) {
  const [title, setTitle] = useState("האחוזון העליון");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    try {
      setBusy(true);
      setError("");
      const room = await createRoomOnline(title);
      onCreate(room);
    } catch (e) {
      setError(e.message || "שגיאה ביצירת חדר");
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    try {
      setBusy(true);
      setError("");
      const room = await getRoomByCode(code.toUpperCase());
      if (!room) throw new Error("לא נמצא חדר כזה");
      onJoin(room);
    } catch (e) {
      setError(e.message || "שגיאה בהצטרפות");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", padding: 24, direction: "rtl", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img src="/logo.webp" alt="האחוזון העליון" style={{ maxWidth: 220, width: "100%", height: "auto" }} onError={(e) => (e.currentTarget.style.display = "none")} />
          <div style={{ fontSize: 32, fontWeight: "bold", marginTop: 8 }}>האחוזון העליון</div>
        </div>
        <div style={{ ...cardStyle(), maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <h2>משחק אונליין</h2>
          {!hasBackend && (
            <div style={{ background: "#fff7ed", color: "#9a3412", padding: 12, borderRadius: 12, marginBottom: 16 }}>
              כדי שזה יעבוד באמת אונליין צריך להכניס SUPABASE_URL ו־SUPABASE_ANON_KEY בקוד.
            </div>
          )}
          <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="שם המשחק" style={{ padding: 14, borderRadius: 12, border: "1px solid #d1d5db", fontSize: 18 }} />
            <button onClick={create} disabled={!hasBackend || busy} style={buttonStyle(true)}>פתח חדר מנחה</button>
          </div>
          <div style={{ height: 1, background: "#e5e7eb", margin: "20px 0" }} />
          <div style={{ display: "grid", gap: 12 }}>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="קוד חדר" style={{ padding: 14, borderRadius: 12, border: "1px solid #d1d5db", fontSize: 18 }} />
            <button onClick={join} disabled={!hasBackend || busy} style={buttonStyle()}>הצטרפות כשחקן</button>
          </div>
          {error && <div style={{ color: "#b91c1c", marginTop: 16 }}>{error}</div>}
        </div>
      </div>
    </div>
  );
}

function HostView({ room, onExit }) {
  const [roomState, setRoomState] = useState(room);
  const [questions, setQuestions] = useState([]);
  const [players, setPlayers] = useState([]);

  const currentQuestion = questions[roomState.question_index] || QUESTIONS[0];
  const timeLeft = roomState.status === "live" && roomState.started_at
    ? Math.max(0, QUESTION_TIME - Math.floor((Date.now() - new Date(roomState.started_at).getTime()) / 1000))
    : QUESTION_TIME;

  const refresh = async () => {
    const [r, q, p] = await Promise.all([getRoomState(room.id), getQuestions(room.id), getPlayers(room.id)]);
    setRoomState(r); setQuestions(q); setPlayers(p);
  };

  useEffect(() => { refresh(); const t = setInterval(refresh, 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (roomState.status === "live" && timeLeft === 0 && questions.length) {
      revealRoom(roomState, questions).then(refresh);
    }
  }, [timeLeft, roomState.status, questions.length]);

  const link = `${window.location.origin}${window.location.pathname}?code=${roomState.code}`;

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", padding: 24, direction: "rtl", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <img src="/logo.webp" alt="האחוזון העליון" style={{ maxWidth: 220, width: "100%", height: "auto" }} onError={(e) => (e.currentTarget.style.display = "none")} />
          <div style={{ fontSize: 28, fontWeight: "bold" }}>האחוזון העליון</div>
          <div style={{ marginTop: 8 }}>קוד חדר: <b>{roomState.code}</b></div>
        </div>

        <div style={{ ...cardStyle(), marginBottom: 16 }}>
          <div style={{ marginBottom: 10 }}><b>קישור לשחקנים:</b></div>
          <div style={{ wordBreak: "break-all", marginBottom: 12 }}>{link}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button style={buttonStyle()} onClick={() => navigator.clipboard.writeText(link)}>העתק קישור</button>
            <button style={buttonStyle()} onClick={onExit}>יציאה</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 20 }}>
          <div style={cardStyle()}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              <div style={cardStyle()}><div style={{ color: "#6b7280", fontSize: 14 }}>מחוברים</div><div style={{ fontSize: 30, fontWeight: "bold" }}>{players.length}</div></div>
              <div style={cardStyle()}><div style={{ color: "#6b7280", fontSize: 14 }}>עדיין במשחק</div><div style={{ fontSize: 30, fontWeight: "bold" }}>{roomState.alive_count}</div></div>
              <div style={cardStyle()}><div style={{ color: "#6b7280", fontSize: 14 }}>נפלו בשאלה</div><div style={{ fontSize: 30, fontWeight: "bold" }}>{roomState.wrong_count}</div></div>
              <div style={cardStyle()}><div style={{ color: "#6b7280", fontSize: 14 }}>דילגו</div><div style={{ fontSize: 30, fontWeight: "bold" }}>{roomState.question_index >= 4 ? roomState.skips_count : 0}</div></div>
            </div>

            <div style={{ color: "#6b7280", marginBottom: 6 }}>{currentQuestion.label}</div>
            <div style={{ fontSize: 34, fontWeight: "bold", marginBottom: 14 }}>{currentQuestion.prompt}</div>

            {roomState.status === "live" && <div style={{ marginBottom: 14, padding: 12, borderRadius: 14, background: "#eff6ff", color: "#1d4ed8", fontWeight: "bold", fontSize: 22, textAlign: "center" }}>נותרו {timeLeft} שניות</div>}
            {roomState.status === "result" && <div style={{ marginBottom: 14, padding: 12, borderRadius: 14, background: "#f3f4f6", fontWeight: "bold", fontSize: 20, textAlign: "center" }}>השאלה הסתיימה. אפשר לעבור לשאלה הבאה</div>}

            {currentQuestion.type === "multiple" ? (
              <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
                {currentQuestion.options.map((opt, i) => (
                  <div key={i} style={{ padding: 14, border: currentQuestion.correctAnswers.includes(opt) && roomState.status === "result" ? "2px solid #16a34a" : "1px solid #d1d5db", borderRadius: 12, background: currentQuestion.correctAnswers.includes(opt) && roomState.status === "result" ? "#f0fdf4" : "#fff", fontSize: 18 }}>{opt}</div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 16, borderRadius: 14, border: "1px solid #d1d5db", background: "#fafafa", fontSize: 18, marginBottom: 16 }}>
                תשובה בתיבת טקסט{currentQuestion.inputMode === "numeric" ? " (מספר)" : ""}
                {roomState.status === "result" && <div style={{ marginTop: 8, color: "#166534", fontWeight: "bold" }}>תשובה נכונה: {currentQuestion.correctAnswers.join(" / ")}</div>}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {roomState.status !== "live" && roomState.status !== "finished" && <button style={buttonStyle(true)} onClick={async () => { await startQuestion(room.id); refresh(); }}>{roomState.status === "idle" ? "התחל שאלה" : "התחל שוב"}</button>}
              {roomState.status === "result" && <button style={buttonStyle()} onClick={async () => { await goNext(roomState); refresh(); }}>שאלה הבאה</button>}
            </div>
          </div>

          <div style={cardStyle()}>
            <h2 style={{ marginTop: 0 }}>שחקנים</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {players.map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #e5e7eb", borderRadius: 14, padding: 12 }}>
                  <div>
                    <div style={{ fontWeight: "bold" }}>{p.name}</div>
                    <div style={{ color: "#6b7280", fontSize: 14 }}>{p.is_alive ? "עדיין במשחק" : "יצא מהמשחק"}</div>
                  </div>
                  <div style={{ color: p.is_alive ? "#15803d" : "#b91c1c", fontWeight: "bold" }}>{p.is_alive ? "פעיל" : "נפל"}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerView({ room, onExit }) {
  const session = getSession();
  const [roomState, setRoomState] = useState(room);
  const [questions, setQuestions] = useState([]);
  const [player, setPlayer] = useState(null);
  const [name, setName] = useState(session.name || "");
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [usedSkipThisQuestion, setUsedSkipThisQuestion] = useState(false);

  const currentQuestion = questions[roomState.question_index] || QUESTIONS[0];
  const canSkip = roomState.question_index >= 4 && player && !player.skip_used && player.is_alive && roomState.status === "live";
  const timeLeft = roomState.status === "live" && roomState.started_at
    ? Math.max(0, QUESTION_TIME - Math.floor((Date.now() - new Date(roomState.started_at).getTime()) / 1000))
    : QUESTION_TIME;

  const refresh = async () => {
    const [r, q, players] = await Promise.all([getRoomState(room.id), getQuestions(room.id), getPlayers(room.id)]);
    setRoomState(r); setQuestions(q);
    const me = players.find((p) => p.session_id === session.sessionId) || null;
    setPlayer(me);
  };

  useEffect(() => { refresh(); const t = setInterval(refresh, 1000); return () => clearInterval(t); }, []);
  useEffect(() => { setSelectedAnswer(null); setTextAnswer(""); setUsedSkipThisQuestion(false); }, [roomState.question_index, roomState.status]);

  const join = async () => {
    setSessionName(name);
    await joinRoom(room.id, name, session.sessionId);
    refresh();
  };

  const saveAnswer = async (answerValue, skip = false) => {
    if (!player || roomState.status !== "live") return;
    await submitPlayerAnswer(room.id, player.id, roomState.question_index, answerValue, skip);
    refresh();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", padding: 24, direction: "rtl", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <img src="/logo.webp" alt="האחוזון העליון" style={{ maxWidth: 220, width: "100%", height: "auto" }} onError={(e) => (e.currentTarget.style.display = "none")} />
          <div style={{ fontSize: 28, fontWeight: "bold" }}>האחוזון העליון</div>
        </div>

        {!player ? (
          <div style={{ ...cardStyle(), maxWidth: 600, margin: "0 auto" }}>
            <h2>כניסה למשחק</h2>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="השם שלך" style={{ width: "100%", padding: 14, borderRadius: 12, border: "1px solid #d1d5db", fontSize: 18, marginBottom: 12 }} />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button style={buttonStyle(true)} onClick={join} disabled={!name.trim()}>היכנסי למשחק</button>
              <button style={buttonStyle()} onClick={onExit}>חזרה</button>
            </div>
          </div>
        ) : (
          <div style={{ ...cardStyle(), maxWidth: 820, margin: "0 auto" }}>
            <h2 style={{ marginTop: 0 }}>מסך שחקן</h2>
            <div style={{ marginBottom: 16, color: "#6b7280" }}>{player.name}</div>
            <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
              <div style={{ padding: "10px 14px", borderRadius: 999, background: player.is_alive ? "#dcfce7" : "#fee2e2" }}>{player.is_alive ? "עדיין במשחק" : "יצאת מהמשחק"}</div>
              <div style={{ padding: "10px 14px", borderRadius: 999, background: "#ede9fe" }}>{roomState.question_index >= 4 ? player.skip_used ? "דלג נוצל" : "דלג זמין" : "דלג ייפתח אחרי שאלה 5"}</div>
            </div>

            <div style={{ color: "#6b7280", marginBottom: 8 }}>{currentQuestion.label}</div>
            <div style={{ fontSize: 36, fontWeight: "bold", marginBottom: 16 }}>{currentQuestion.prompt}</div>

            {roomState.status === "live" && <div style={{ marginBottom: 16, padding: 14, borderRadius: 14, background: "#eff6ff", color: "#1d4ed8", fontWeight: "bold", fontSize: 24, textAlign: "center" }}>נותרו {timeLeft} שניות</div>}
            {roomState.status === "idle" && <div style={{ marginBottom: 16, padding: 14, borderRadius: 14, background: "#f3f4f6", textAlign: "center", fontSize: 18 }}>ממתינים שהמנחה יתחיל את השאלה</div>}
            {roomState.status === "result" && <div style={{ marginBottom: 16, padding: 14, borderRadius: 14, background: player.last_correct ? "#dcfce7" : "#fee2e2", textAlign: "center", fontSize: 22, fontWeight: "bold" }}>{player.last_correct ? "צדקת ונשארת במשחק" : "טעית ויצאת מהמשחק"}</div>}

            {currentQuestion.type === "multiple" ? (
              <div style={{ display: "grid", gap: 12 }}>
                {currentQuestion.options.map((opt, i) => (
                  <button
                    key={i}
                    style={answerButtonStyle(selectedAnswer === i, roomState.status === "result" && currentQuestion.correctAnswers.includes(opt))}
                    onClick={async () => { setSelectedAnswer(i); await saveAnswer(opt, false); }}
                    disabled={roomState.status !== "live" || !player.is_alive || usedSkipThisQuestion}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                <input
                  value={textAnswer}
                  onChange={(e) => { setTextAnswer(e.target.value); saveAnswer(e.target.value, false); }}
                  placeholder={currentQuestion.inputMode === "numeric" ? "כתבי מספר" : "כתבי תשובה"}
                  inputMode={currentQuestion.inputMode === "numeric" ? "numeric" : "text"}
                  disabled={roomState.status !== "live" || !player.is_alive || usedSkipThisQuestion}
                  style={{ width: "100%", padding: 16, borderRadius: 14, border: "1px solid #d1d5db", fontSize: 20 }}
                />
              </div>
            )}

            {canSkip && (
              <button
                onClick={async () => { setUsedSkipThisQuestion(true); await saveAnswer("SKIP", true); }}
                style={{ marginTop: 16, ...buttonStyle(), background: "#ede9fe", border: "1px solid #c4b5fd" }}
              >
                דלג
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [room, setRoom] = useState(null);
  const [mode, setMode] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code || !hasBackend) return;
    getRoomByCode(code.toUpperCase()).then((found) => {
      if (found) {
        setRoom(found);
        setMode("player");
      }
    });
  }, []);

  if (!room) {
    return <Home onCreate={(r) => { setRoom(r); setMode("host"); }} onJoin={(r) => { setRoom(r); setMode("player"); }} />;
  }

  if (mode === "host") return <HostView room={room} onExit={() => { setRoom(null); setMode(null); }} />;
  return <PlayerView room={room} onExit={() => { setRoom(null); setMode(null); }} />;
}

/*
Supabase tables needed:

create table upper_rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  status text not null default 'idle',
  question_index int not null default 0,
  time_left int not null default 40,
  started_at timestamptz null,
  alive_count int not null default 40,
  skips_count int not null default 0,
  wrong_count int not null default 0,
  created_at timestamptz not null default now()
);

create table upper_questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references upper_rooms(id) on delete cascade,
  idx int not null,
  label text not null,
  prompt text not null,
  type text not null,
  options jsonb,
  correct_answers jsonb not null,
  input_mode text null
);

create table upper_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references upper_rooms(id) on delete cascade,
  session_id text not null,
  name text not null,
  is_alive boolean not null default true,
  skip_used boolean not null default false,
  last_correct boolean null,
  created_at timestamptz not null default now()
);

create unique index upper_players_room_session_idx on upper_players(room_id, session_id);

create table upper_answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references upper_rooms(id) on delete cascade,
  player_id uuid not null references upper_players(id) on delete cascade,
  question_index int not null,
  answer text,
  used_skip boolean not null default false,
  created_at timestamptz not null default now(),
  unique(room_id, player_id, question_index)
);

Enable RLS and add open policies for MVP.
*/