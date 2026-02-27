/* ============================================================
   MaaSuraksha — main.js  (Shared Utilities)
   ============================================================ */

'use strict';

/* ── Navbar scroll effect ─────────────────────────────────── */
const navbar = document.querySelector('.navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  });
}

/* ── Scroll Reveal ────────────────────────────────────────── */
function initScrollReveal() {
  const els = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  els.forEach(el => io.observe(el));
}
document.addEventListener('DOMContentLoaded', initScrollReveal);

/* ── Animated Counters ────────────────────────────────────── */
function animateCounter(el, target, duration = 1800, suffix = '') {
  let start = 0;
  const step = (timestamp) => {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target).toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const target = parseFloat(e.target.dataset.counter);
        const suffix = e.target.dataset.suffix || '';
        animateCounter(e.target, target, 1800, suffix);
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => io.observe(c));
}
document.addEventListener('DOMContentLoaded', initCounters);

/* ── Simulated Vitals Engine ──────────────────────────────── */
const VitalsEngine = {
  baseline: {
    hr:   { val: 82, min: 60, max: 110, unit: 'bpm',   name: 'Heart Rate' },
    spo2: { val: 97, min: 89, max: 100, unit: '%',     name: 'SpO₂' },
    systolic: { val: 118, min: 90, max: 160, unit: 'mmHg', name: 'Systolic BP' },
    diastolic:{ val: 76,  min: 60, max: 100, unit: 'mmHg', name: 'Diastolic BP' },
    temp: { val: 36.8, min: 36.0, max: 38.5, unit: '°C', name: 'Temperature' },
    hrv:  { val: 42,   min: 20,   max: 80,   unit: 'ms',  name: 'HRV' },
  },
  current: {},
  history: { hr: [], spo2: [], systolic: [], temp: [] },
  historyLen: 20,

  init() {
    for (const [k, v] of Object.entries(this.baseline)) {
      this.current[k] = v.val;
    }
    for (const key of Object.keys(this.history)) {
      for (let i = 0; i < this.historyLen; i++) {
        this.history[key].push(this._noisy(this.baseline[key].val, 3));
      }
    }
  },

  _noisy(base, noise) {
    return +(base + (Math.random() - 0.5) * 2 * noise).toFixed(1);
  },

  tick() {
    for (const [k, v] of Object.entries(this.baseline)) {
      const noisy = this._noisy(v.val, (v.max - v.min) * 0.04);
      this.current[k] = Math.min(v.max, Math.max(v.min, noisy));
    }
    for (const key of Object.keys(this.history)) {
      this.history[key].push(this.current[key]);
      if (this.history[key].length > this.historyLen) this.history[key].shift();
    }
    return this.current;
  },

  riskScore() {
    const { systolic, diastolic, spo2, hr } = this.current;
    let score = 0;
    if (systolic  >= 140) score += 35;
    else if (systolic >= 130) score += 15;
    if (diastolic >= 90) score += 25;
    if (spo2 <= 92) score += 30;
    else if (spo2 <= 95) score += 15;
    if (hr >= 100) score += 10;
    return Math.min(score, 100);
  },

  riskLevel() {
    const s = this.riskScore();
    if (s >= 50) return 'high';
    if (s >= 20) return 'moderate';
    return 'low';
  },

  riskLabel() {
    const map = { low: 'Low Risk ✅', moderate: 'Moderate Risk ⚠️', high: 'High Risk 🚨' };
    return map[this.riskLevel()];
  }
};

VitalsEngine.init();
window.VitalsEngine = VitalsEngine;

/* ── Chart.js Helper ──────────────────────────────────────── */
function createVitalChart(canvasId, label, data, color) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array.from({ length: data.length }, (_, i) => i),
      datasets: [{
        label,
        data: [...data],
        borderColor: color,
        backgroundColor: color.replace(')', ', 0.08)').replace('rgb', 'rgba'),
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.45,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { title: () => '' },
        backgroundColor: 'rgba(13,13,36,0.95)',
        bodyColor: '#f0f4ff', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
        padding: 10,
      }},
      scales: {
        x: { display: false },
        y: { display: false }
      },
      animation: { duration: 400, easing: 'easeInOutCubic' }
    }
  });
}

window.createVitalChart = createVitalChart;

/* ── Language Strings ─────────────────────────────────────── */
const LANG = {
  en: {
    heartRate: 'Heart Rate',
    spo2: 'Blood Oxygen',
    bp: 'Blood Pressure',
    temp: 'Temperature',
    hrv: 'Heart Rate Variability',
    riskLevel: 'Risk Level',
    aiInsight_low: '✨ Your vitals are stable. Keep staying hydrated and take rest as needed. Your next check-up is in 3 days.',
    aiInsight_moderate: '⚠️ Your blood pressure is slightly elevated. Please rest, avoid stress, and drink water. Contact your ASHA worker if it doesn\'t improve in an hour.',
    aiInsight_high: '🚨 Alert: Your blood pressure is significantly high and SpO₂ is low. Contact your doctor immediately or call the emergency helpline.',
    activity: 'Activity Level',
    pregnancy_week: 'Week of Pregnancy',
    nextVisit: 'Next Scheduled Visit',
  },
  hi: {
    heartRate: 'हृदय गति',
    spo2: 'रक्त ऑक्सीजन',
    bp: 'रक्तचाप',
    temp: 'तापमान',
    hrv: 'हृदय गति विविधता',
    riskLevel: 'जोखिम स्तर',
    aiInsight_low: '✨ आपके स्वास्थ्य संकेत सामान्य हैं। पानी पीते रहें और आराम करें। अगली जांच 3 दिन बाद है।',
    aiInsight_moderate: '⚠️ आपका रक्तचाप थोड़ा अधिक है। कृपया आराम करें और पानी पिएं। एक घंटे में सुधार न हो तो आशा कार्यकर्ता से संपर्क करें।',
    aiInsight_high: '🚨 चेतावनी: आपका रक्तचाप बहुत अधिक और SpO₂ कम है। तुरंत डॉक्टर से संपर्क करें।',
    activity: 'गतिविधि स्तर',
    pregnancy_week: 'गर्भावस्था का सप्ताह',
    nextVisit: 'अगली निर्धारित यात्रा',
  }
};

let currentLang = 'en';
function setLang(lang) {
  currentLang = lang;
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  // Re-render language-aware elements
  document.querySelectorAll('[data-langkey]').forEach(el => {
    const key = el.dataset.langkey;
    if (LANG[lang][key]) el.textContent = LANG[lang][key];
  });
}
window.setLang = setLang;
window.LANG = LANG;
window.getCurrentLang = () => currentLang;

/* ── Mobile Sidebar Toggle ────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.querySelector('.sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  }
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
  }
});

/* ── Simulate a patient scenario (randomizer) ─────────────── */
function simulateScenario(scenario) {
  const scenarios = {
    normal: { systolic: 118, diastolic: 76, hr: 80, spo2: 97, temp: 36.8 },
    preeclampsia: { systolic: 148, diastolic: 96, hr: 105, spo2: 93, temp: 37.4 },
    anemia: { systolic: 100, diastolic: 65, hr: 110, spo2: 90, temp: 36.4 },
    gestational_diabetes: { systolic: 130, diastolic: 85, hr: 88, spo2: 96, temp: 37.1 },
  };
  const s = scenarios[scenario] || scenarios.normal;
  for (const [k, v] of Object.entries(s)) {
    VitalsEngine.baseline[k] = { ...VitalsEngine.baseline[k], val: v };
    VitalsEngine.current[k] = v;
  }
}
window.simulateScenario = simulateScenario;
