/**
 * lulz Examples
 *
 * Various patterns and use cases
 */

import {
  flow,
  subflow,
  compose,
  Inject,
  Debug,
  Function as Fn,
  Change,
  Switch,
  Template,
  Delay,
  Join,
  Split,
} from './index.js';

// Custom logger to capture output
const logs = [];
const logger = (...args) => {
  logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
  console.log(...args);
};

// ============================================================
// EXAMPLE 1: Basic pipe connection
// ============================================================

console.log('\n=== Example 1: Basic Inject → Debug ===\n');

const example1 = flow([
  [Inject({ payload: 'Hello FlowGraph!', once: true }), Debug({ name: 'output', logger })],
]);

example1.start();

// ============================================================
// EXAMPLE 2: Series processing with [a, b, c] syntax
// ============================================================

console.log('\n=== Example 2: Series Processing ===\n');

// Each step adds to the message
function addStep(name) {
  return function(options) {
    return (send, packet) => {
      const steps = packet.steps || [];
      logger(`[${name}] Processing...`);
      send({ ...packet, steps: [...steps, name] });
    };
  };
}

const example2 = flow([
  ['input', [addStep('validate'), addStep('transform'), addStep('enrich')], Debug({ name: 'result', logger })],
]);

example2.inject('input', { payload: { data: 'test' } });

// ============================================================
// EXAMPLE 3: Fan-out (parallel processing)
// ============================================================

console.log('\n=== Example 3: Fan-out Processing ===\n');

function processA(options) {
  return (send, packet) => {
    logger('[A] Fast processing');
    send({ ...packet, processedBy: 'A' });
  };
}

function processB(options) {
  return (send, packet) => {
    logger('[B] Detailed processing');
    send({ ...packet, processedBy: 'B', extra: 'details' });
  };
}

const example3 = flow([
  ['input', processA, processB, 'output'], // Both receive same input
  ['output', Debug({ name: 'fan-out-result', logger })],
]);

example3.inject('input', { payload: 'parallel test' });

// ============================================================
// EXAMPLE 4: Mixed pre-configured and auto-configured functions
// ============================================================

console.log('\n=== Example 4: Pre-configured Functions ===\n');

function multiplier(options) {
  const factor = options.factor || 1;
  return (send, packet) => {
    send({ ...packet, payload: packet.payload * factor });
  };
}

const example4 = flow([
  ['input', [
    multiplier({ factor: 2 }),   // Pre-configured: ×2
    multiplier,                   // Auto-configured with {}: ×1
    multiplier({ factor: 5 }),   // Pre-configured: ×5
  ], Debug({ name: 'multiplied', logger })],
]);

example4.inject('input', { payload: 10 }); // 10 → 20 → 20 → 100

// ============================================================
// EXAMPLE 5: Conditional routing with Switch
// ============================================================

console.log('\n=== Example 5: Conditional Routing ===\n');

const example5 = flow([
  ['input', Switch({
    property: 'payload.temperature',
    rules: [
      { type: 'gte', value: 30 },
    ]
  }), 'hot'],
  
  ['input', Switch({
    property: 'payload.temperature',
    rules: [
      { type: 'lt', value: 30 },
    ]
  }), 'cold'],
  
  ['hot', Debug({ name: '🔥 HOT', logger })],
  ['cold', Debug({ name: '❄️ COLD', logger })],
]);

example5.inject('input', { payload: { temperature: 35, city: 'Phoenix' } });
example5.inject('input', { payload: { temperature: 15, city: 'Seattle' } });

// ============================================================
// EXAMPLE 6: Template rendering
// ============================================================

console.log('\n=== Example 6: Template Rendering ===\n');

const example6 = flow([
  ['input', Template({
    template: '{{payload.name}} from {{payload.city}} says: "{{payload.message}}"'
  }), Debug({ name: 'message', logger })],
]);

example6.inject('input', { 
  payload: { 
    name: 'Alice', 
    city: 'Wonderland',
    message: 'Down the rabbit hole!'
  } 
});

// ============================================================
// EXAMPLE 7: Subflow embedding
// ============================================================

console.log('\n=== Example 7: Subflow (Reusable Component) ===\n');

// Create a reusable "sanitizer" subflow
const sanitizer = subflow([
  ['in', Fn({
    func: (msg) => ({
      ...msg,
      payload: String(msg.payload).trim().toLowerCase()
    })
  }), 'out'],
]);

// Use it in main flow
const example7 = flow([
  ['input', 'process'],
  ['process', Debug({ name: 'sanitized', logger })],
]);

// Wire up subflow
example7.pipes['input'].connect(sanitizer._input);
sanitizer._output.connect(example7.pipes['process']);

example7.inject('input', { payload: '  HELLO WORLD  ' });

// ============================================================
// EXAMPLE 8: Blog builder (original use case)
// ============================================================

console.log('\n=== Example 8: Blog Builder Pattern ===\n');

// Simulated producer functions
function socket(channel) {
  return (send) => {
    logger(`[socket] Listening on: ${channel}`);
    // Simulate receiving data
    setTimeout(() => {
      send({ payload: { type: 'new-post', id: 123 }, channel });
    }, 50);
  };
}

function watch(folder) {
  return (send) => {
    logger(`[watch] Watching: ${folder}`);
    // Simulate file change
    setTimeout(() => {
      send({ payload: { type: 'file-changed', path: `${folder}/image.png` }, folder });
    }, 75);
  };
}

// Processing functions
function cover(options) {
  return (send, packet) => {
    logger('[cover] Generating cover image...');
    send({ ...packet, cover: true });
  };
}

function audio(options) {
  return (send, packet) => {
    logger('[audio] Processing audio...');
    send({ ...packet, audio: true });
  };
}

function post(options) {
  return (send, packet) => {
    logger('[post] Building post...');
    send({ ...packet, built: true });
  };
}

function assets(options) {
  return (send, packet) => {
    logger('[assets] Processing asset:', packet.payload?.path);
    send(packet);
  };
}

function pagerizer(options) {
  return (send, packet) => {
    logger('[pagerizer] Updating pagination...');
    send({ ...packet, paginated: true });
  };
}

const blogBuilder = flow([
  [socket('post'), 'post'],               // Socket events → post pipe
  [watch('assets'), 'asset'],             // File watcher → asset pipe
  ['post', Debug({ name: 'new-post', logger })],           // Log new posts
  ['asset', assets],                      // Process assets
  ['post', cover, audio, post, 'updated'], // Fan-out: cover, audio, post all run
  ['updated', pagerizer, Debug({ name: 'updated', logger })],
], { username: 'alice' });

blogBuilder.start();

// ============================================================
// EXAMPLE 9: Series with mixed fan-out
// ============================================================

console.log('\n=== Example 9: Complex Pipeline ===\n');

function validate(options) {
  return (send, packet) => {
    if (packet.payload) {
      logger('[validate] ✓ Valid');
      send(packet);
    } else {
      logger('[validate] ✗ Invalid - dropped');
    }
  };
}

function enrichA(options) {
  return (send, packet) => {
    logger('[enrichA] Adding metadata A');
    send({ ...packet, metaA: true });
  };
}

function enrichB(options) {
  return (send, packet) => {
    logger('[enrichB] Adding metadata B');
    send({ ...packet, metaB: true });
  };
}

function finalize(options) {
  return (send, packet) => {
    logger('[finalize] Completing...');
    send({ ...packet, finalized: true });
  };
}

// Complex pipeline: validate → (enrichA + enrichB in parallel) → finalize
const example9 = flow([
  ['input', [validate], 'validated'],     // Series: just validate
  ['validated', enrichA, enrichB, 'enriched'], // Fan-out: both enrichers
  ['enriched', [finalize], Debug({ name: 'final', logger })], // Series: finalize
]);

example9.inject('input', { payload: { data: 'important' } });

// ============================================================
// Summary
// ============================================================

setTimeout(() => {
  console.log('\n=== All Examples Complete ===\n');
}, 200);
