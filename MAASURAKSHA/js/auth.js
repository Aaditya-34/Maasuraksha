/**
 * MaaSuraksha — js/auth.js
 * Frontend authentication guard.
 * - Stores JWT in localStorage
 * - requireAuth() guards dashboard pages (redirects to login.html if no valid token)
 * - logout() clears token and redirects
 * - Attaches user info to window.MSAuth for dashboards to read
 */

'use strict';

const AUTH_KEY = 'ms_auth_token';
const USER_KEY = 'ms_auth_user';
const LOGIN_PAGE = 'login.html';

/* ── Token storage ───────────────────────────────────────────── */

function saveSession(token, user) {
    localStorage.setItem(AUTH_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function getToken() {
    return localStorage.getItem(AUTH_KEY);
}

function getUser() {
    try {
        return JSON.parse(localStorage.getItem(USER_KEY));
    } catch { return null; }
}

function clearSession() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(USER_KEY);
}

/* ── JWT decode (client-side, no verify) ─────────────────────── */

function decodeJwt(token) {
    try {
        const payload = token.split('.')[1];
        return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch { return null; }
}

function isTokenExpired(token) {
    const p = decodeJwt(token);
    if (!p || !p.exp) return true;
    return Date.now() >= p.exp * 1000;
}

/* ── Auth guard ──────────────────────────────────────────────── */

/**
 * Call this at the TOP of every dashboard page.
 * allowedRoles: array of roles that may access the page, e.g. ['doctor']
 * If auth fails → redirects to login.html
 * Returns the user object if authenticated.
 */
function requireAuth(allowedRoles = []) {
    const token = getToken();
    const user = getUser();

    if (!token || !user || isTokenExpired(token)) {
        clearSession();
        window.location.replace(LOGIN_PAGE);
        return null;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        // Wrong role — redirect to the correct dashboard
        redirectToDashboard(user.role);
        return null;
    }

    // Attach to global for easy dashboard access
    window.MSAuth = { token, user, isLoggedIn: true };
    return user;
}

/* ── Logout ──────────────────────────────────────────────────── */

async function logout() {
    const token = getToken();
    if (token) {
        try {
            const base = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'http://localhost:3001'
                : 'https://maasuraksha-api.onrender.com';
            await fetch(`${base}/api/auth/logout`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch { /* server may be down — still clear locally */ }
    }
    clearSession();
    window.location.replace(LOGIN_PAGE);
}

/* ── Login API call ──────────────────────────────────────────── */

async function login(username, password) {
    const base = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3001'
        : 'https://maasuraksha-api.onrender.com';
    const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Login failed.');
    }
    saveSession(data.token, data.user);
    return data.user;
}

/* ── Dashboard routing by role ───────────────────────────────── */

function redirectToDashboard(role) {
    const map = {
        doctor: 'dashboard-doctor.html',
        asha: 'dashboard-asha.html',
        patient: 'dashboard-patient.html',
    };
    window.location.replace(map[role] || LOGIN_PAGE);
}

/* ── Render user info in navbar (optional helper) ────────────── */

function renderNavUser() {
    const user = getUser();
    if (!user) return;

    // Try to fill in any element with id="nav-username" or id="nav-role"
    const nameEl = document.getElementById('nav-username');
    const roleEl = document.getElementById('nav-role');
    const avatarEl = document.getElementById('nav-avatar');

    if (nameEl) nameEl.textContent = user.name || user.username;
    if (roleEl) roleEl.textContent = user.role?.charAt(0).toUpperCase() + user.role?.slice(1);
    if (avatarEl) avatarEl.textContent = (user.name || 'U').charAt(0).toUpperCase();
}

/* ── Patch api.js to always send Authorization header ───────── */
// Override fetch globally so api.js calls are automatically authenticated
(function patchFetch() {
    const _fetch = window.fetch.bind(window);
    window.fetch = function (url, opts = {}) {
        const token = getToken();
        if (token && typeof url === 'string' && (url.includes('localhost:3001/api') || url.includes('onrender.com/api'))) {
            opts.headers = Object.assign({ Authorization: `Bearer ${token}` }, opts.headers || {});
        }
        return _fetch(url, opts);
    };
})();

/* ── Expose globally ─────────────────────────────────────────── */
window.MSAuth = window.MSAuth || { isLoggedIn: false, user: null, token: null };
window.MSAuth.requireAuth = requireAuth;
window.MSAuth.logout = logout;
window.MSAuth.login = login;
window.MSAuth.getUser = getUser;
window.MSAuth.getToken = getToken;
window.MSAuth.renderNavUser = renderNavUser;
window.MSAuth.redirectToDashboard = redirectToDashboard;
