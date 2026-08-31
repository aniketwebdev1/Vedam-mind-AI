// server.js — CampusMind backend
// Run: npm install express cors   then   node server.js
// Server chalega: http://localhost:5000

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ---- In-memory "database" (resets when server restarts — fine for a hackathon demo) ----
const students = {}; // { name: { attendance, subjects, missed, mood, riskScore, studyHours, badges } }

// ---- Health check ----
app.get("/", (req, res) => {
  res.json({ status: "CampusMind backend is running ✅" });
});

// ---- Login / create student ----
app.post("/api/login", (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }
  const key = name.trim();
  if (!students[key]) {
    students[key] = {
      name: key,
      attendance: 0,
      subjects: [],
      missed: 0,
      mood: "",
      riskScore: null,
      studyHours: 0,
      badges: ["🌱 New Member"],
    };
  }
  res.json(students[key]);
});

// ---- Core: risk calculation (this is the "AI logic" — rule-based scoring engine) ----
function computeRisk({ attendance, subjects, missed, mood }) {
  attendance = Number(attendance) || 0;
  missed = Number(missed) || 0;
  mood = (mood || "").toLowerCase();

  const validMarks = (subjects || [])
    .map((s) => Number(s.marks))
    .filter((m) => !isNaN(m) && m >= 0);

  const hasMarks = validMarks.length > 0;
  const avgMarks = hasMarks
    ? validMarks.reduce((a, b) => a + b, 0) / validMarks.length
    : null;

  // If marks are entered, weight attendance+marks equally.
  // If no marks entered yet, base health purely on attendance so the score
  // isn't unfairly dragged down to 0 by empty fields.
  let healthScore = hasMarks
    ? attendance * 0.5 + avgMarks * 0.5
    : attendance;

  // Missed assignments penalty (capped so it can't wipe the score out)
  healthScore -= Math.min(missed * 3, 15);

  // Mood/sentiment penalty
  const negativeWords = [
    "stress", "tension", "sad", "anxious", "anxiety", "depress",
    "akela", "udaas", "thak", "give up", "chodna", "lonely", "pressure",
  ];
  if (negativeWords.some((w) => mood.includes(w))) healthScore -= 12;

  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));
  const riskScore = 100 - healthScore;

  let level = "LOW";
  let suggestions = [
    "Great going! Current attendance aur study routine maintain karo.",
    "Ek peer-mentor bano — juniors ko help karo, leadership skill build hoga.",
    "Ek naya skill (coding/design/communication) side mein seekhna start karo.",
  ];

  if (riskScore >= 40 && riskScore < 65) {
    level = "MEDIUM";
    suggestions = [
      "Attendance ko 75%+ tak le jaane ka target banao agle 3 weeks mein.",
      "Weak subjects ke liye weekly 2 extra study hours block karo.",
      "Ek study buddy/senior mentor dhoondo jo doubts clear kar sake.",
    ];
  } else if (riskScore >= 65) {
    level = "HIGH";
    suggestions = [
      "Turant apne academic advisor/mentor se meeting schedule karo.",
      "Attendance aur submissions ka daily checklist banao.",
      "Akele struggle mat karo — AI Counselor ya trusted senior/faculty se baat karo.",
    ];
  }

  return { riskScore, level, suggestions };
}

// ---- Submit academic data + get risk score back ----
app.post("/api/risk", (req, res) => {
  const { name, attendance, subjects, missed, mood } = req.body;
  if (!name || !students[name]) {
    return res.status(404).json({ error: "Student not found. Login first." });
  }

  const result = computeRisk({ attendance, subjects, missed, mood });

  students[name] = {
    ...students[name],
    attendance,
    subjects,
    missed,
    mood,
    riskScore: result.riskScore,
    riskLevel: result.level,
  };

  res.json(result);
});

// ---- Log study hours ----
app.post("/api/study-hours", (req, res) => {
  const { name, hours } = req.body;
  if (!name || !students[name]) {
    return res.status(404).json({ error: "Student not found. Login first." });
  }
  students[name].studyHours += Number(hours) || 0;

  if (students[name].studyHours >= 20 && !students[name].badges.includes("🔥 Goal Crusher")) {
    students[name].badges.push("🔥 Goal Crusher");
  } else if (students[name].studyHours >= 10 && !students[name].badges.includes("📈 Consistent Learner")) {
    students[name].badges.push("📈 Consistent Learner");
  }

  res.json(students[name]);
});

// ---- Leaderboard: all logged-in students ranked by weekly study hours ----
app.get("/api/leaderboard", (req, res) => {
  const list = Object.values(students)
    .map((s) => ({ name: s.name, studyHours: s.studyHours || 0, riskScore: s.riskScore }))
    .sort((a, b) => b.studyHours - a.studyHours);
  res.json(list);
});

// ---- Fetch a student's full profile ----
app.get("/api/student/:name", (req, res) => {
  const student = students[req.params.name];
  if (!student) return res.status(404).json({ error: "Not found" });
  res.json(student);
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`CampusMind backend running at http://localhost:${PORT}`);
});
