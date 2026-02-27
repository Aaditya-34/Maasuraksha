/**
 * MaaSuraksha — auth.js
 * JWT + bcryptjs authentication helpers and Express middleware.
 */

'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'maasuraksha-secret-key-2024';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '24h';
const SALT_ROUNDS = 10;

/* ── Password helpers ────────────────────────────────────────── */

async function hashPassword(plain) {
    return bcrypt.hash(plain, SALT_ROUNDS);
}

async function verifyPassword(plain, hash) {
    return bcrypt.compare(plain, hash);
}

/* ── JWT helpers ─────────────────────────────────────────────── */

function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

/* ── Express Middleware ──────────────────────────────────────── */

/**
 * requireAuth — protect a route; attaches req.user on success.
 * Usage: app.use('/api/patients', requireAuth, patientRouter)
 */
function requireAuth(req, res, next) {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ success: false, error: 'No token provided. Please log in.' });
    }

    const payload = verifyToken(token);
    if (!payload) {
        return res.status(401).json({ success: false, error: 'Invalid or expired token. Please log in again.' });
    }

    req.user = payload;   // { id, name, role, username }
    next();
}

/**
 * requireRole — restrict to specific roles.
 * Usage: router.get('/admin', requireRole('doctor'), handler)
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ success: false, error: 'Not authenticated.' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, error: `Access denied. Required role: ${roles.join(' or ')}` });
        }
        next();
    };
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, requireAuth, requireRole };
