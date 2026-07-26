/*
    Read-only mode.

    Putting LighterPack into read-only mode is an operational action, not a deploy.
    Create config/readonly.json on the server and every subsequent request picks it up:

        { "enabled": true, "message": "Back in an hour." }

    The file is re-read whenever its mtime or size changes, so the banner text can be
    reworded in the middle of a maintenance window without restarting node. No file at
    all - the normal case - means read-only mode is off.
*/

const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG_PATH = path.join(__dirname, '../config/readonly.json');

const DEFAULT_MESSAGE = 'LighterPack is temporarily read-only while we perform some maintenance. '
    + 'Your lists are safe, but changes you make right now will not be saved.';

// Requests that never reach the database, plus /signin, which is how an existing user
// loads their library. Everything else that writes is blocked while read-only.
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
const ALLOWED_WRITE_PATHS = ['/signin', '/forgotusername'];

const OFF = Object.freeze({ enabled: false, message: '' });

function normalizePath(requestPath) {
    const normalized = String(requestPath).toLowerCase().replace(/\/+$/, '');
    return normalized || '/';
}

function createReadOnlyState(configPath) {
    let cached = OFF;
    let cachedKey = null;
    let lastGood = null;

    function getReadOnly() {
        let stats;

        try {
            stats = fs.statSync(configPath);
        } catch (err) {
            if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
                cached = OFF;
                cachedKey = null;
                lastGood = null;
                return cached;
            }

            // Unreadable for some other reason. Hold on to whatever we last knew rather
            // than letting a filesystem hiccup quietly un-freeze the site.
            cachedKey = null;
            cached = lastGood || OFF;
            return cached;
        }

        const key = `${stats.mtimeMs}:${stats.size}`;
        if (key === cachedKey) {
            return cached;
        }
        cachedKey = key;

        let parsed;
        try {
            parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (err) {
            // A file that exists but does not parse is ambiguous. Treating it as "writes
            // are allowed" would let a stray typo un-freeze the database, so keep the last
            // state that did parse, and assume read-only if there has never been one.
            cached = lastGood || Object.freeze({ enabled: true, message: DEFAULT_MESSAGE });
            return cached;
        }

        const enabled = Boolean(parsed) && parsed.enabled === true;
        const message = parsed && typeof parsed.message === 'string' && parsed.message.trim()
            ? parsed.message.trim()
            : DEFAULT_MESSAGE;

        cached = enabled ? Object.freeze({ enabled: true, message }) : OFF;
        lastGood = cached;
        return cached;
    }

    function isReadOnly() {
        return getReadOnly().enabled;
    }

    /*
        The script tag that hands the current state to the client bundle. Escaping '<'
        is what stops an operator's wording from closing the tag early or opening an
        HTML comment; the line separators are escaped because they are legal in JSON
        but not inside a JavaScript string literal.
    */
    function renderClientScript() {
        const state = getReadOnly();
        const payload = state.enabled
            ? { enabled: true, message: state.message }
            : { enabled: false };

        const json = JSON.stringify(payload)
            .replace(/</g, '\\u003c')
            .replace(/\\u2028/g, '\\u2028')
            .replace(/\\u2029/g, '\\u2029');

        return `<script>window.lpReadOnly = ${json};</script>`;
    }

    /*
        Express middleware. A single choke point in front of the routers, so a write
        endpoint added later is blocked by default rather than by remembering to
        annotate it.

        503 rather than 403 on purpose: the client treats 401 and 403 as "your session
        expired" and bounces to /signin.
    */
    function createGuard(log) {
        return function readOnlyGuard(req, res, next) {
            if (SAFE_METHODS.indexOf(req.method) > -1) {
                return next();
            }

            const state = getReadOnly();
            if (!state.enabled) {
                return next();
            }

            if (ALLOWED_WRITE_PATHS.indexOf(normalizePath(req.path)) > -1) {
                return next();
            }

            if (log) {
                log(req, { message: 'Blocked write, read-only mode is on', path: req.path });
            }

            res.set('Retry-After', '3600');
            return res.status(503).json({
                readOnly: true,
                message: state.message,
                errors: [{ message: state.message }],
            });
        };
    }

    return {
        getReadOnly, isReadOnly, renderClientScript, createGuard,
    };
}

const readOnly = createReadOnlyState(DEFAULT_CONFIG_PATH);

module.exports = {
    getReadOnly: readOnly.getReadOnly,
    isReadOnly: readOnly.isReadOnly,
    renderClientScript: readOnly.renderClientScript,
    createGuard: readOnly.createGuard,
    createReadOnlyState,
    DEFAULT_MESSAGE,
    DEFAULT_CONFIG_PATH,
};
