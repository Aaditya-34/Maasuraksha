/**
 * MaaSuraksha — server.js
 * Express REST API backed by sql.js SQLite (pure JS, no native deps).
 * Start: node server.js  (or npm run dev)
 */

'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDatabase, run, all, get } = require('./database');
const { verifyPassword, signToken, requireAuth } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3001;

/* ── Middleware ──────────────────────────────────────────────── */
app.use(cors({
    origin: [
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'http://localhost:3001',
        /\.netlify\.app$/,
        /\.onrender\.com$/
    ],
    credentials: true
}));
app.use(express.json());
app.use((req, _res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

/* ── Health Check (public) ───────────────────────────────────── */
app.get('/health', (_req, res) => {
  try {
    const counts = {
      patients: get('SELECT COUNT(*) AS c FROM patients').c,
      vitals: get('SELECT COUNT(*) AS c FROM vitals').c,
      alerts: get('SELECT COUNT(*) AS c FROM alerts').c,
      checkins: get('SELECT COUNT(*) AS c FROM checkins').c,
    };
    res.json({ status: 'ok', version: '1.0.0', project: 'MaaSuraksha', db: counts });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

/* ══════════════════════════════════════════════════════════════
   AUTH  (public — no token required)
═══════════════════════════════════════════════════════════════ */

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required.' });
  }

  const user = get(
    'SELECT id, name, username, password_hash, role, village, language FROM users WHERE username = ?',
    [username.trim().toLowerCase()]
  );
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid username or password.' });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ success: false, error: 'Invalid username or password.' });
  }

  const payload = { id: user.id, name: user.name, username: user.username, role: user.role, village: user.village };
  const token = signToken(payload);

  // For patients: also return their patient record id
  let patientId = null;
  if (user.role === 'patient') {
    const pat = get('SELECT id FROM patients WHERE user_id = ?', [user.id]);
    patientId = pat?.id || null;
  }

  console.log(`[AUTH] ✅ Login: ${user.username} (${user.role})`);
  res.json({ success: true, token, user: { ...payload, patientId } });
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ success: true, user: req.user });
});

// POST /api/auth/logout (client-side token removal, server just logs)
app.post('/api/auth/logout', requireAuth, (req, res) => {
  console.log(`[AUTH] Logout: ${req.user?.username}`);
  res.json({ success: true, message: 'Logged out successfully.' });
});

// POST /api/auth/register  — create a new user account
app.post('/api/auth/register', async (req, res) => {
  const { name, username, password, role, phone, village, district, language } = req.body;

  if (!name || !username || !password || !role) {
    return res.status(400).json({ success: false, error: 'name, username, password and role are required.' });
  }
  if (!['patient', 'doctor', 'asha'].includes(role)) {
    return res.status(400).json({ success: false, error: 'role must be patient, doctor, or asha.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
  }

  const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '.');

  // Check duplicate username
  const existing = get('SELECT id FROM users WHERE username = ?', [cleanUsername]);
  if (existing) {
    return res.status(409).json({ success: false, error: 'Username already taken. Choose another.' });
  }

  try {
    const { hashPassword } = require('./auth');
    const password_hash = await hashPassword(password);

    const userInfo = run(
      'INSERT INTO users (name, username, password_hash, role, phone, village, district, language) VALUES (?,?,?,?,?,?,?,?)',
      [name.trim(), cleanUsername, password_hash, role,
      phone || null, village || null, district || null, language || 'en']
    );
    const userId = userInfo.lastInsertRowid;

    // For patients: also create a patients record
    let patientId = null;
    if (role === 'patient') {
      const patInfo = run(
        'INSERT INTO patients (user_id, risk_level) VALUES (?, ?)',
        [userId, 'low']
      );
      patientId = patInfo.lastInsertRowid;
    }

    const payload = { id: userId, name: name.trim(), username: cleanUsername, role, village: village || null };
    const token = signToken(payload);

    console.log(`[AUTH] 🆕 Register: ${cleanUsername} (${role})`);
    res.status(201).json({ success: true, token, user: { ...payload, patientId } });

  } catch (err) {
    console.error('[AUTH] Register error:', err);
    res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
});

/* ══════════════════════════════════════════════════════════════
   PROTECTED ROUTES — requireAuth applied to all /api/*
   (auth routes above are registered BEFORE this middleware)
═══════════════════════════════════════════════════════════════ */
app.use('/api', requireAuth);

/* ══════════════════════════════════════════════════════════════
   PATIENTS
═══════════════════════════════════════════════════════════════ */

app.get('/api/patients', (_req, res) => {
  const rows = all(`
    SELECT p.id, u.name, u.phone, u.village, u.district, u.state,
           p.weeks_pregnant, p.due_date, p.risk_level, p.blood_group,
           p.gravida, p.para, p.known_conditions, p.device_id,
           d.name  AS doctor_name,
           a.name  AS asha_name
    FROM patients p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN users d ON d.id = p.doctor_id
    LEFT JOIN users a ON a.id = p.asha_id
    ORDER BY
      CASE p.risk_level WHEN 'high' THEN 1 WHEN 'moderate' THEN 2 ELSE 3 END, p.id
  `);

  const enriched = rows.map(p => {
    const v = get('SELECT hr, spo2, systolic, diastolic, recorded_at FROM vitals WHERE patient_id = ? ORDER BY recorded_at DESC LIMIT 1', [p.id]);
    const alertCount = get('SELECT COUNT(*) AS c FROM alerts WHERE patient_id = ? AND resolved = 0', [p.id]);
    return { ...p, latest: v || null, active_alerts: alertCount?.c || 0 };
  });

  res.json({ success: true, count: enriched.length, data: enriched });
});

app.get('/api/patients/:id', (req, res) => {
  const row = get(`
    SELECT p.*, u.name, u.phone, u.village, u.district, u.state, u.language,
           d.name AS doctor_name, d.phone AS doctor_phone,
           a.name AS asha_name,  a.phone AS asha_phone
    FROM patients p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN users d ON d.id = p.doctor_id
    LEFT JOIN users a ON a.id = p.asha_id
    WHERE p.id = ?
  `, [req.params.id]);
  if (!row) return res.status(404).json({ success: false, error: 'Patient not found' });
  res.json({ success: true, data: row });
});

/* ══════════════════════════════════════════════════════════════
   VITALS
═══════════════════════════════════════════════════════════════ */

app.get('/api/patients/:id/vitals', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const rows = all('SELECT * FROM vitals WHERE patient_id = ? ORDER BY recorded_at DESC LIMIT ?', [req.params.id, limit]);
  res.json({ success: true, count: rows.length, data: rows.reverse() });
});

app.post('/api/patients/:id/vitals', (req, res) => {
  const { hr, spo2, systolic, diastolic, temperature, hrv, activity } = req.body;
  const pid = req.params.id;
  const info = run(
    'INSERT INTO vitals (patient_id, hr, spo2, systolic, diastolic, temperature, hrv, activity) VALUES (?,?,?,?,?,?,?,?)',
    [pid, hr, spo2, systolic, diastolic, temperature, hrv, activity || 'resting']
  );
  autoGenerateAlerts(pid, { hr, spo2, systolic, diastolic });
  const riskLevel = computeRisk({ spo2, systolic, diastolic, hr });
  run('UPDATE patients SET risk_level = ? WHERE id = ?', [riskLevel, pid]);
  res.status(201).json({ success: true, id: info.lastInsertRowid, risk_level: riskLevel });
});

/* ══════════════════════════════════════════════════════════════
   ALERTS
═══════════════════════════════════════════════════════════════ */

app.get('/api/alerts', (_req, res) => {
  const rows = all(`
    SELECT al.*, u.name AS patient_name, u.village, p.weeks_pregnant, p.risk_level
    FROM alerts al
    JOIN patients p ON p.id = al.patient_id
    JOIN users   u ON u.id = p.user_id
    WHERE al.resolved = 0
    ORDER BY CASE al.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END, al.triggered_at DESC
  `);
  res.json({ success: true, count: rows.length, data: rows });
});

app.get('/api/patients/:id/alerts', (req, res) => {
  const rows = all('SELECT * FROM alerts WHERE patient_id = ? ORDER BY triggered_at DESC LIMIT 20', [req.params.id]);
  res.json({ success: true, count: rows.length, data: rows });
});

app.post('/api/patients/:id/alerts', (req, res) => {
  const { severity, type, message } = req.body;
  const info = run('INSERT INTO alerts (patient_id, severity, type, message) VALUES (?,?,?,?)',
    [req.params.id, severity, type, message]);
  res.status(201).json({ success: true, id: info.lastInsertRowid });
});

app.patch('/api/alerts/:id/resolve', (req, res) => {
  run("UPDATE alerts SET resolved = 1, resolved_at = datetime('now') WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

/* ══════════════════════════════════════════════════════════════
   CHECK-INS
═══════════════════════════════════════════════════════════════ */

app.get('/api/patients/:id/checkins', (req, res) => {
  const rows = all(`
    SELECT ci.*, u.name AS asha_name FROM checkins ci
    JOIN users u ON u.id = ci.asha_id
    WHERE ci.patient_id = ? ORDER BY ci.checkin_date DESC LIMIT 10
  `, [req.params.id]);
  res.json({ success: true, count: rows.length, data: rows });
});

app.get('/api/checkins/asha/:ashaId', (req, res) => {
  const rows = all(`
    SELECT ci.*, u.name AS patient_name, u.village, p.weeks_pregnant, p.risk_level
    FROM checkins ci JOIN patients p ON p.id = ci.patient_id JOIN users u ON u.id = p.user_id
    WHERE ci.asha_id = ? ORDER BY ci.checkin_date DESC LIMIT 30
  `, [req.params.ashaId]);
  res.json({ success: true, count: rows.length, data: rows });
});

app.post('/api/checkins', (req, res) => {
  const { patient_id, asha_id, bp_done, weight_done, iron_taken, kick_count, edema_normal, diet_done, danger_screened, app_synced, notes } = req.body;
  const info = run(
    'INSERT INTO checkins (patient_id, asha_id, bp_done, weight_done, iron_taken, kick_count, edema_normal, diet_done, danger_screened, app_synced, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [patient_id, asha_id, bp_done || 0, weight_done || 0, iron_taken || 0, kick_count || null, edema_normal || 1, diet_done || 0, danger_screened || 0, app_synced || 0, notes || '']
  );
  res.status(201).json({ success: true, id: info.lastInsertRowid });
});

/* ══════════════════════════════════════════════════════════════
   MEDICATIONS & APPOINTMENTS
═══════════════════════════════════════════════════════════════ */

app.get('/api/patients/:id/medications', (req, res) => {
  const rows = all('SELECT * FROM medications WHERE patient_id = ? AND active = 1', [req.params.id]);
  res.json({ success: true, count: rows.length, data: rows });
});

app.get('/api/patients/:id/appointments', (req, res) => {
  const rows = all(`
    SELECT ap.*, u.name AS doctor_name FROM appointments ap
    JOIN users u ON u.id = ap.doctor_id
    WHERE ap.patient_id = ? ORDER BY ap.scheduled_at ASC
  `, [req.params.id]);
  res.json({ success: true, count: rows.length, data: rows });
});

app.post('/api/appointments', (req, res) => {
  const { patient_id, doctor_id, scheduled_at, type, notes } = req.body;
  const info = run(
    'INSERT INTO appointments (patient_id, doctor_id, scheduled_at, type, notes) VALUES (?,?,?,?,?)',
    [patient_id, doctor_id, scheduled_at, type || 'antenatal', notes || '']
  );
  res.status(201).json({ success: true, id: info.lastInsertRowid });
});

/* ══════════════════════════════════════════════════════════════
   ANALYTICS
═══════════════════════════════════════════════════════════════ */

app.get('/api/analytics/overview', (_req, res) => {
  const riskDist = all('SELECT risk_level, COUNT(*) AS count FROM patients GROUP BY risk_level');
  const alertsBySeverity = all("SELECT severity, COUNT(*) AS count FROM alerts WHERE resolved = 0 GROUP BY severity");
  const recentVitals = get("SELECT AVG(hr) AS avg_hr, AVG(spo2) AS avg_spo2, AVG(systolic) AS avg_systolic, COUNT(*) AS total_readings FROM vitals WHERE recorded_at > datetime('now', '-24 hours')");
  const checkinToday = get("SELECT COUNT(*) AS c FROM checkins WHERE checkin_date = date('now')");
  const upcomingAppts = get("SELECT COUNT(*) AS c FROM appointments WHERE status = 'upcoming' AND scheduled_at > datetime('now')");

  res.json({
    success: true,
    data: {
      risk_distribution: riskDist,
      alerts_by_severity: alertsBySeverity,
      vitals_last_24h: recentVitals,
      checkins_today: checkinToday?.c || 0,
      upcoming_appointments: upcomingAppts?.c || 0,
    }
  });
});

app.get('/api/analytics/vitals-trend/:patientId', (req, res) => {
  const rows = all(`
    SELECT date(recorded_at) AS day,
           AVG(hr) AS avg_hr, MAX(systolic) AS max_systolic,
           MIN(spo2) AS min_spo2, AVG(temperature) AS avg_temp
    FROM vitals WHERE patient_id = ? AND recorded_at > datetime('now', '-7 days')
    GROUP BY date(recorded_at) ORDER BY day ASC
  `, [req.params.patientId]);
  res.json({ success: true, data: rows });
});

/* ══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */

function autoGenerateAlerts(pid, { spo2, systolic, diastolic, hr }) {
  const issues = [];
  if (systolic >= 160) issues.push(['critical', 'bp_severe', `SEVERE: Systolic BP ${systolic} mmHg. Immediate intervention.`]);
  else if (systolic >= 140) issues.push(['critical', 'bp_high', `High BP ${systolic}/${diastolic} mmHg. Preeclampsia risk.`]);
  else if (systolic >= 130 && diastolic >= 80) issues.push(['warning', 'bp_moderate', `Moderate BP ${systolic}/${diastolic} mmHg.`]);
  if (spo2 <= 90) issues.push(['critical', 'spo2_critical', `Critical SpO₂: ${spo2}%.`]);
  else if (spo2 <= 94) issues.push(['warning', 'spo2_low', `Low SpO₂: ${spo2}%.`]);
  if (hr >= 110) issues.push(['warning', 'hr_high', `Elevated HR: ${hr} bpm.`]);

  const cutoff = new Date(Date.now() - 30 * 60000).toISOString().replace('T', ' ').slice(0, 19);
  for (const [sev, type, msg] of issues) {
    const recent = get('SELECT id FROM alerts WHERE patient_id=? AND type=? AND resolved=0 AND triggered_at>? LIMIT 1', [pid, type, cutoff]);
    if (!recent) run('INSERT INTO alerts (patient_id, severity, type, message) VALUES (?,?,?,?)', [pid, sev, type, msg]);
  }
}

function computeRisk({ spo2, systolic, diastolic, hr }) {
  let score = 0;
  if (systolic >= 140) score += 35; else if (systolic >= 130) score += 15;
  if (diastolic >= 90) score += 25;
  if (spo2 <= 92) score += 30; else if (spo2 <= 95) score += 15;
  if (hr >= 100) score += 10;
  return score >= 50 ? 'high' : score >= 20 ? 'moderate' : 'low';
}

/* ══════════════════════════════════════════════════════════════
   AI — GEMINI HEALTH CHAT  (protected)
   POST /api/ai/chat
   Body: { message: string, history: [{role, content}] }
═══════════════════════════════════════════════════════════════ */
app.post('/api/ai/chat', async (req, res) => {
  const { GEMINI_API_KEY } = process.env;
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    return res.status(503).json({
      success: false,
      error: 'Gemini API key not configured. Add GEMINI_API_KEY to backend/.env'
    });
  }

  const { message, history = [] } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'message is required' });
  }

  try {
    // Fetch the logged-in patient's context from DB
    const user = req.user;
    let patientContext = '';
    if (user.role === 'patient') {
      const patient = get(`
        SELECT p.weeks_pregnant, p.due_date, p.risk_level, p.blood_group,
               p.known_conditions, u.village, u.district
        FROM patients p JOIN users u ON u.id = p.user_id
        WHERE p.user_id = ?
      `, [user.id]);
      const vitals = patient
        ? get('SELECT hr, spo2, systolic, diastolic, temperature, recorded_at FROM vitals WHERE patient_id = (SELECT id FROM patients WHERE user_id = ?) ORDER BY recorded_at DESC LIMIT 1', [user.id])
        : null;

      if (patient) {
        patientContext = `
PATIENT RECORD FOR ${user.name}:
- Pregnancy: ${patient.weeks_pregnant || 'unknown'} weeks, due ${patient.due_date || 'unknown'}
- Risk level: ${patient.risk_level || 'unknown'}
- Blood group: ${patient.blood_group || 'unknown'}
- Known conditions: ${patient.known_conditions || 'none'}
- Location: ${patient.village || ''}, ${patient.district || ''}
${vitals ? `LATEST VITALS (${vitals.recorded_at}):
- Heart rate: ${vitals.hr} bpm
- SpO₂: ${vitals.spo2}%
- Blood pressure: ${vitals.systolic}/${vitals.diastolic} mmHg
- Temperature: ${vitals.temperature}°C` : 'No vitals recorded yet.'}`;
      }
    }

    const systemInstruction = `You are MaaSuraksha AI, a compassionate maternal health assistant for rural India. 
You help pregnant women understand their health data, symptoms, and when to seek emergency care.
Always respond in simple, clear language. If the patient's language preference is Hindi or another regional language, you may mix languages gently.
Keep responses concise (2-4 sentences unless a detailed explanation is needed).
NEVER diagnose. Always recommend consulting the doctor or ASHA worker for serious concerns.
${patientContext ? `\nPATIENT CONTEXT:\n${patientContext}` : ''}`;

    // Build request body for Gemini v1 REST API
    const gemContents = [];
    // Prepend system instruction as the first user turn (v1 compatible approach)
    for (const h of history.slice(-10)) {
      gemContents.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      });
    }
    gemContents.push({ role: 'user', parts: [{ text: message }] });

    const gemRes = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: gemContents,
          generationConfig: { maxOutputTokens: 400, temperature: 0.7 }
        })
      }
    );

    if (!gemRes.ok) {
      const errTxt = await gemRes.text();
      throw new Error(`Gemini API ${gemRes.status}: ${errTxt}`);
    }

    const gemData = await gemRes.json();
    const reply = gemData.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';

    res.json({ success: true, reply });
  } catch (err) {
    console.error('[AI] Gemini error:', err.message);
    res.status(500).json({ success: false, error: 'AI service error: ' + err.message });
  }
});
/* ══════════════════════════════════════════════════════════════
   SYMPTOMS (user_input_data)
═══════════════════════════════════════════════════════════════ */

// GET /api/patients/:id/symptoms
app.get('/api/patients/:id/symptoms', (req, res) => {
  const rows = all(
    'SELECT * FROM user_input_data WHERE patient_id = ? ORDER BY recorded_at DESC LIMIT 20',
    [req.params.id]
  );
  res.json({ success: true, count: rows.length, data: rows });
});

// POST /api/patients/:id/symptoms
app.post('/api/patients/:id/symptoms', (req, res) => {
  const {
    headache, swelling, blurred_vision, nausea,
    abdominal_pain, fatigue, fever, reduced_fetal_movement,
    notes, severity
  } = req.body;
  const pid = req.params.id;

  const info = run(
    `INSERT INTO user_input_data
      (patient_id, headache, swelling, blurred_vision, nausea,
       abdominal_pain, fatigue, fever, reduced_fetal_movement, notes, severity)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [pid,
     headache ? 1 : 0, swelling ? 1 : 0, blurred_vision ? 1 : 0,
     nausea ? 1 : 0, abdominal_pain ? 1 : 0, fatigue ? 1 : 0,
     fever ? 1 : 0, reduced_fetal_movement ? 1 : 0,
     notes || '', severity || 'mild']
  );

  // Auto-generate alert if severe symptoms
  const severeSymptoms = [blurred_vision, abdominal_pain, reduced_fetal_movement];
  if (severity === 'severe' || severeSymptoms.some(Boolean)) {
    run('INSERT INTO alerts (patient_id, severity, type, message) VALUES (?,?,?,?)', [
      pid, 'warning', 'symptom_report',
      `Patient reported severe symptoms: ${[
        headache && 'headache', swelling && 'swelling',
        blurred_vision && 'blurred vision', abdominal_pain && 'abdominal pain',
        reduced_fetal_movement && 'reduced fetal movement'
      ].filter(Boolean).join(', ')}.`
    ]);
  }

  res.status(201).json({ success: true, id: info.lastInsertRowid });
});

/* ══════════════════════════════════════════════════════════════
   NUTRITION LOGS
═══════════════════════════════════════════════════════════════ */

// GET /api/patients/:id/nutrition
app.get('/api/patients/:id/nutrition', (req, res) => {
  const rows = all(
    'SELECT * FROM nutrition_logs WHERE patient_id = ? ORDER BY logged_at DESC LIMIT 14',
    [req.params.id]
  );
  res.json({ success: true, count: rows.length, data: rows });
});

// POST /api/patients/:id/nutrition
app.post('/api/patients/:id/nutrition', (req, res) => {
  const {
    meal_type, water_glasses, iron_taken, folic_taken,
    calcium_taken, fruits, vegetables, protein, dairy, notes
  } = req.body;

  const info = run(
    `INSERT INTO nutrition_logs
      (patient_id, meal_type, water_glasses, iron_taken, folic_taken,
       calcium_taken, fruits, vegetables, protein, dairy, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [req.params.id,
     meal_type || 'lunch',
     water_glasses || 0, iron_taken ? 1 : 0, folic_taken ? 1 : 0,
     calcium_taken ? 1 : 0, fruits || 0, vegetables || 0,
     protein || 0, dairy || 0, notes || '']
  );
  res.status(201).json({ success: true, id: info.lastInsertRowid });
});
/* ── 404 ─────────────────────────────────────────────────────── */
app.use((req, res) => res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.url}` }));

/* ── Start ───────────────────────────────────────────────────── */
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 MaaSuraksha API → http://localhost:${PORT}`);
    console.log(`   POST /api/auth/login`);
    console.log(`   GET  /api/auth/me`);
    console.log(`   GET  /api/patients  (requires token)`);
    console.log(`   GET  /api/alerts    (requires token)`);
    console.log(`   GET  /api/analytics/overview\n`);
  });
}).catch(err => {
  console.error('❌ Failed to start:', err);
  process.exit(1);
});

module.exports = app;
