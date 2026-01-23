/**
 * lulz - Test Suite
 */

import {
  flow,
  subflow,
  compose,
  parallel,
  series,
  isOuter,
  isInner,
  isFlow,
  inject,
  debug,
  func,
  change,
  switchNode,
  template,
  delay,
  split,
  join,
  map,
  filter,
  scan,
  debounce,
  throttle,
  take,
  skip,
  distinct,
  pairwise,
  tap,
  buffer,
  combineLatest,
} from './index.js';


// ─────────────────────────────────────────────────────────────
// Test Utilities
// ─────────────────────────────────────────────────────────────

let testCount = 0;
let passCount = 0;

const test = (name, fn) => {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${err.message}`);
  }
};

const asyncTest = async (name, fn, timeout = 500) => {
  testCount++;
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeout)
      ),
    ]);
    passCount++;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${err.message}`);
  }
};

const assert = (condition, message = 'Assertion failed') => {
  if (!condition) throw new Error(message);
};

const assertEqual = (actual, expected, message = '') => {
  if (actual !== expected) {
    throw new Error(`${message} Expected ${expected}, got ${actual}`);
  }
};

const assertDeepEqual = (actual, expected, message = '') => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};


// ─────────────────────────────────────────────────────────────
// Inner/Outer Detection Tests
// ─────────────────────────────────────────────────────────────

console.log('\n═══ Inner/Outer Detection ═══\n');

test('Regular function is outer', () => {
  function outer() { return () => {}; }
  assert(isOuter(outer), 'Should detect regular function as outer');
});

test('Arrow function is inner', () => {
  const inner = () => {};
  assert(isInner(inner), 'Should detect arrow function as inner');
});

test('Pre-called outer returns inner', () => {
  function factory(options) {
    return (send, packet) => send(packet);
  }
  const inner = factory({});
  assert(isOuter(factory), 'Factory should be outer');
  assert(isInner(inner), 'Result should be inner');
});


// ─────────────────────────────────────────────────────────────
// Basic Flow Tests
// ─────────────────────────────────────────────────────────────

console.log('\n═══ Basic Flow ═══\n');

test('Flow is an EventEmitter', () => {
  const app = flow([]);
  assert(typeof app.on === 'function', 'Should have on method');
  assert(typeof app.emit === 'function', 'Should have emit method');
  assert(app._isFlow === true, 'Should be marked as flow');
});

test('Direct inject into pipe via emit', () => {
  const results = [];
  
  function collector(options) {
    return (send, packet) => {
      results.push(packet.payload);
      send(packet);
    };
  }
  
  const app = flow([
    ['input', collector],
  ]);
  
  app.emit('input', { payload: 'hello' });
  app.emit('input', { payload: 'world' });
  
  assertEqual(results.length, 2, 'Should receive two packets');
  assertEqual(results[0], 'hello');
  assertEqual(results[1], 'world');
});

test('Listen to pipe via on', () => {
  const results = [];
  
  const app = flow([
    ['input', 'output'],
  ]);
  
  app.on('output', (packet) => {
    results.push(packet.payload);
  });
  
  app.emit('input', { payload: 'test' });
  
  assertEqual(results.length, 1);
  assertEqual(results[0], 'test');
});


// ─────────────────────────────────────────────────────────────
// Series Processing (Default)
// ─────────────────────────────────────────────────────────────

console.log('\n═══ Series Processing (Default) ═══\n');

test('Default is series: a → b → c', () => {
  const order = [];
  
  function step(name) {
    return function(options) {
      return (send, packet) => {
        order.push(name);
        send({ ...packet, steps: [...(packet.steps || []), name] });
      };
    };
  }
  
  const app = flow([
    ['input', step('A'), step('B'), step('C'), 'output'],
  ]);
  
  let finalPacket = null;
  app.on('output', (packet) => { finalPacket = packet; });
  
  app.emit('input', { payload: 'start' });
  
  assertDeepEqual(order, ['A', 'B', 'C'], 'Should process in order');
  assertDeepEqual(finalPacket.steps, ['A', 'B', 'C'], 'Packet should have all steps');
});

test('Explicit series() helper', () => {
  const order = [];
  
  function step(name) {
    return function(options) {
      return (send, packet) => {
        order.push(name);
        send(packet);
      };
    };
  }
  
  const app = flow([
    ['input', series(step('X'), step('Y'), step('Z')), 'output'],
  ]);
  
  app.emit('input', { payload: 'test' });
  
  assertDeepEqual(order, ['X', 'Y', 'Z']);
});


// ─────────────────────────────────────────────────────────────
// Parallel Processing (Explicit)
// ─────────────────────────────────────────────────────────────

console.log('\n═══ Parallel Processing (Explicit) ═══\n');

test('Parallel with [] syntax', () => {
  const results = { a: false, b: false, c: false };
  
  function setFlag(name) {
    return function(options) {
      return (send, packet) => {
        results[name] = true;
        send({ ...packet, from: name });
      };
    };
  }
  
  const app = flow([
    ['input', [setFlag('a'), setFlag('b'), setFlag('c')], 'output'],
  ]);
  
  const outputs = [];
  app.on('output', (packet) => outputs.push(packet.from));
  
  app.emit('input', { payload: 'parallel' });
  
  assert(results.a && results.b && results.c, 'All should receive packet');
  assertEqual(outputs.length, 3, 'Output should receive 3 packets');
});

test('Explicit parallel() helper', () => {
  const results = [];
  
  function addResult(value) {
    return function(options) {
      return (send, packet) => {
        results.push(value);
        send(packet);
      };
    };
  }
  
  const app = flow([
    ['input', parallel(addResult(1), addResult(2), addResult(3)), 'output'],
  ]);
  
  app.emit('input', { payload: 'test' });
  
  assertEqual(results.length, 3, 'All parallel branches should execute');
});


// ─────────────────────────────────────────────────────────────
// Pre-configured Functions
// ─────────────────────────────────────────────────────────────

console.log('\n═══ Pre-configured Functions ═══\n');

test('Mixed pre-configured and auto-configured', () => {
  const configs = [];
  
  function configurable(options) {
    return (send, packet) => {
      configs.push(options.name || 'default');
      send(packet);
    };
  }
  
  const app = flow([
    ['input', configurable({ name: 'first' }), configurable, configurable({ name: 'third' }), 'output'],
  ]);
  
  app.emit('input', { payload: 'test' });
  
  assertEqual(configs[0], 'first');
  assertEqual(configs[1], 'default');  // Auto-configured with {}
  assertEqual(configs[2], 'third');
});


// ─────────────────────────────────────────────────────────────
// Subflows and Auto-compose
// ─────────────────────────────────────────────────────────────

console.log('\n═══ Subflows ═══\n');

test('Subflow with in/out pipes', () => {
  const results = [];
  
  const doubler = subflow([
    ['in', func({ func: (msg) => ({ ...msg, payload: msg.payload * 2 }) }), 'out'],
  ]);
  
  doubler.on('out', (packet) => results.push(packet.payload));
  doubler.emit('in', { payload: 21 });
  
  assertEqual(results[0], 42);
});

test('Compose multiple flows', () => {
  const flow1 = subflow([
    ['in', func({ func: (msg) => ({ ...msg, payload: msg.payload + 10 }) }), 'out'],
  ]);
  
  const flow2 = subflow([
    ['in', func({ func: (msg) => ({ ...msg, payload: msg.payload * 2 }) }), 'out'],
  ]);
  
  const composed = compose(flow1, flow2);
  
  const results = [];
  composed.on('out', (packet) => results.push(packet.payload));
  
  composed.emit('in', { payload: 5 });
  
  // (5 + 10) * 2 = 30
  assertEqual(results[0], 30);
});


// ─────────────────────────────────────────────────────────────
// Node-RED Core Nodes
// ─────────────────────────────────────────────────────────────

console.log('\n═══ Node-RED Core Nodes ═══\n');

test('debug node logs and passes through', () => {
  const logs = [];
  const results = [];
  
  const app = flow([
    ['input', debug({ name: 'test', logger: (...args) => logs.push(args) }), 'output'],
  ]);
  
  app.on('output', (packet) => results.push(packet));
  app.emit('input', { payload: 42 });
  
  assertEqual(logs.length, 1);
  assertEqual(logs[0][0], '[test]');
  assertEqual(logs[0][1], 42);
  assertEqual(results.length, 1);
});

test('func node transforms messages', () => {
  const results = [];
  
  const app = flow([
    ['input', func({ func: (msg) => ({ ...msg, payload: msg.payload.toUpperCase() }) }), 'output'],
  ]);
  
  app.on('output', (packet) => results.push(packet));
  app.emit('input', { payload: 'hello' });
  
  assertEqual(results[0].payload, 'HELLO');
});

test('change node sets properties', () => {
  const results = [];
  
  const app = flow([
    ['input', change({
      rules: [
        { type: 'set', prop: 'payload', to: 'changed' },
        { type: 'set', prop: 'topic', to: 'test' },
      ]
    }), 'output'],
  ]);
  
  app.on('output', (packet) => results.push(packet));
  app.emit('input', { payload: 'original' });
  
  assertEqual(results[0].payload, 'changed');
  assertEqual(results[0].topic, 'test');
});

test('switchNode routes messages', () => {
  const high = [];
  
  const app = flow([
    ['input', switchNode({
      property: 'payload',
      rules: [{ type: 'gte', value: 50 }]
    }), 'high'],
  ]);
  
  app.on('high', (packet) => high.push(packet.payload));
  
  app.emit('input', { payload: 75 });
  app.emit('input', { payload: 25 });
  
  assertEqual(high.length, 1);
  assertEqual(high[0], 75);
});

test('template node renders mustache', () => {
  const results = [];
  
  const app = flow([
    ['input', template({ template: 'Hello {{name}}!' }), 'output'],
  ]);
  
  app.on('output', (packet) => results.push(packet));
  app.emit('input', { payload: '', name: 'Alice' });
  
  assertEqual(results[0].payload, 'Hello Alice!');
});

test('split node splits arrays', () => {
  const results = [];
  
  const app = flow([
    ['input', split(), 'output'],
  ]);
  
  app.on('output', (packet) => results.push(packet.payload));
  app.emit('input', { payload: [1, 2, 3] });
  
  assertEqual(results.length, 3);
  assertDeepEqual(results, [1, 2, 3]);
});


// ─────────────────────────────────────────────────────────────
// RxJS-Style Operators
// ─────────────────────────────────────────────────────────────

console.log('\n═══ RxJS-Style Operators ═══\n');

test('map transforms values', () => {
  const results = [];
  
  const app = flow([
    ['input', map({ fn: (x) => x * 2 }), 'output'],
  ]);
  
  app.on('output', (packet) => results.push(packet.payload));
  app.emit('input', { payload: 21 });
  
  assertEqual(results[0], 42);
});

test('scan accumulates values', () => {
  const results = [];
  
  const app = flow([
    ['input', scan({ reducer: (acc, x) => acc + x, initial: 0 }), 'output'],
  ]);
  
  app.on('output', (packet) => results.push(packet.payload));
  
  app.emit('input', { payload: 1 });
  app.emit('input', { payload: 2 });
  app.emit('input', { payload: 3 });
  
  assertDeepEqual(results, [1, 3, 6]);
});

test('take only first N', () => {
  const results = [];
  
  const app = flow([
    ['input', take({ count: 2 }), 'output'],
  ]);
  
  app.on('output', (packet) => results.push(packet.payload));
  
  app.emit('input', { payload: 1 });
  app.emit('input', { payload: 2 });
  app.emit('input', { payload: 3 });
  
  assertEqual(results.length, 2);
  assertDeepEqual(results, [1, 2]);
});

test('skip first N', () => {
  const results = [];
  
  const app = flow([
    ['input', skip({ count: 2 }), 'output'],
  ]);
  
  app.on('output', (packet) => results.push(packet.payload));
  
  app.emit('input', { payload: 1 });
  app.emit('input', { payload: 2 });
  app.emit('input', { payload: 3 });
  
  assertEqual(results.length, 1);
  assertEqual(results[0], 3);
});

test('distinct filters duplicates', () => {
  const results = [];
  
  const app = flow([
    ['input', distinct(), 'output'],
  ]);
  
  app.on('output', (packet) => results.push(packet.payload));
  
  app.emit('input', { payload: 1 });
  app.emit('input', { payload: 2 });
  app.emit('input', { payload: 1 });
  app.emit('input', { payload: 3 });
  
  assertDeepEqual(results, [1, 2, 3]);
});

test('pairwise emits pairs', () => {
  const results = [];
  
  const app = flow([
    ['input', pairwise(), 'output'],
  ]);
  
  app.on('output', (packet) => results.push(packet.payload));
  
  app.emit('input', { payload: 'a' });
  app.emit('input', { payload: 'b' });
  app.emit('input', { payload: 'c' });
  
  assertEqual(results.length, 2);
  assertDeepEqual(results[0], ['a', 'b']);
  assertDeepEqual(results[1], ['b', 'c']);
});

test('tap performs side effect', () => {
  const sideEffects = [];
  const results = [];
  
  const app = flow([
    ['input', tap({ fn: (p) => sideEffects.push(p.payload) }), 'output'],
  ]);
  
  app.on('output', (packet) => results.push(packet.payload));
  app.emit('input', { payload: 'test' });
  
  assertEqual(sideEffects[0], 'test');
  assertEqual(results[0], 'test');
});


// ─────────────────────────────────────────────────────────────
// Node-RED Tutorial 1: Inject → Debug
// ─────────────────────────────────────────────────────────────

console.log('\n═══ Node-RED Tutorial 1 ═══\n');

await asyncTest('Tutorial 1: Inject timestamp to Debug', async () => {
  const logs = [];
  
  const app = flow([
    [inject({ payload: () => Date.now(), once: true }), debug({ name: 'output', logger: (...args) => logs.push(args) })],
  ]);
  
  app.start();
  
  await new Promise(r => setTimeout(r, 50));
  
  assert(logs.length >= 1, 'Should have logged');
  assert(typeof logs[0][1] === 'number', 'Should be timestamp');
});


// ─────────────────────────────────────────────────────────────
// Node-RED Tutorial 2: Inject → Function → Debug
// ─────────────────────────────────────────────────────────────

console.log('\n═══ Node-RED Tutorial 2 ═══\n');

await asyncTest('Tutorial 2: Modify payload with Function node', async () => {
  const logs = [];
  
  const app = flow([
    [inject({ payload: 'Hello World!', once: true }), 'msg'],
    ['msg', func({ func: (msg) => ({ ...msg, payload: msg.payload.toLowerCase() }) }), debug({ name: 'output', logger: (...args) => logs.push(args) })],
  ]);
  
  app.start();
  
  await new Promise(r => setTimeout(r, 50));
  
  assert(logs.length >= 1, 'Should have logged');
  assertEqual(logs[0][1], 'hello world!');
});


// ─────────────────────────────────────────────────────────────
// Complex Pipeline
// ─────────────────────────────────────────────────────────────

console.log('\n═══ Complex Pipeline ═══\n');

test('Series with parallel block', () => {
  const order = [];
  
  function step(name) {
    return function(options) {
      return (send, packet) => {
        order.push(name);
        send(packet);
      };
    };
  }
  
  // This should: A → (B,C parallel) → D
  const app = flow([
    ['input', step('A'), 'stage1'],
    ['stage1', [step('B'), step('C')], 'stage2'],
    ['stage2', step('D'), 'output'],
  ]);
  
  app.emit('input', { payload: 'test' });
  
  assertEqual(order[0], 'A', 'A should be first');
  assert(order.includes('B') && order.includes('C'), 'B and C should run');
  // D runs twice (once for each parallel output)
});


// ─────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────

setTimeout(() => {
  console.log(`\n═══ Results: ${passCount}/${testCount} tests passed ═══\n`);
  if (passCount === testCount) {
    console.log('All tests passed! ✓\n');
  } else {
    console.log(`${testCount - passCount} test(s) failed.\n`);
    process.exit(1);
  }
}, 300);
