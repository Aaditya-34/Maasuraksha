'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const hrChart = createVitalChart('hrChart', 'HR', VitalsEngine.history.hr, 'rgb(0,212,180)');
    const spo2Chart = createVitalChart('spo2Chart', 'SpO2', VitalsEngine.history.spo2, 'rgb(167,139,250)');
    const bpChart = createVitalChart('bpChart', 'BP', VitalsEngine.history.systolic, 'rgb(255,107,157)');
    const tempChart = createVitalChart('tempChart', 'Temp', VitalsEngine.history.temp, 'rgb(255,179,71)');

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => setLang(btn.dataset.lang));
    });

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

    const scenarioSel = document.getElementById('scenarioSelect');
    if (scenarioSel) {
        scenarioSel.addEventListener('change', () => simulateScenario(scenarioSel.value));
    }

    setInterval(() => {
        const v = VitalsEngine.tick();
        const risk = VitalsEngine.riskLevel();
        const score = VitalsEngine.riskScore();

        setText('valHR', Math.round(v.hr));
        setText('valSpO2', Math.round(v.spo2));
        setText('valSystolic', Math.round(v.systolic));
        setText('valDiastolic', Math.round(v.diastolic));
        setText('valTemp', v.temp.toFixed(1));
        setText('valHRV', Math.round(v.hrv));

        for (const [chart, key] of [[hrChart, 'hr'], [spo2Chart, 'spo2'], [bpChart, 'systolic'], [tempChart, 'temp']]) {
            if (!chart) continue;
            chart.data.labels = VitalsEngine.history[key].map((_, i) => i);
            chart.data.datasets[0].data = [...VitalsEngine.history[key]];
            chart.update('none');
        }

        const riskBar = document.getElementById('riskBar');
        const riskContainer = document.getElementById('riskContainer');
        if (riskBar) riskBar.style.width = score + '%';
        if (riskContainer) riskContainer.className = 'risk-meter ' + risk;

        const lang = getCurrentLang();
        const insightEl = document.getElementById('aiInsightText');
        if (insightEl) insightEl.textContent = LANG[lang][`aiInsight_${risk}`];

        const riskBadge = document.getElementById('riskBadge');
        if (riskBadge) {
            const cls = risk === 'low' ? 'badge-normal' : risk === 'moderate' ? 'badge-warning' : 'badge-critical';
            riskBadge.className = `badge ${cls}`;
            riskBadge.innerHTML = `<span class="badge-dot"></span> ${VitalsEngine.riskLabel()}`;
        }
    }, 2000);

    function setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    const nextVisit = new Date();
    nextVisit.setDate(nextVisit.getDate() + 3);
    const visitEl = document.getElementById('nextVisitDate');
    if (visitEl) visitEl.textContent = nextVisit.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' });

    const weekEl = document.getElementById('pregnancyWeek');
    if (weekEl) weekEl.textContent = '28';
});
