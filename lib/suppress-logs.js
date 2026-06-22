/**
 * Internal Baileys log suppression.
 * Call suppressBaileysLogs() once at startup to silence noisy crypto/session
 * messages that Baileys emits during normal operation.
 *
 * Works with both ESM and CommonJS callers.
 */

const SUPPRESSED_PATTERNS = [
    /Closing session/i,
    /Closing open session/i,
    /Removing old closed session/i,
    /Decrypted message with closed session/i,
    /in favor of incoming/i,
    /prekey bundle/i,
    /SessionEntry/,
    /failed to decrypt/i,
    /Bad MAC/i,
    /Session error/i,
    /libsignal/i,
    /session_cipher/i,
    /_chains/,
    /ephemeralKeyPair/,
    /rootKey/,
    /baseKey/,
    /pendingPreKey/,
    /indexInfo/,
    /currentRatchet/,
    /registrationId/,
    /remoteIdentityKey/,
    /lastRemoteEphemeralKey/,
    /verifyMAC/i,
    /decryptWithSessions/i,
    /doDecryptWhisperMessage/i,
    /_asyncQueueExecutor/i,
    /Interactive send:/i,
    /List send:/i,
    /type: 'native_flow'/,
    /tag: 'biz'/,
];

function argToString(a) {
    if (typeof a === 'string') return a;
    if (a instanceof Error) return a.message + ' ' + (a.stack || '');
    if (a && typeof a === 'object') {
        try { return JSON.stringify(a); } catch (_) {}
        try { return String(a); } catch (_) {}
    }
    return String(a ?? '');
}

function shouldSuppress(args) {
    const str = args.map(argToString).join(' ');
    if (SUPPRESSED_PATTERNS.some(p => p.test(str))) return true;
    // Suppress raw Signal session objects logged as first arg
    if (args.some(a => a && typeof a === 'object' && (a._chains || a.indexInfo || a.currentRatchet))) return true;
    return false;
}

let _applied = false;

/**
 * Patch console.log/warn/error/info and process.stdout/stderr to suppress
 * noisy Baileys internal messages. Idempotent — safe to call multiple times.
 */
function suppressBaileysLogs() {
    if (_applied) return;
    _applied = true;

    const orig = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
    };

    for (const method of ['log', 'warn', 'error', 'info']) {
        const original = orig[method];
        console[method] = (...args) => {
            if (!shouldSuppress(args)) original.apply(console, args);
        };
    }

    const stdoutWrite = process.stdout.write.bind(process.stdout);
    const stderrWrite = process.stderr.write.bind(process.stderr);

    process.stdout.write = (chunk, encoding, callback) =>
        shouldSuppress([chunk.toString()]) ? true : stdoutWrite(chunk, encoding, callback);

    process.stderr.write = (chunk, encoding, callback) =>
        shouldSuppress([chunk.toString()]) ? true : stderrWrite(chunk, encoding, callback);
}

/**
 * Restore original console methods (useful for testing).
 */
function restoreLogs() {
    _applied = false;
}

export { suppressBaileysLogs, restoreLogs, shouldSuppress, SUPPRESSED_PATTERNS };
export default suppressBaileysLogs;
