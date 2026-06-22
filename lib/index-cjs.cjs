/**
 * CommonJS entry-point for @whiskeysockets/baileys
 *
 * Wraps the ESM-only lib/ output so CJS callers can use require():
 *   const { makeWASocket, suppressBaileysLogs } = require('@whiskeysockets/baileys')
 */
'use strict';
const { createRequire } = require('module');
const { pathToFileURL } = require('url');
const path = require('path');

// We load the ESM entry asynchronously at module-eval time and re-export
// everything once the dynamic import resolves. For synchronous require()
// callers a proxy object is returned immediately; it becomes populated
// once the Promise resolves in the same tick (Node ≥ 12 evaluates top-level
// module code before handing control back to require()).

let _exports = {};
let _ready = false;
let _readyCallbacks = [];

const _promise = import(pathToFileURL(path.join(__dirname, 'index.js')).href).then(mod => {
    // Spread all named exports + default onto our exports object
    for (const [k, v] of Object.entries(mod)) {
        _exports[k] = v;
        module.exports[k] = v;
    }
    // Ensure default export is also accessible
    if (mod.default) {
        module.exports.default = mod.default;
        module.exports.makeWASocket = mod.default;
    }
    _ready = true;
    _readyCallbacks.forEach(cb => cb());
});

// Synchronous proxy — properties resolve after the first await in callers
module.exports = new Proxy(_exports, {
    get(target, prop) {
        if (prop === '__esModule') return true;
        if (prop === 'then') return undefined; // not a thenable
        if (prop === '__ready') return _ready;
        if (prop === '__promise') return _promise;
        return target[prop];
    }
});
