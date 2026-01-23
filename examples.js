/**
 * lulz - Examples
 * 
 * Various usage patterns and demonstrations.
 */

import {
  flow,
  subflow,
  compose,
  parallel,
  series,
  inject,
  debug,
  func,
  change,
  template,
  delay,
  map,
  filter,
  scan,
  debounce,
  take,
  pairwise,
  tap,
} from './index.js';


// ─────────────────────────────────────────────────────────────
// Example 1: Basic Inject → Debug
// ─────────────────────────────────────────────────────────────

console.log('\n═══ Example 1: Basic Inject → Debug ═══\n');

const example1 = flow([
  [inject({ payload: 'Hello lulz!', once: true }), debug({ name: 'output' })],
]);

example1.start();


// ─────────────────────────────────────────────────────────────
// Example 2: EventEmitter API
// ─────────────────────────────────────────────────────────────

console.log('\n═══ Example 2: EventEmitter API ═══\n');

const example2 = flow([
  ['input', func({ func: (msg) => ({ ...msg, payload: msg.payload.toUpperCase() }) }), 'output'],
]);

// Listen to output pipe
example2.on('output', (packet) => {
  console.log('[Listener] Received:', packet.payload);
});

// Inject via emit
example2.emit('input', { payload: 'hello via emit!' });


// ─────────────────────────────────────────────────────────────
// Example 3: Series Processing (Default)
// ─────────────────────────────────────────────────────────────

console.log('\n═══ Example 3: Series Processing ═══\n');

function addStep(name) {
  return function(options) {
    return (send, packet) => {
      console.log(`[${name}] Processing...`);
      send({ ...packet, steps: [...(packet.steps || []), name] });
    };
  };
}

const example3 = flow([
  ['input', addStep('validate'), addStep('transform'), addStep('save'), debug({ name: 'result', complete: true })],
]);

example3.emit('input', { payload: { data: 'test' } });


// ─────────────────────────────────────────────────────────────
// Example 4: Parallel Processing with []
// ─────────────────────────────────────────────────────────────

console.log('\n═══ Example 4: Parallel Processing ═══\n');

function process(name, delay = 0) {
  return function(options) {
    return (send, packet) => {
      setTimeout(() => {
        console.log(`[${name}] Done`);
        send({ ...packet, processor: name });
      }, delay);
    };
  };
}

const example4 = flow([
  ['input', [process('fast', 10), process('slow', 50), process('medium', 30)], 'output'],
  ['output', debug({ name: 'parallel-result' })],
]);

example4.emit('input', { payload: 'parallel test' });


// ─────────────────────────────────────────────────────────────
// Example 5: Helper Functions
// ─────────────────────────────────────────────────────────────

console.log('\n═══ Example 5: series() and parallel() Helpers ═══\n');

function multiply(n) {
  return function(options) {
    return (send, packet) => {
      send({ ...packet, payload: packet.payload * n });
    };
  };
}

const example5 = flow([
  // series: 10 → 20 → 60 → 120
  ['input', series(multiply(2), multiply(3), multiply(2)), debug({ name: 'series-result' })],
]);

example5.emit('input', { payload: 10 });


// ─────────────────────────────────────────────────────────────
// Example 6: Subflows (Reusable Components)
// ─────────────────────────────────────────────────────────────

console.log('\n═══ Example 6: Subflows ═══\n');

// Create reusable sanitizer
const sanitizer = subflow([
  ['in', func({ func: (msg) => ({
    ...msg,
    payload: String(msg.payload).trim().toLowerCase()
  })}), 'out'],
]);

// Create reusable validator
const validator = subflow([
  ['in', func({ func: (msg) => ({
    ...msg,
    payload: msg.payload,
    valid: msg.payload.length > 0
  })}), 'out'],
]);

// Compose them
const pipeline = compose(sanitizer, validator);

pipeline.on('out', (packet) => {
  console.log('[Pipeline Result]', packet);
});

pipeline.emit('in', { payload: '  HELLO WORLD  ' });


// ─────────────────────────────────────────────────────────────
// Example 7: RxJS-Style Operators
// ─────────────────────────────────────────────────────────────

console.log('\n═══ Example 7: RxJS-Style Operators ═══\n');

const example7 = flow([
  ['input', 
    map({ fn: (x) => x * 2 }),
    filter({ predicate: (x) => x > 5 }),
    scan({ reducer: (acc, x) => acc + x, initial: 0 }),
    debug({ name: 'rx-result' })
  ],
]);

[1, 2, 3, 4, 5].forEach(n => {
  example7.emit('input', { payload: n });
});


// ─────────────────────────────────────────────────────────────
// Example 8: Blog Builder Pattern
// ─────────────────────────────────────────────────────────────

console.log('\n═══ Example 8: Blog Builder ═══\n');

// Simulated producers
function socket(channel) {
  return (send) => {
    console.log(`[socket] Listening: ${channel}`);
    setTimeout(() => {
      send({ payload: { type: 'new-post', id: 123 }, topic: channel });
    }, 100);
  };
}

function watch(folder) {
  return (send) => {
    console.log(`[watch] Watching: ${folder}`);
    setTimeout(() => {
      send({ payload: { type: 'file-changed', path: `${folder}/image.png` }, topic: folder });
    }, 150);
  };
}

// Processing functions
function cover(options) {
  return (send, packet) => {
    console.log('[cover] Generating cover...');
    send({ ...packet, cover: true });
  };
}

function audio(options) {
  return (send, packet) => {
    console.log('[audio] Processing audio...');
    send({ ...packet, audio: true });
  };
}

function post(options) {
  return (send, packet) => {
    console.log('[post] Building post...');
    send({ ...packet, built: true });
  };
}

function assets(options) {
  return (send, packet) => {
    console.log('[assets] Processing asset');
    send(packet);
  };
}

function pagerizer(options) {
  return (send, packet) => {
    console.log('[pagerizer] Updating pagination');
    send(packet);
  };
}

const blogBuilder = flow([
  [socket('post'), 'post'],
  [watch('assets'), 'asset'],
  ['post', debug({ name: 'new-post' })],
  ['asset', assets],
  // Fan-out: cover, audio, post all run in parallel
  ['post', [cover, audio, post], 'updated'],
  ['updated', pagerizer, debug({ name: 'updated' })],
], { username: 'alice' });

blogBuilder.start();


// ─────────────────────────────────────────────────────────────
// Example 9: Temperature Monitor with Pairwise
// ─────────────────────────────────────────────────────────────

console.log('\n═══ Example 9: Temperature Delta ═══\n');

const tempMonitor = flow([
  ['temp',
    pairwise(),
    func({ func: (msg) => ({
      ...msg,
      payload: {
        prev: msg.payload[0],
        curr: msg.payload[1],
        delta: msg.payload[1] - msg.payload[0]
      }
    })}),
    debug({ name: 'temp-delta', complete: true })
  ],
]);

[20, 22, 21, 25, 23].forEach((temp, i) => {
  setTimeout(() => tempMonitor.emit('temp', { payload: temp }), i * 10);
});


// ─────────────────────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────────────────────

setTimeout(() => {
  console.log('\n═══ All Examples Complete ═══\n');
}, 500);
