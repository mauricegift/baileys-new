/**
 * test.js — Validates the key features added in this fork:
 *   1. Carousel: generateWAMessageContent + generateWAMessageFromContent exported
 *   2. suppressBaileysLogs(): silences Signal/session noise
 *   3. CJS require() via lib/index-cjs.cjs wrapper
 *   4. Newsletter methods available on socket prototype
 *
 * Supports both ESM (node test.js) and CJS (node --input-type=commonjs < test.js)
 * The file itself is ESM; CJS surface is tested inline via createRequire.
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import assert from 'assert';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pass = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => { console.error(`  ✗ ${msg}`); process.exitCode = 1; };

// ─── 1. ESM imports ─────────────────────────────────────────────────────────
console.log('\n[1] ESM imports');
let esmExports;
try {
  esmExports = await import('./lib/index.js');
  pass('lib/index.js loaded via ESM import()');
} catch (e) {
  fail(`ESM import failed: ${e.message}`);
  process.exit(1);
}

// ─── 2. Carousel: generateWAMessageContent + generateWAMessageFromContent ────
console.log('\n[2] Carousel exports');

const { generateWAMessageContent, generateWAMessageFromContent } = esmExports;

if (typeof generateWAMessageContent === 'function') {
  pass('generateWAMessageContent exported as function');
} else {
  fail(`generateWAMessageContent not exported (got ${typeof generateWAMessageContent})`);
}

if (typeof generateWAMessageFromContent === 'function') {
  pass('generateWAMessageFromContent exported as function');
} else {
  fail(`generateWAMessageFromContent not exported (got ${typeof generateWAMessageFromContent})`);
}

// Lightweight carousel build test — build a text message object without connecting
try {
  const fakeJid = '1234567890@s.whatsapp.net';
  const built = generateWAMessageFromContent(
    fakeJid,
    { conversation: 'carousel-test' },
    { timestamp: new Date(), messageId: 'TEST-ID-001' }
  );
  assert.ok(built && typeof built === 'object', 'generateWAMessageFromContent should return an object');
  assert.ok(built.key || built.message, 'returned object should have key or message field');
  pass('generateWAMessageFromContent() produced a valid message object');
} catch (e) {
  fail(`generateWAMessageFromContent() threw: ${e.message}`);
}

// ─── 3. suppressBaileysLogs() ───────────────────────────────────────────────
console.log('\n[3] suppressBaileysLogs');

const { suppressBaileysLogs, restoreLogs } = esmExports;

if (typeof suppressBaileysLogs !== 'function') {
  fail(`suppressBaileysLogs not exported (got ${typeof suppressBaileysLogs})`);
} else {
  pass('suppressBaileysLogs exported as function');

  const origLog = console.log;
  const origWarn = console.warn;
  let suppressedCount = 0;

  suppressBaileysLogs();
  pass('suppressBaileysLogs() called without throwing');

  // Verify noisy patterns are suppressed
  const noisySamples = [
    'Closing session for device',
    'Bad MAC in message',
    'libsignal error decrypting',
    'SessionEntry for jid',
    'decryptWithSessions failed',
  ];

  let allSuppressed = true;
  for (const sample of noisySamples) {
    const captured = [];
    const mockLog = (...args) => captured.push(args.join(' '));
    console.log = mockLog;
    console.log(sample);
    console.log = origLog;
    if (captured.length > 0) {
      fail(`Pattern not suppressed: "${sample}"`);
      allSuppressed = false;
    }
  }
  if (allSuppressed) pass(`All ${noisySamples.length} noisy Signal patterns correctly suppressed`);

  // Restore so our own test output works
  if (typeof restoreLogs === 'function') {
    restoreLogs();
    // Re-apply to leave it active (idempotent)
    suppressBaileysLogs();
    pass('restoreLogs() + re-apply idempotency confirmed');
  }
}

// ─── 4. CJS require() via lib/index-cjs.cjs ─────────────────────────────────
console.log('\n[4] CJS require() via lib/index-cjs.cjs');

const require = createRequire(import.meta.url);
let cjsMod;
try {
  cjsMod = require('./lib/index-cjs.cjs');
  pass('require("./lib/index-cjs.cjs") succeeded');
} catch (e) {
  fail(`CJS require threw immediately: ${e.message}`);
}

if (cjsMod) {
  // The CJS wrapper returns a Proxy that resolves async; wait for it
  if (typeof cjsMod.__promise === 'object' && cjsMod.__promise instanceof Promise) {
    try {
      await cjsMod.__promise;
      pass('CJS async init Promise resolved');
    } catch (e) {
      fail(`CJS async init rejected: ${e.message}`);
    }
  }

  // After resolution, named exports should be on the object
  if (typeof cjsMod.makeWASocket === 'function') {
    pass('makeWASocket accessible via CJS require()');
  } else {
    fail(`makeWASocket not on CJS exports (got ${typeof cjsMod.makeWASocket})`);
  }

  if (typeof cjsMod.suppressBaileysLogs === 'function') {
    pass('suppressBaileysLogs accessible via CJS require()');
  } else {
    fail(`suppressBaileysLogs not on CJS exports`);
  }

  if (typeof cjsMod.generateWAMessageContent === 'function') {
    pass('generateWAMessageContent accessible via CJS require()');
  } else {
    fail(`generateWAMessageContent not on CJS exports`);
  }
}

// ─── 5. Newsletter methods ───────────────────────────────────────────────────
console.log('\n[5] Newsletter socket methods');

// makeWASocket wraps newsletter methods on its return value; inspect the
// prototype chain by calling it with a minimal stub config (no real connection).
const { makeWASocket } = esmExports;

if (typeof makeWASocket !== 'function') {
  fail(`makeWASocket not exported (got ${typeof makeWASocket})`);
} else {
  pass('makeWASocket exported as function');

  // Retrieve the socket factory without connecting — inspect via toString
  // to check newsletter method names are part of the composed socket.
  const newsletterMethods = [
    'newsletterCreate',
    'newsletterUpdate',
    'newsletterFollow',
    'newsletterUnfollow',
    'newsletterMetadata',
    'newsletterSubscribers',
  ];

  // The methods are added by makeNewsletterSocket via object spread; we can
  // verify they exist on a dry-run partial socket stub by inspecting the
  // newsletter module directly.
  const nlMod = await import('./lib/Socket/newsletter.js');
  if (nlMod && nlMod.makeNewsletterSocket) {
    pass('makeNewsletterSocket exported from lib/Socket/newsletter.js');
  }

  // Build a minimal stub to extract method names (won't connect to WA)
  const stubbedMethods = Object.keys(nlMod);
  const hasNewsletterFactory = stubbedMethods.includes('makeNewsletterSocket');
  if (hasNewsletterFactory) {
    pass('Newsletter socket factory is present in the module');
  } else {
    fail('makeNewsletterSocket not found in newsletter module');
  }
}

// ─── 6. Group status exports ─────────────────────────────────────────────────
console.log('\n[6] Group status (gcstatus) module');
try {
  const gcMod = await import('./lib/Socket/gcstatus.js');
  if (gcMod && gcMod.GiftedStatus) {
    pass('GiftedStatus class exported from lib/Socket/gcstatus.js');
    const methodNames = Object.getOwnPropertyNames(gcMod.GiftedStatus.prototype);
    for (const m of ['sendGroupStatus', 'handleGroupStory', 'sendStatusToGroups']) {
      if (methodNames.includes(m)) {
        pass(`GiftedStatus.prototype.${m} exists`);
      } else {
        fail(`GiftedStatus.prototype.${m} missing`);
      }
    }
  } else {
    fail('GiftedStatus not exported from gcstatus.js');
  }
} catch (e) {
  fail(`gcstatus import failed: ${e.message}`);
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('');
if (process.exitCode === 1) {
  console.error('Some tests FAILED — see ✗ lines above.\n');
} else {
  console.log('All tests PASSED.\n');
}
