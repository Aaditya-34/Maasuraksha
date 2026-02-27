'use strict';

const ASHA_PATIENTS = [
    { name: 'Radha Kumari', week: 32, village: 'Ramgarh', risk: 'high', avatar: 'R', lastVisit: '3 days ago', checkedIn: false },
    { name: 'Sunita Devi', week: 28, village: 'Bhanpur', risk: 'moderate', avatar: 'S', lastVisit: '5 days ago', checkedIn: false },
    { name: 'Geeta Yadav', week: 36, village: 'Kharagpur', risk: 'high', avatar: 'G', lastVisit: '1 week ago', checkedIn: false },
    { name: 'Priya Sharma', week: 22, village: 'Navatoli', risk: 'low', avatar: 'P', lastVisit: 'Today', checkedIn: true },
    { name: 'Meena Patel', week: 30, village: 'Dhimpur', risk: 'moderate', avatar: 'M', lastVisit: '2 days ago', checkedIn: true },
    { name: 'Anita Singh', week: 18, village: 'Ramgarh', risk: 'low', avatar: 'A', lastVisit: 'Today', checkedIn: true },
    { name: 'Lata Mahto', week: 34, village: 'Barwa', risk: 'high', avatar: 'L', lastVisit: '4 days ago', checkedIn: false },
    { name: 'Champa Verma', week: 25, village: 'Bhanpur', risk: 'low', avatar: 'C', lastVisit: '1 day ago', checkedIn: false },
];

const CHECKLIST_ITEMS = [
    { id: 'bp', icon: '💉', label: 'Blood Pressure Recorded', hi: 'Rakatchap liya gaya' },
    { id: 'weight', icon: '⚖️', label: 'Weight Measured', hi: 'Vajan maapa gaya' },
    { id: 'iron', icon: '💊', label: 'Iron/Folic Acid Taken', hi: 'Iron ki dawai lee' },
    { id: 'kick', icon: '👶', label: 'Baby Kick Count (>10)', hi: 'Bache ki kick gini' },
    { id: 'edema', icon: '🦵', label: 'Swelling Checked (Normal)', hi: 'Sujan check ki gayi' },
    { id: 'diet', icon: '🥗', label: 'Diet Counseling Done', hi: 'Diet ke baare mein bataya' },
    { id: 'danger', icon: '⚠️', label: 'Danger Signs Screened', hi: 'Khatre ke nishaan dekhe' },
    { id: 'app', icon: '📱', label: 'App Sync Verified', hi: 'App sync check ki gayi' },
];

let checkinDone = new Set(['bp', 'iron']); // pre-checked for demo

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('ashaDate').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });
    renderPatientList();
    renderChecklist();
    renderRiskChart();
    populateModalPatients();

    // Simulate connectivity toggle
    setInterval(() => {
        const el = document.getElementById('connectivityBadge');
        if (!el) return;
        const isOnline = navigator.onLine !== false;
        el.textContent = isOnline ? '🟢 Online' : '🔴 Offline';
        el.className = isOnline ? 'offline-indicator online-indicator' : 'offline-indicator';
    }, 5000);
});

function renderPatientList() {
    const list = document.getElementById('ashaPatientList');
    if (!list) return;
    list.innerHTML = '';
    ASHA_PATIENTS.forEach((p, i) => {
        const riskColor = p.risk === 'high' ? 'var(--accent-rose)' : p.risk === 'moderate' ? 'var(--accent-amber)' : 'var(--accent-teal)';
        const riskIcon = p.risk === 'high' ? '🚨' : p.risk === 'moderate' ? '⚠️' : '✅';
        const checkinBg = p.checkedIn ? 'rgba(0,212,180,0.06)' : 'rgba(255,255,255,0.02)';
        const checkinBorder = p.checkedIn ? '1px solid rgba(0,212,180,0.15)' : '1px solid rgba(255,255,255,0.05)';
        list.innerHTML += `
      <div style="display:flex;align-items:center;gap:12px;padding:12px;background:${checkinBg};border-radius:var(--radius-md);border:${checkinBorder};cursor:pointer;transition:all 0.2s;" onclick="selectAshaPatient(${i})">
        <div class="patient-avatar" style="background:${riskColor === 'var(--accent-teal)' ? 'var(--gradient-teal)' : riskColor === 'var(--accent-rose)' ? 'var(--gradient-rose)' : 'linear-gradient(135deg,var(--accent-amber),#ff6b6b)'};color:#000;">${p.avatar}</div>
        <div style="flex:1;">
          <div style="font-weight:500;font-size:0.88rem;">${p.name}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">${p.village} · Week ${p.week} · Last: ${p.lastVisit}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
          <span style="font-size:1rem;">${riskIcon}</span>
          ${p.checkedIn ? '<span style="font-size:0.7rem;color:var(--accent-teal);">✓ Done</span>' : '<span style="font-size:0.7rem;color:var(--text-muted);">Pending</span>'}
        </div>
        ${p.risk === 'high' ? `<button class="btn btn-rose btn-sm" style="font-size:0.72rem;padding:5px 10px;" onclick="event.stopPropagation();flagForDoctor('${p.name}')">🚨 Flag</button>` : ''}
      </div>`;
    });
}

function renderChecklist() {
    const cl = document.getElementById('checkinList');
    if (!cl) return;
    cl.innerHTML = '';
    CHECKLIST_ITEMS.forEach(item => {
        const done = checkinDone.has(item.id);
        cl.innerHTML += `
      <div class="checkin-tap" data-id="${item.id}"
        style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:var(--radius-md);
               background:${done ? 'rgba(0,212,180,0.1)' : 'rgba(255,255,255,0.03)'};
               border:1px solid ${done ? 'rgba(0,212,180,0.3)' : 'rgba(255,255,255,0.06)'};
               cursor:pointer;transition:all 0.2s;" onclick="toggleCheckin('${item.id}')">
        <span style="font-size:1.2rem;">${item.icon}</span>
        <span style="flex:1;font-size:0.87rem;color:${done ? 'var(--text-primary)' : 'var(--text-secondary)'};">${item.label}</span>
        <span style="font-size:1rem;">${done ? '✅' : '◯'}</span>
      </div>`;
    });
}

function toggleCheckin(id) {
    if (checkinDone.has(id)) checkinDone.delete(id);
    else checkinDone.add(id);
    renderChecklist();
}

function renderRiskChart() {
    const ctx = document.getElementById('ashaRiskChart');
    if (!ctx) return;
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['High', 'Moderate', 'Low'],
            datasets: [{ data: [2, 4, 12], backgroundColor: ['rgba(255,69,58,0.8)', 'rgba(255,179,71,0.8)', 'rgba(0,212,180,0.8)'], borderWidth: 0, borderRadius: 3 }]
        },
        options: { plugins: { legend: { position: 'bottom', labels: { color: '#9ba3c7', font: { size: 10 }, padding: 8 } } }, cutout: '60%', animation: { duration: 800 } }
    });
}

function populateModalPatients() {
    const sel = document.getElementById('modalPatient');
    if (!sel) return;
    ASHA_PATIENTS.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = `${p.name} (${p.village}, Week ${p.week})`;
        sel.appendChild(opt);
    });

    const mc = document.getElementById('modalChecklist');
    if (!mc) return;
    CHECKLIST_ITEMS.forEach(item => {
        mc.innerHTML += `
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px;border-radius:var(--radius-md);background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);">
        <input type="checkbox" data-modal-id="${item.id}" style="width:16px;height:16px;accent-color:var(--accent-teal);" />
        <span style="font-size:1rem;">${item.icon}</span>
        <span style="font-size:0.87rem;">${item.label}</span>
      </label>`;
    });
}

function openCheckin() {
    const modal = document.getElementById('checkinModal');
    if (modal) { modal.style.display = 'flex'; }
}

function closeCheckin() {
    const modal = document.getElementById('checkinModal');
    if (modal) modal.style.display = 'none';
}

function submitCheckin() {
    const count = document.querySelectorAll('[data-modal-id]:checked').length;
    const countEl = document.getElementById('checkinCount');
    if (countEl) countEl.textContent = parseInt(countEl.textContent) + 1;
    closeCheckin();
    // reset checkboxes
    document.querySelectorAll('[data-modal-id]').forEach(cb => cb.checked = false);
}

function flagForDoctor(name) {
    alert(`🚨 ${name} has been flagged for urgent doctor review. The on-duty doctor at PHC Ramgarh has been notified.`);
}

function selectAshaPatient(i) {
    // Highlight selected (for future detail panel)
}

window.openCheckin = openCheckin;
window.closeCheckin = closeCheckin;
window.submitCheckin = submitCheckin;
window.selectAshaPatient = selectAshaPatient;
window.flagForDoctor = flagForDoctor;
window.toggleCheckin = toggleCheckin;
