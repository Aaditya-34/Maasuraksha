/**
 * MaaSuraksha — js/api.js
 * Frontend API client.
 * Tries to reach the local backend at http://localhost:3001.
 * Falls back silently to the simulated VitalsEngine if unavailable.
 */

'use strict';

const API_BASE = 'http://localhost:3001/api';
let API_ONLINE = false; // flips to true once health-check passes

/* ── Connectivity Check ──────────────────────────────────── */
async function checkApiHealth() {
    try {
        const r = await fetch(`http://localhost:3001/health`, { signal: AbortSignal.timeout(1500) });
        if (r.ok) {
            API_ONLINE = true;
            console.info('[API] ✅ Backend connected at', API_BASE);
            document.querySelectorAll('.api-status-badge').forEach(el => {
                el.textContent = '🟢 Live DB';
                el.style.color = 'var(--accent-teal)';
            });
        }
    } catch {
        API_ONLINE = false;
        console.info('[API] ℹ️  Backend offline — using simulated data');
        document.querySelectorAll('.api-status-badge').forEach(el => {
            el.textContent = '⚡ Simulated';
            el.style.color = 'var(--accent-amber)';
        });
    }
    return API_ONLINE;
}

/* ── Generic fetch wrapper ───────────────────────────────── */
async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
        ...options,
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
    return res.json();
}

/* ══════════════════════════════════════════════════════════
   PATIENTS
══════════════════════════════════════════════════════════ */

/**
 * Fetch all patients (risk-sorted).
 * @returns {Promise<Array>}
 */
async function fetchPatients() {
    if (!API_ONLINE) return null;
    const { data } = await apiFetch('/patients');
    return data;
}

/**
 * Fetch a single patient by ID.
 * @param {number} id
 */
async function fetchPatient(id) {
    if (!API_ONLINE) return null;
    const { data } = await apiFetch(`/patients/${id}`);
    return data;
}

/* ══════════════════════════════════════════════════════════
   VITALS
══════════════════════════════════════════════════════════ */

/**
 * Fetch recent vitals for a patient.
 * @param {number} patientId
 * @param {number} limit   number of readings to return
 */
async function fetchVitals(patientId, limit = 20) {
    if (!API_ONLINE) return null;
    const { data } = await apiFetch(`/patients/${patientId}/vitals?limit=${limit}`);
    return data;
}

/**
 * Post a new vitals reading (IoT band sync simulation).
 * @param {number} patientId
 * @param {object} reading   { hr, spo2, systolic, diastolic, temperature, hrv, activity }
 */
async function postVitals(patientId, reading) {
    if (!API_ONLINE) return null;
    return apiFetch(`/patients/${patientId}/vitals`, {
        method: 'POST',
        body: JSON.stringify(reading),
    });
}

/* ══════════════════════════════════════════════════════════
   ALERTS
══════════════════════════════════════════════════════════ */

/**
 * Fetch all unresolved alerts (doctor-wide).
 */
async function fetchAlerts() {
    if (!API_ONLINE) return null;
    const { data } = await apiFetch('/alerts');
    return data;
}

/**
 * Fetch alerts for a specific patient.
 */
async function fetchPatientAlerts(patientId) {
    if (!API_ONLINE) return null;
    const { data } = await apiFetch(`/patients/${patientId}/alerts`);
    return data;
}

/**
 * Resolve an alert by ID.
 */
async function resolveAlert(alertId) {
    if (!API_ONLINE) return null;
    return apiFetch(`/alerts/${alertId}/resolve`, { method: 'PATCH' });
}

/* ══════════════════════════════════════════════════════════
   CHECK-INS
══════════════════════════════════════════════════════════ */

/**
 * Submit a new ASHA check-in.
 * @param {object} checkin  { patient_id, asha_id, bp_done, ... }
 */
async function postCheckin(checkin) {
    if (!API_ONLINE) return null;
    return apiFetch('/checkins', { method: 'POST', body: JSON.stringify(checkin) });
}

/**
 * Get check-in history for a patient.
 */
async function fetchCheckins(patientId) {
    if (!API_ONLINE) return null;
    const { data } = await apiFetch(`/patients/${patientId}/checkins`);
    return data;
}

/* ══════════════════════════════════════════════════════════
   MEDICATIONS & APPOINTMENTS
══════════════════════════════════════════════════════════ */

async function fetchMedications(patientId) {
    if (!API_ONLINE) return null;
    const { data } = await apiFetch(`/patients/${patientId}/medications`);
    return data;
}

async function fetchAppointments(patientId) {
    if (!API_ONLINE) return null;
    const { data } = await apiFetch(`/patients/${patientId}/appointments`);
    return data;
}

async function postAppointment(appointment) {
    if (!API_ONLINE) return null;
    return apiFetch('/appointments', { method: 'POST', body: JSON.stringify(appointment) });
}

/* ══════════════════════════════════════════════════════════
   ANALYTICS
══════════════════════════════════════════════════════════ */

/**
 * Doctor dashboard overview stats.
 */
async function fetchAnalyticsOverview() {
    if (!API_ONLINE) return null;
    const { data } = await apiFetch('/analytics/overview');
    return data;
}

/**
 * 7-day vitals trend for a patient.
 */
async function fetchVitalsTrend(patientId) {
    if (!API_ONLINE) return null;
    const { data } = await apiFetch(`/analytics/vitals-trend/${patientId}`);
    return data;
}

/* ══════════════════════════════════════════════════════════
   BULK REAL-TIME SYNC
   Called from patient.js to push every VitalsEngine tick
   to the real database when online.
══════════════════════════════════════════════════════════ */
async function syncLiveVitals(patientId, engine) {
    if (!API_ONLINE || !engine) return;
    const v = engine.current;
    try {
        await postVitals(patientId, {
            hr: v.hr,
            spo2: v.spo2,
            systolic: v.bpSystolic,
            diastolic: v.bpDiastolic,
            temperature: v.temperature,
            hrv: v.hrv,
            activity: 'monitoring',
        });
    } catch { /* silent — will retry on next tick */ }
}
/* ══════════════════════════════════════════════════════════════
   SYMPTOMS
══════════════════════════════════════════════════════════════ */
async function fetchSymptoms(patientId) {
    if (!API_ONLINE) return null;
    const { data } = await apiFetch(`/patients/${patientId}/symptoms`);
    return data;
}

async function postSymptoms(patientId, symptoms) {
    if (!API_ONLINE) return null;
    return apiFetch(`/patients/${patientId}/symptoms`, {
        method: 'POST',
        body: JSON.stringify(symptoms)
    });
}

/* ══════════════════════════════════════════════════════════════
   NUTRITION
══════════════════════════════════════════════════════════════ */
async function fetchNutrition(patientId) {
    if (!API_ONLINE) return null;
    const { data } = await apiFetch(`/patients/${patientId}/nutrition`);
    return data;
}

async function postNutrition(patientId, log) {
    if (!API_ONLINE) return null;
    return apiFetch(`/patients/${patientId}/nutrition`, {
        method: 'POST',
        body: JSON.stringify(log)
    });
}
/* ── Auto-initialise on load ─────────────────────────────── */
checkApiHealth();

/* ── Exports (global for non-module HTML pages) ──────────── */
window.MaaSuraksha = window.MaaSuraksha || {};
Object.assign(window.MaaSuraksha, {
    checkApiHealth,
    fetchPatients,
    fetchPatient,
    fetchVitals,
    postVitals,
    fetchAlerts,
    fetchPatientAlerts,
    resolveAlert,
    postCheckin,
    fetchCheckins,
    fetchMedications,
    fetchAppointments,
    postAppointment,
    fetchAnalyticsOverview,
    fetchVitalsTrend,
    syncLiveVitals,
    fetchSymptoms,
    postSymptoms,
    fetchNutrition,
    postNutrition,
    get isOnline() { return API_ONLINE; }
});
