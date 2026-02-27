/**
 * MaaSuraksha — seed.js
 * Run: node seed.js
 */

'use strict';

const { initDatabase, run, exec } = require('./database');
const { hashPassword } = require('./auth');

(async () => {
    await initDatabase();
    console.log('🌱 Seeding MaaSuraksha database...\n');

    /* ── Helpers ─────────────────────────────────────────── */
    function rand(min, max) { return +(min + Math.random() * (max - min)).toFixed(1); }

    function minutesAgo(n) {
        return new Date(Date.now() - n * 60000).toISOString().replace('T', ' ').slice(0, 19);
    }
    function daysAgo(n) {
        const d = new Date(); d.setDate(d.getDate() - n);
        return d.toISOString().replace('T', ' ').slice(0, 19);
    }
    function addDays(n) {
        const d = new Date(); d.setDate(d.getDate() + n);
        return d.toISOString().slice(0, 10);
    }

    /* ── Clear ───────────────────────────────────────────── */
    exec('DELETE FROM appointments;');
    exec('DELETE FROM medications;');
    exec('DELETE FROM checkins;');
    exec('DELETE FROM alerts;');
    exec('DELETE FROM vitals;');
    exec('DELETE FROM patients;');
    exec('DELETE FROM users;');

    /* ── Users ───────────────────────────────────────────── */
    const patientHash = await hashPassword('patient123');
    const doctorHash = await hashPassword('doctor123');
    const ashaHash = await hashPassword('asha123');

    const users = [
        { name: 'Dr. Meenakshi Rao', username: 'dr.meenakshi', hash: doctorHash, role: 'doctor', phone: '9876543210', village: 'PHC Ramgarh', district: 'Hazaribagh', state: 'Jharkhand', language: 'en' },
        { name: 'Preeti Kumari', username: 'preeti', hash: ashaHash, role: 'asha', phone: '9876543211', village: 'Ramgarh', district: 'Hazaribagh', state: 'Jharkhand', language: 'hi' },
        { name: 'Radha Kumari', username: 'radha', hash: patientHash, role: 'patient', phone: '9876543212', village: 'Ramgarh', district: 'Hazaribagh', state: 'Jharkhand', language: 'hi' },
        { name: 'Sunita Devi', username: 'sunita', hash: patientHash, role: 'patient', phone: '9876543213', village: 'Bhanpur', district: 'Hazaribagh', state: 'Jharkhand', language: 'hi' },
        { name: 'Geeta Yadav', username: 'geeta', hash: patientHash, role: 'patient', phone: '9876543214', village: 'Kharagpur', district: 'Hazaribagh', state: 'Jharkhand', language: 'hi' },
        { name: 'Priya Sharma', username: 'priya', hash: patientHash, role: 'patient', phone: '9876543215', village: 'Navatoli', district: 'Hazaribagh', state: 'Jharkhand', language: 'en' },
        { name: 'Meena Patel', username: 'meena', hash: patientHash, role: 'patient', phone: '9876543216', village: 'Dhimpur', district: 'Hazaribagh', state: 'Jharkhand', language: 'hi' },
        { name: 'Anita Singh', username: 'anita', hash: patientHash, role: 'patient', phone: '9876543217', village: 'Ramgarh', district: 'Hazaribagh', state: 'Jharkhand', language: 'hi' },
        { name: 'Lata Mahto', username: 'lata', hash: patientHash, role: 'patient', phone: '9876543218', village: 'Barwa', district: 'Hazaribagh', state: 'Jharkhand', language: 'hi' },
        { name: 'Champa Verma', username: 'champa', hash: patientHash, role: 'patient', phone: '9876543219', village: 'Bhanpur', district: 'Hazaribagh', state: 'Jharkhand', language: 'hi' },
    ];

    const userIds = {};
    for (const u of users) {
        const { lastInsertRowid } = run(
            'INSERT INTO users (name, username, password_hash, role, phone, village, district, state, language) VALUES (?,?,?,?,?,?,?,?,?)',
            [u.name, u.username, u.hash, u.role, u.phone, u.village, u.district, u.state, u.language]
        );
        userIds[u.name] = lastInsertRowid;
    }
    console.log(`✅ Inserted ${users.length} users`);
    console.log('   Doctor:  dr.meenakshi / doctor123');
    console.log('   ASHA:    preeti / asha123');
    console.log('   Patient: radha (or sunita, geeta…) / patient123');

    /* ── Patients ────────────────────────────────────────── */
    const doctorId = userIds['Dr. Meenakshi Rao'];
    const ashaId = userIds['Preeti Kumari'];

    const patientData = [
        { name: 'Radha Kumari', weeks: 32, risk: 'high', bg: 'B+', gravida: 2, para: 1, conditions: '["mild_hypertension"]' },
        { name: 'Sunita Devi', weeks: 28, risk: 'moderate', bg: 'O+', gravida: 1, para: 0, conditions: '[]' },
        { name: 'Geeta Yadav', weeks: 36, risk: 'high', bg: 'A+', gravida: 3, para: 2, conditions: '["anemia"]' },
        { name: 'Priya Sharma', weeks: 22, risk: 'low', bg: 'AB+', gravida: 1, para: 0, conditions: '[]' },
        { name: 'Meena Patel', weeks: 30, risk: 'moderate', bg: 'B-', gravida: 2, para: 1, conditions: '["pre_diabetes"]' },
        { name: 'Anita Singh', weeks: 18, risk: 'low', bg: 'O-', gravida: 1, para: 0, conditions: '[]' },
        { name: 'Lata Mahto', weeks: 34, risk: 'high', bg: 'A-', gravida: 2, para: 1, conditions: '["anemia","hypertension"]' },
        { name: 'Champa Verma', weeks: 25, risk: 'low', bg: 'O+', gravida: 1, para: 0, conditions: '[]' },
    ];

    const patientIds = {};
    let devNum = 1001;
    for (const p of patientData) {
        const { lastInsertRowid } = run(
            'INSERT INTO patients (user_id, weeks_pregnant, due_date, doctor_id, asha_id, risk_level, blood_group, gravida, para, known_conditions, device_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            [userIds[p.name], p.weeks, addDays((40 - p.weeks) * 7), doctorId, ashaId, p.risk, p.bg, p.gravida, p.para, p.conditions, `MSB-${devNum++}`]
        );
        patientIds[p.name] = lastInsertRowid;
    }
    console.log(`✅ Inserted ${patientData.length} patients`);

    /* ── Vitals (20 readings per patient) ────────────────── */
    const bases = {
        high: { hr: [98, 112], spo2: [89, 93], sys: [138, 152], dia: [88, 98], temp: [37.0, 37.8], hrv: [20, 38] },
        moderate: { hr: [85, 100], spo2: [93, 96], sys: [126, 138], dia: [82, 90], temp: [36.8, 37.3], hrv: [30, 45] },
        low: { hr: [72, 82], spo2: [96, 99], sys: [108, 122], dia: [68, 80], temp: [36.4, 36.9], hrv: [45, 65] },
    };
    const activities = ['resting', 'walking', 'resting', 'sleeping', 'resting', 'light_activity'];
    let totalVitals = 0;
    for (const p of patientData) {
        const b = bases[p.risk];
        for (let i = 0; i < 20; i++) {
            run(
                'INSERT INTO vitals (patient_id, recorded_at, hr, spo2, systolic, diastolic, temperature, hrv, activity) VALUES (?,?,?,?,?,?,?,?,?)',
                [patientIds[p.name], minutesAgo((20 - i) * 30),
                rand(b.hr[0], b.hr[1]), rand(b.spo2[0], b.spo2[1]),
                rand(b.sys[0], b.sys[1]), rand(b.dia[0], b.dia[1]),
                rand(b.temp[0], b.temp[1]), rand(b.hrv[0], b.hrv[1]),
                activities[Math.floor(Math.random() * activities.length)]]
            );
            totalVitals++;
        }
    }
    console.log(`✅ Inserted ${totalVitals} vitals readings`);

    /* ── Alerts ──────────────────────────────────────────── */
    const alerts = [
        { pid: patientIds['Radha Kumari'], sev: 'critical', type: 'bp_high', msg: 'Systolic BP 148 mmHg — above 140 threshold. Possible preeclampsia.', at: minutesAgo(120) },
        { pid: patientIds['Geeta Yadav'], sev: 'critical', type: 'spo2_low', msg: 'SpO₂ dropped to 91% at rest — likely severe anemia.', at: minutesAgo(480) },
        { pid: patientIds['Lata Mahto'], sev: 'critical', type: 'trend_escalation', msg: 'Systolic BP trending +10 mmHg over 72 hrs (128→138). High risk.', at: daysAgo(1) },
        { pid: patientIds['Sunita Devi'], sev: 'warning', type: 'hrv_decline', msg: 'HRV declined 55→38ms over 2 weeks. Cardiovascular stress suspected.', at: daysAgo(2) },
        { pid: patientIds['Meena Patel'], sev: 'warning', type: 'hr_elevated', msg: 'Resting HR persistently >95 bpm. GDM screening recommended.', at: daysAgo(3) },
        { pid: patientIds['Priya Sharma'], sev: 'info', type: 'reminder', msg: 'Antenatal check-up due in 3 days at PHC Ramgarh.', at: daysAgo(0) },
    ];
    for (const a of alerts) {
        run('INSERT INTO alerts (patient_id, severity, type, message, triggered_at) VALUES (?,?,?,?,?)',
            [a.pid, a.sev, a.type, a.msg, a.at]);
    }
    console.log(`✅ Inserted ${alerts.length} alerts`);

    /* ── Check-ins ───────────────────────────────────────── */
    const checkins = [
        { n: 'Radha Kumari', d: 3, bp: 1, wt: 1, ir: 1, kk: 14, ed: 0, dt: 1, da: 1, sy: 1, notes: 'Edema on ankles. Referred to doctor.' },
        { n: 'Sunita Devi', d: 5, bp: 1, wt: 1, ir: 1, kk: 12, ed: 1, dt: 1, da: 1, sy: 1, notes: 'All checks normal.' },
        { n: 'Geeta Yadav', d: 7, bp: 1, wt: 0, ir: 1, kk: 10, ed: 1, dt: 0, da: 1, sy: 1, notes: 'Weight scale unavailable. Diet pending.' },
        { n: 'Priya Sharma', d: 0, bp: 1, wt: 1, ir: 1, kk: 15, ed: 1, dt: 1, da: 1, sy: 1, notes: 'Excellent visit.' },
        { n: 'Anita Singh', d: 0, bp: 1, wt: 1, ir: 1, kk: 11, ed: 1, dt: 1, da: 1, sy: 1, notes: 'First trimester check — all good.' },
        { n: 'Meena Patel', d: 2, bp: 1, wt: 1, ir: 0, kk: 13, ed: 1, dt: 1, da: 1, sy: 0, notes: 'Iron tablets unavailable at PHC.' },
        { n: 'Lata Mahto', d: 4, bp: 1, wt: 1, ir: 1, kk: 11, ed: 1, dt: 1, da: 1, sy: 1, notes: 'BP trending up — flagged for doctor.' },
        { n: 'Champa Verma', d: 1, bp: 1, wt: 1, ir: 1, kk: 12, ed: 1, dt: 1, da: 1, sy: 1, notes: 'Routine check — normal.' },
    ];
    for (const c of checkins) {
        run('INSERT INTO checkins (patient_id, asha_id, checkin_date, bp_done, weight_done, iron_taken, kick_count, edema_normal, diet_done, danger_screened, app_synced, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
            [patientIds[c.n], ashaId, daysAgo(c.d).slice(0, 10), c.bp, c.wt, c.ir, c.kk, c.ed, c.dt, c.da, c.sy, c.notes]);
    }
    console.log(`✅ Inserted ${checkins.length} check-ins`);

    /* ── Medications ─────────────────────────────────────── */
    const meds = [
        ['Radha Kumari', 'Iron + Folic Acid', '100mg + 0.5mg', 'Once daily (morning)'],
        ['Radha Kumari', 'Calcium', '500mg', 'Twice daily'],
        ['Radha Kumari', 'Methyldopa', '250mg', 'Twice daily (BP)'],
        ['Sunita Devi', 'Iron + Folic Acid', '100mg + 0.5mg', 'Once daily (morning)'],
        ['Sunita Devi', 'Calcium', '500mg', 'Twice daily'],
        ['Geeta Yadav', 'Iron + Folic Acid', '200mg + 0.5mg', 'Twice daily'],
        ['Priya Sharma', 'Iron + Folic Acid', '100mg + 0.5mg', 'Once daily (morning)'],
        ['Meena Patel', 'Iron + Folic Acid', '100mg + 0.5mg', 'Once daily (morning)'],
        ['Anita Singh', 'Iron + Folic Acid', '100mg + 0.5mg', 'Once daily (morning)'],
        ['Lata Mahto', 'Iron + Folic Acid', '200mg + 0.5mg', 'Twice daily'],
        ['Lata Mahto', 'Labetalol', '100mg', 'Twice daily (BP)'],
        ['Champa Verma', 'Iron + Folic Acid', '100mg + 0.5mg', 'Once daily (morning)'],
    ];
    for (const [name, med, dosage, freq] of meds) {
        run('INSERT INTO medications (patient_id, name, dosage, frequency) VALUES (?,?,?,?)',
            [patientIds[name], med, dosage, freq]);
    }
    console.log(`✅ Inserted ${meds.length} medications`);

    /* ── Appointments ────────────────────────────────────── */
    const appts = [
        { n: 'Radha Kumari', daysFromNow: 1, type: 'antenatal', status: 'upcoming', notes: 'Weekly BP monitoring — high risk' },
        { n: 'Sunita Devi', daysFromNow: 5, type: 'antenatal', status: 'upcoming', notes: '28-week routine ANC' },
        { n: 'Geeta Yadav', daysFromNow: 2, type: 'emergency', status: 'upcoming', notes: 'URGENT: anemia + low SpO₂ workup' },
        { n: 'Priya Sharma', daysFromNow: 3, type: 'antenatal', status: 'upcoming', notes: '22-week anatomy scan' },
        { n: 'Meena Patel', daysFromNow: 7, type: 'glucose_test', status: 'upcoming', notes: 'GDM screening — fasting required' },
        { n: 'Anita Singh', daysFromNow: 14, type: 'antenatal', status: 'upcoming', notes: 'First trimester anomaly scan' },
        { n: 'Lata Mahto', daysFromNow: 1, type: 'antenatal', status: 'upcoming', notes: 'URGENT: 34-week high-risk review' },
        { n: 'Champa Verma', daysFromNow: 10, type: 'antenatal', status: 'upcoming', notes: 'Routine 25-week visit' },
        { n: 'Priya Sharma', daysFromNow: -7, type: 'antenatal', status: 'completed', notes: '20-week scan — normal' },
        { n: 'Sunita Devi', daysFromNow: -14, type: 'antenatal', status: 'completed', notes: '24-week ANC — completed' },
    ];
    for (const a of appts) {
        run('INSERT INTO appointments (patient_id, doctor_id, scheduled_at, type, status, notes) VALUES (?,?,?,?,?,?)',
            [patientIds[a.n], doctorId, addDays(a.daysFromNow), a.type, a.status, a.notes]);
    }
    console.log(`✅ Inserted ${appts.length} appointments`);

    /* ── Summary ─────────────────────────────────────────── */
    console.log('\n🎉 Database seeded successfully!');
    console.log('📊 All tables populated. Run: node server.js');
    process.exit(0);
})().catch(err => { console.error('❌ Seed failed:', err); process.exit(1); });
