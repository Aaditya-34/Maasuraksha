'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const hrChart   = createVitalChart('hrChart',   'HR',   VitalsEngine.history.hr,       'rgb(0,212,180)');
    const spo2Chart = createVitalChart('spo2Chart', 'SpO2', VitalsEngine.history.spo2,     'rgb(167,139,250)');
    const bpChart   = createVitalChart('bpChart',   'BP',   VitalsEngine.history.systolic, 'rgb(255,107,157)');
    const tempChart = createVitalChart('tempChart', 'Temp', VitalsEngine.history.temp,     'rgb(255,179,71)');

    // Language toggle
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => setLang(btn.dataset.lang));
    });

    // Voice alert
    const voiceBtn = document.getElementById('voiceAlertBtn');
    if (voiceBtn && 'speechSynthesis' in window) {
        voiceBtn.addEventListener('click', () => {
            const risk = VitalsEngine.riskLevel();
            const msgs = {
                low: 'Your vitals are normal. Keep drinking water and resting.',
                moderate: 'Warning: Blood pressure is high. Rest and contact your ASHA worker.',
                high: 'Emergency! Blood pressure and oxygen are critical. Call your doctor now!'
            };
            const hiMsgs = {
                low: 'Aapki sehat theek hai. Paani peete rahein.',
                moderate: 'Chetavni: BP zyada hai. Aaraam karein, ASHA didi ko bulayein.',
                high: 'Apatkal! BP aur oxygen kharab hai. Abhi doctor ko bulao!'
            };
            const lang = getCurrentLang();
            const utt = new SpeechSynthesisUtterance(lang === 'hi' ? hiMsgs[risk] : msgs[risk]);
            utt.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
            utt.rate = 0.9;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utt);
        });
    }

    // Scenario selector
    const scenarioSel = document.getElementById('scenarioSelect');
    if (scenarioSel) {
        scenarioSel.addEventListener('change', () => simulateScenario(scenarioSel.value));
    }

    // ── Live vitals loop ──────────────────────────────────────
    setInterval(() => {
        const v     = VitalsEngine.tick();
        const risk  = VitalsEngine.riskLevel();
        const score = VitalsEngine.riskScore();

        setText('valHR',        Math.round(v.hr));
        setText('valSpO2',      Math.round(v.spo2));
        setText('valSystolic',  Math.round(v.systolic));
        setText('valDiastolic', Math.round(v.diastolic));
        setText('valTemp',      v.temp.toFixed(1));
        setText('valHRV',       Math.round(v.hrv));

        for (const [chart, key] of [
            [hrChart, 'hr'], [spo2Chart, 'spo2'],
            [bpChart, 'systolic'], [tempChart, 'temp']
        ]) {
            if (!chart) continue;
            chart.data.labels           = VitalsEngine.history[key].map((_, i) => i);
            chart.data.datasets[0].data = [...VitalsEngine.history[key]];
            chart.update('none');
        }

        const riskBar       = document.getElementById('riskBar');
        const riskContainer = document.getElementById('riskContainer');
        if (riskBar)       riskBar.style.width    = score + '%';
        if (riskContainer) riskContainer.className = 'risk-meter ' + risk;

        const lang      = getCurrentLang();
        const insightEl = document.getElementById('aiInsightText');
        if (insightEl) insightEl.textContent = LANG[lang][`aiInsight_${risk}`];

        const riskBadge = document.getElementById('riskBadge');
        if (riskBadge) {
            const cls = risk === 'low' ? 'badge-normal' : risk === 'moderate' ? 'badge-warning' : 'badge-critical';
            riskBadge.className = `badge ${cls}`;
            riskBadge.innerHTML = `<span class="badge-dot"></span> ${VitalsEngine.riskLabel()}`;
        }

        // Sync to DB every 30s if online
        if (window.MaaSuraksha?.isOnline) {
            const user = window.MSAuth?.user;
            if (user?.patientId) {
                window.MaaSuraksha.syncLiveVitals(user.patientId, VitalsEngine);
            }
        }
    }, 2000);

    function setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    // Next visit date
    const nextVisit = new Date();
    nextVisit.setDate(nextVisit.getDate() + 3);
    const visitEl = document.getElementById('nextVisitDate');
    if (visitEl) visitEl.textContent = nextVisit.toLocaleDateString('en-IN', {
        weekday: 'long', month: 'short', day: 'numeric'
    });

    setText('pregnancyWeek', '28');

    // ── Load real DB data if backend is online ────────────────
    async function loadPatientData() {
        const user = window.MSAuth?.user;
        if (!user?.patientId || !window.MaaSuraksha?.isOnline) return;
        const pid = user.patientId;

        // Load real alerts
        try {
            const alerts = await window.MaaSuraksha.fetchPatientAlerts(pid);
            if (alerts?.length) renderAlerts(alerts);
        } catch(e) { console.warn('Alerts load failed', e); }

        // Load real medications
        try {
            const meds = await window.MaaSuraksha.fetchMedications(pid);
            if (meds?.length) renderMedications(meds);
        } catch(e) { console.warn('Meds load failed', e); }

        // Load recent symptoms
        try {
            const symptoms = await window.MaaSuraksha.fetchSymptoms(pid);
            if (symptoms?.length) renderLastSymptoms(symptoms[0]);
        } catch(e) { console.warn('Symptoms load failed', e); }

        // Load nutrition logs
        try {
            const nutrition = await window.MaaSuraksha.fetchNutrition(pid);
            if (nutrition?.length) renderNutritionSummary(nutrition);
        } catch(e) { console.warn('Nutrition load failed', e); }
    }

    function renderAlerts(alerts) {
        const container = document.getElementById('alertsList');
        if (!container) return;
        container.innerHTML = alerts.slice(0, 4).map(a => `
            <div style="display:flex;gap:12px;align-items:center;padding:12px;
                background:rgba(255,69,58,0.06);border-radius:var(--radius-md);
                border:1px solid rgba(255,69,58,0.15);">
                <span style="font-size:1.4rem;">🔔</span>
                <div>
                    <div style="font-size:0.88rem;font-weight:500;">${a.message}</div>
                    <div style="font-size:0.77rem;color:var(--text-muted);">${new Date(a.triggered_at).toLocaleString('en-IN')}</div>
                </div>
                <span class="badge badge-${a.severity === 'critical' ? 'critical' : 'warning'}" style="margin-left:auto;">${a.severity}</span>
            </div>
        `).join('');
    }

    function renderMedications(meds) {
        const container = document.getElementById('medicationsList');
        if (!container) return;
        container.innerHTML = meds.map(m => `
            <div style="display:flex;gap:12px;align-items:center;padding:12px;
                background:rgba(0,212,180,0.06);border-radius:var(--radius-md);
                border:1px solid rgba(0,212,180,0.15);">
                <span style="font-size:1.4rem;">💊</span>
                <div>
                    <div style="font-size:0.88rem;font-weight:500;">${m.name}</div>
                    <div style="font-size:0.77rem;color:var(--text-muted);">${m.dosage || ''} · ${m.frequency || ''}</div>
                </div>
                <span class="badge badge-normal" style="margin-left:auto;">Active</span>
            </div>
        `).join('');
    }

    function renderLastSymptoms(s) {
        const el = document.getElementById('lastSymptomSummary');
        if (!el || !s) return;
        const active = ['headache','swelling','blurred_vision','nausea',
            'abdominal_pain','fatigue','fever','reduced_fetal_movement']
            .filter(k => s[k] === 1)
            .map(k => k.replace(/_/g,' '));
        el.textContent = active.length
            ? `Last reported: ${active.join(', ')} (${s.severity})`
            : 'No symptoms reported recently.';
    }

    function renderNutritionSummary(logs) {
        const el = document.getElementById('nutritionSummary');
        if (!el || !logs.length) return;
        const today = logs[0];
        el.textContent = `Today: ${today.water_glasses} glasses water · 
            ${today.fruits} fruits · ${today.vegetables} vegetables`;
    }

    // Run on load
    setTimeout(loadPatientData, 1000);
    
    // ── Manual Vitals Submit ──────────────────────────────────
    window.submitManualVitals = async function() {
        const user = window.MSAuth?.user;
        if (!user?.patientId) {
            alert('Please log in as a patient first.');
            return;
        }

        // Read values
        const hr       = parseFloat(document.getElementById('mv_hr')?.value);
        const spo2     = parseFloat(document.getElementById('mv_spo2')?.value);
        const systolic = parseFloat(document.getElementById('mv_systolic')?.value);
        const diastolic= parseFloat(document.getElementById('mv_diastolic')?.value);
        const temp     = parseFloat(document.getElementById('mv_temp')?.value);
        const activity = document.getElementById('mv_activity')?.value || 'resting';

        // Validate — at least BP or HR must be entered
        if (!hr && !systolic && !spo2) {
            const warn = document.getElementById('vitalsWarning');
            warn.textContent = '⚠️ Please enter at least Heart Rate, SpO₂, or Blood Pressure.';
            warn.style.display = 'block';
            setTimeout(() => warn.style.display = 'none', 3000);
            return;
        }

        // Live warning for dangerous values
        const warnings = [];
        if (systolic >= 140) warnings.push('⚠️ High BP detected — please contact your doctor.');
        if (spo2 && spo2 <= 94) warnings.push('⚠️ Low SpO₂ — please rest and seek medical advice.');
        if (hr >= 110) warnings.push('⚠️ Elevated heart rate — rest and monitor.');

        const warnEl = document.getElementById('vitalsWarning');
        if (warnings.length) {
            warnEl.textContent = warnings.join(' ');
            warnEl.style.display = 'block';
        } else {
            warnEl.style.display = 'none';
        }

        const btn = document.getElementById('vitalsSubmitBtn');
        btn.disabled = true;
        btn.textContent = 'Saving...';

        const reading = {
            hr:         hr       || null,
            spo2:       spo2     || null,
            systolic:   systolic || null,
            diastolic:  diastolic|| null,
            temperature:temp     || null,
            activity
        };

        try {
            if (window.MaaSuraksha?.isOnline) {
                await window.MaaSuraksha.postVitals(user.patientId, reading);

                // Show success
                const success = document.getElementById('vitalsEntrySuccess');
                success.style.display = 'block';
                setTimeout(() => success.style.display = 'none', 3000);

                // Clear form
                ['mv_hr','mv_spo2','mv_temp','mv_systolic','mv_diastolic','mv_weight']
                    .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });

                // Reload patient data
                loadPatientData();

            } else {
                // Offline — update VitalsEngine locally so charts update
                if (!isNaN(hr))       VitalsEngine.baseline.hr.val        = hr;
                if (!isNaN(spo2))     VitalsEngine.baseline.spo2.val      = spo2;
                if (!isNaN(systolic)) VitalsEngine.baseline.systolic.val  = systolic;
                if (!isNaN(diastolic))VitalsEngine.baseline.diastolic.val = diastolic;
                if (!isNaN(temp))     VitalsEngine.baseline.temp.val      = temp;

                const success = document.getElementById('vitalsEntrySuccess');
                success.textContent = '✅ Saved locally (backend offline — will sync when connected)';
                success.style.display = 'block';
                setTimeout(() => {
                    success.style.display = 'none';
                    success.textContent = '✅ Vitals saved successfully!';
                }, 3000);
            }
        } catch(e) {
            alert('Failed to save vitals. Try again.');
            console.error(e);
        } finally {
            btn.disabled = false;
            btn.textContent = '📋 Save Vitals Reading';
        }
    };

    // ── Symptom Form Submit ───────────────────────────────────
    window.submitSymptoms = async function() {
        const user = window.MSAuth?.user;
        if (!user?.patientId) {
            alert('Please log in as a patient first.');
            return;
        }
        const btn = document.getElementById('symptomSubmitBtn');
        btn.disabled = true;
        btn.textContent = 'Saving...';

        const symptoms = {
            headache:               document.getElementById('sym_headache')?.checked ? 1 : 0,
            swelling:               document.getElementById('sym_swelling')?.checked ? 1 : 0,
            blurred_vision:         document.getElementById('sym_blurred_vision')?.checked ? 1 : 0,
            nausea:                 document.getElementById('sym_nausea')?.checked ? 1 : 0,
            abdominal_pain:         document.getElementById('sym_abdominal_pain')?.checked ? 1 : 0,
            fatigue:                document.getElementById('sym_fatigue')?.checked ? 1 : 0,
            fever:                  document.getElementById('sym_fever')?.checked ? 1 : 0,
            reduced_fetal_movement: document.getElementById('sym_reduced_fetal_movement')?.checked ? 1 : 0,
            severity:               document.getElementById('sym_severity')?.value || 'mild',
            notes:                  document.getElementById('sym_notes')?.value || ''
        };

        try {
            if (window.MaaSuraksha?.isOnline) {
                await window.MaaSuraksha.postSymptoms(user.patientId, symptoms);
                document.getElementById('symptomSuccess').style.display = 'block';
                setTimeout(() => document.getElementById('symptomSuccess').style.display = 'none', 3000);
                // Uncheck all boxes
                document.querySelectorAll('.sym-checkbox').forEach(c => c.checked = false);
                document.getElementById('sym_notes').value = '';
                loadPatientData();
            } else {
                alert('Backend offline. Start the server to save symptoms.');
            }
        } catch(e) {
            alert('Failed to save. Try again.');
        } finally {
            btn.disabled = false;
            btn.textContent = '✅ Submit Symptoms';
        }
    };

    // ── Nutrition Form Submit ─────────────────────────────────
    window.submitNutrition = async function() {
        const user = window.MSAuth?.user;
        if (!user?.patientId) {
            alert('Please log in as a patient first.');
            return;
        }
        const btn = document.getElementById('nutritionSubmitBtn');
        btn.disabled = true;
        btn.textContent = 'Saving...';

        const log = {
            meal_type:     document.getElementById('nut_meal_type')?.value || 'lunch',
            water_glasses: parseInt(document.getElementById('nut_water')?.value) || 0,
            iron_taken:    document.getElementById('nut_iron')?.checked ? 1 : 0,
            folic_taken:   document.getElementById('nut_folic')?.checked ? 1 : 0,
            calcium_taken: document.getElementById('nut_calcium')?.checked ? 1 : 0,
            fruits:        parseInt(document.getElementById('nut_fruits')?.value) || 0,
            vegetables:    parseInt(document.getElementById('nut_vegetables')?.value) || 0,
            protein:       parseInt(document.getElementById('nut_protein')?.value) || 0,
            dairy:         parseInt(document.getElementById('nut_dairy')?.value) || 0,
            notes:         document.getElementById('nut_notes')?.value || ''
        };

        try {
            if (window.MaaSuraksha?.isOnline) {
                await window.MaaSuraksha.postNutrition(user.patientId, log);
                document.getElementById('nutritionSuccess').style.display = 'block';
                setTimeout(() => document.getElementById('nutritionSuccess').style.display = 'none', 3000);
                loadPatientData();
            } else {
                alert('Backend offline. Start the server to save nutrition log.');
            }
        } catch(e) {
            alert('Failed to save. Try again.');
        } finally {
            btn.disabled = false;
            btn.textContent = '🥗 Save Nutrition Log';
        }
    };
});