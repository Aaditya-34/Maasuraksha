'use strict';

const PATIENTS = [
    { id: 1, name: 'Radha Kumari', week: 32, bp: '148/96', spo2: 92, risk: 'high', avatar: 'R', village: 'Ramgarh', lastSync: '2m ago', ai: 'Systolic BP trending 128→148 over 72hrs with low HRV (38ms). SpO₂ dipping to 92% at rest. Consistent with early-stage preeclampsia. Recommend: BP monitoring every 4hrs, urine protein dipstick, antihypertensive review.' },
    { id: 2, name: 'Sunita Devi', week: 28, bp: '132/88', spo2: 94, risk: 'moderate', avatar: 'S', village: 'Bhanpur', lastSync: '5m ago', ai: 'Moderate BP elevation (132/88). HRV decreased from 55→42ms over 2 weeks. Risk of gestational hypertension. Advise: increased monitoring, reduce salt, rest, and reassess in 48hrs.' },
    { id: 3, name: 'Geeta Yadav', week: 36, bp: '140/92', spo2: 91, risk: 'high', avatar: 'G', village: 'Kharagpur', lastSync: '8m ago', ai: 'BP 140/92 at 36 weeks with Hb likely low (SpO₂ 91%, high HR 108bpm). Combined pattern of anemia + gestational hypertension. Recommend: urgent iron panel, CBC, and possible hospital admission.' },
    { id: 4, name: 'Priya Sharma', week: 22, bp: '115/72', spo2: 98, risk: 'low', avatar: 'P', village: 'Navatoli', lastSync: '3m ago', ai: 'All vitals within normal range for gestational age. HR 78bpm, BP 115/72, SpO₂ 98%. Continuing routine antenatal monitoring. No intervention needed.' },
    { id: 5, name: 'Meena Patel', week: 30, bp: '126/80', spo2: 96, risk: 'moderate', avatar: 'M', village: 'Dhimpur', lastSync: '12m ago', ai: 'HRV variability increased slightly. Glucose intolerance screening recommended given elevated resting HR (98bpm) and BMI. Early GDM risk.' },
    { id: 6, name: 'Anita Singh', week: 18, bp: '112/70', spo2: 99, risk: 'low', avatar: 'A', village: 'Ramgarh', lastSync: '1m ago', ai: 'Excellent vitals. SpO₂ consistently 99%, BP stable at 112/70. Patient compliant with iron supplements. Continue routine monitoring.' },
    { id: 7, name: 'Lata Mahto', week: 34, bp: '138/88', spo2: 93, risk: 'high', avatar: 'L', village: 'Barwa', lastSync: '20m ago', ai: 'Systolic 138 trending up. SpO₂ 93% indicating possible anemia. Week 34 — elevated risk window. Recommend hospital-level monitoring and immediate CBC.' },
    { id: 8, name: 'Champa Verma', week: 25, bp: '120/78', spo2: 97, risk: 'low', avatar: 'C', village: 'Bhanpur', lastSync: '6m ago', ai: 'Vitals stable. Mild BP rise (120→128) noted last week but reversed with rest. Continue monitoring weekly.' },
];

const ALERTS = [
    { patient: 'Radha Kumari', msg: 'Systolic BP 148 detected · 2hrs ago', severity: 'critical' },
    { patient: 'Geeta Yadav', msg: 'SpO₂ dropped to 91% · 8hrs ago', severity: 'critical' },
    { patient: 'Lata Mahto', msg: 'BP trending up over 3 days', severity: 'warning' },
    { patient: 'Sunita Devi', msg: 'HRV declining trend noted', severity: 'warning' },
    { patient: 'Meena Patel', msg: 'High resting HR (98 bpm)', severity: 'warning' },
];

let filteredPatients = [...PATIENTS];
let selectedIdx = 0;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    renderTable(filteredPatients);
    renderAlerts();
    renderCharts();
});

function renderTable(patients) {
    const tbody = document.getElementById('patientTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    patients.forEach((p, i) => {
        const badgeClass = p.risk === 'high' ? 'badge-critical' : p.risk === 'moderate' ? 'badge-warning' : 'badge-normal';
        const riskLabel = p.risk === 'high' ? '🚨 High' : p.risk === 'moderate' ? '⚠️ Moderate' : '✅ Low';
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.innerHTML = `
      <td style="display:flex;align-items:center;gap:10px;padding:14px 16px;">
        <div class="patient-avatar">${p.avatar}</div>
        <div>
          <div style="font-weight:500;font-size:0.88rem;">${p.name}</div>
          <div style="font-size:0.73rem;color:var(--text-muted);">${p.village} · ${p.lastSync}</div>
        </div>
      </td>
      <td>${p.week}w</td>
      <td style="font-family:'Poppins',sans-serif;font-weight:600;">${p.bp}</td>
      <td style="color:${p.spo2 < 94 ? 'var(--accent-rose)' : 'var(--accent-teal)'};">${p.spo2}%</td>
      <td><span class="badge ${badgeClass}">${riskLabel}</span></td>
      <td><button class="btn btn-secondary btn-sm" onclick="selectPatient(${i})" style="font-size:0.75rem;padding:5px 12px;">View</button></td>
    `;
        tr.addEventListener('click', () => selectPatient(i));
        tbody.appendChild(tr);
    });
}

function selectPatient(i) {
    selectedIdx = i;
    const p = filteredPatients[i];
    setText('selAvatar', p.avatar);
    setText('selName', p.name);
    setText('selDetails', `Week ${p.week} · ${p.risk.charAt(0).toUpperCase() + p.risk.slice(1)} Risk · ${p.village}`);
    setText('aiClinicalText', p.ai);
}

function renderAlerts() {
    const inbox = document.getElementById('alertInbox');
    if (!inbox) return;
    inbox.innerHTML = '';
    ALERTS.forEach(a => {
        const cls = a.severity === 'critical' ? 'badge-critical' : 'badge-warning';
        inbox.innerHTML += `
      <div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:rgba(255,255,255,0.03);border-radius:var(--radius-md);border:1px solid rgba(255,255,255,0.05);">
        <span style="font-size:1.1rem;">${a.severity === 'critical' ? '🚨' : '⚠️'}</span>
        <div style="flex:1;">
          <div style="font-size:0.85rem;font-weight:500;">${a.patient}</div>
          <div style="font-size:0.77rem;color:var(--text-muted);">${a.msg}</div>
        </div>
        <span class="badge ${cls}">${a.severity}</span>
      </div>`;
    });
}

function renderCharts() {
    // Risk Pie
    const pieCtx = document.getElementById('riskPieChart');
    if (pieCtx) new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: ['High Risk', 'Moderate', 'Low Risk'],
            datasets: [{ data: [3, 8, 13], backgroundColor: ['rgba(255,69,58,0.8)', 'rgba(255,179,71,0.8)', 'rgba(0,212,180,0.8)'], borderWidth: 0, borderRadius: 4 }]
        },
        options: { plugins: { legend: { position: 'right', labels: { color: '#9ba3c7', font: { size: 11 } } } }, cutout: '65%', animation: { duration: 1000 } }
    });

    // Detection line chart
    const detCtx = document.getElementById('detectionChart');
    if (detCtx) new Chart(detCtx, {
        type: 'bar',
        data: {
            labels: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'],
            datasets: [{
                label: 'Detections',
                data: [3, 5, 4, 7, 6, 3],
                backgroundColor: 'rgba(0,212,180,0.6)',
                borderRadius: 4, borderSkipped: false
            }, {
                label: 'Resolved',
                data: [2, 4, 3, 6, 5, 3],
                backgroundColor: 'rgba(167,139,250,0.4)',
                borderRadius: 4, borderSkipped: false
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#9ba3c7', font: { size: 10 } } } },
            scales: {
                x: { ticks: { color: '#5a6499', font: { size: 10 } }, grid: { display: false } },
                y: { ticks: { color: '#5a6499', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } }
            }
        }
    });
}

function filterPatients(query) {
    filteredPatients = PATIENTS.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.village.toLowerCase().includes(query.toLowerCase())
    );
    renderTable(filteredPatients);
}
window.filterPatients = filterPatients;
window.selectPatient = selectPatient;

function setText(id, val) {
    const el = document.getElementById(id); if (el) el.textContent = val;
}
// ── Sidebar navigation ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', () => {
            const text = item.textContent.trim();
            if (text.includes('Patient Roster')) showSection('patients');
            else if (text.includes('Alert Inbox')) showSection('alerts');
            else if (text.includes('Analytics')) showSection('analytics');
            else if (text.includes('Overview')) showSection('overview');

            document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // Action buttons
    document.querySelectorAll('.btn-rose').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = document.getElementById('selName')?.textContent;
            alert(`📞 Calling ${name}... (Telemedicine feature coming soon)`);
        });
    });
});

function showSection(section) {
    // All sections visible for now — just scroll to them
    const sectionMap = {
        'patients': 'patientTable',
        'alerts': 'alertInbox',
        'analytics': 'riskPieChart',
        'overview': 'highRiskCount',
    };
    const el = document.getElementById(sectionMap[section]);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

window.showSection = showSection;