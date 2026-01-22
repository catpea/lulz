/**
 * lulz Tests
 */

import { test } from 'node:test';
import assert from 'node:assert';
import {
  flow,
  subflow,
  compose,
  isOuter,
  isInner,
  Inject,
  Debug,
  Function as FunctionNode,
  Change,
  Switch,
  Template,
  Delay,
  Join,
  Split,
} from './index.js';

// ============ TESTS ============

test('Regular function is outer', () => {
  function outer() { return () => {}; }
  assert.ok(isOuter(outer), 'Should detect regular function as outer');
});

test('Arrow function is inner', () => {
  const inner = () => {};
  assert.ok(isInner(inner), 'Should detect arrow function as inner');
});

test('Pre-called outer returns inner', () => {
  function factory(options) {
    return (send, packet) => send(packet);
  }
  const inner = factory({});
  assert.ok(isOuter(factory), 'Factory should be outer');
  assert.ok(isInner(inner), 'Result should be inner');
});

test('Simple pipe connection', (t, done) => {
  const results = [];

  function producer(options) {
    return (send) => {
      send({ payload: 'test' });
    };
  }

  function consumer(options) {
    return (send, packet) => {
      results.push(packet);
      send(packet);
    };
  }

  const app = flow([
    [producer, 'out'],
    ['out', consumer],
  ]);

  app.start();

  // Give it a tick
  setTimeout(() => {
    assert.strictEqual(results.length, 1, 'Should receive one packet');
    assert.strictEqual(results[0].payload, 'test', 'Payload should match');
    done();
  }, 10);
});

test('Direct inject into pipe', () => {
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

  app.inject('input', { payload: 'hello' });
  app.inject('input', { payload: 'world' });

  assert.strictEqual(results.length, 2, 'Should receive two packets');
  assert.strictEqual(results[0], 'hello');
  assert.strictEqual(results[1], 'world');
});

test('Fan-out sends to multiple transforms', () => {
  const results = { a: [], b: [], c: [] };

  function transformA(options) {
    return (send, packet) => {
      results.a.push(packet.payload);
      send({ ...packet, from: 'A' });
    };
  }

  function transformB(options) {
    return (send, packet) => {
      results.b.push(packet.payload);
      send({ ...packet, from: 'B' });
    };
  }

  function collector(options) {
    return (send, packet) => {
      results.c.push(packet.from);
      send(packet);
    };
  }

  const app = flow([
    ['input', transformA, transformB, 'output'],
    ['output', collector],
  ]);

  app.inject('input', { payload: 42 });

  assert.strictEqual(results.a.length, 1, 'A should receive packet');
  assert.strictEqual(results.b.length, 1, 'B should receive packet');
  assert.strictEqual(results.c.length, 2, 'Collector should receive from both');
});

test('Series processes in order: [a, b, c]', () => {
  const order = [];

  function step(name) {
    return function factory(options) {
      return (send, packet) => {
        order.push(name);
        send({ ...packet, steps: [...(packet.steps || []), name] });
      };
    };
  }

  const app = flow([
    ['input', [step('A'), step('B'), step('C')], 'output'],
  ]);

  let finalPacket = null;
  app.pipes['output'].connect({
    receive: (packet) => { finalPacket = packet; }
  });

  app.inject('input', { payload: 'start' });

  assert.deepStrictEqual(order, ['A', 'B', 'C'], 'Should process in order');
  assert.deepStrictEqual(finalPacket.steps, ['A', 'B', 'C'], 'Packet should have all steps');
});

test('Series with pre-configured function', () => {
  const order = [];

  function configurable(options) {
    return (send, packet) => {
      order.push(options.name);
      send(packet);
    };
  }

  const app = flow([
    ['input', [
      configurable({ name: 'first' }),
      configurable,  // outer, will get empty config
      configurable({ name: 'third' }),
    ], 'output'],
  ]);

  app.inject('input', { payload: 'test' });

  assert.strictEqual(order[0], 'first');
  assert.strictEqual(order[2], 'third');
});

test('Subflow can be embedded', () => {
  const results = [];

  // Create a subflow that doubles the payload
  const doubler = subflow([
    ['in', FunctionNode({ func: (msg) => ({ ...msg, payload: msg.payload * 2 }) }), 'out'],
  ]);

  function collector(options) {
    return (send, packet) => {
      results.push(packet.payload);
      send(packet);
    };
  }

  // Main flow: inject into subflow, subflow outputs to collector
  // We wire: input → subflow.in → (doubles) → subflow.out → collector
  const app = flow([
    ['output', collector],
  ]);

  // Connect: inject directly into subflow, subflow outputs to 'output' pipe
  doubler._output.connect(app.pipes['output']);

  // Inject into subflow's input
  doubler._input.receive({ payload: 21 });

  assert.strictEqual(results[0], 42, 'Subflow should double the value');
});

test('Inject node produces packets', (t, done) => {
  const results = [];

  function collector(options) {
    return (send, packet) => {
      results.push(packet);
      send(packet);
    };
  }

  const app = flow([
    [Inject({ payload: 'hello', once: true }), collector],
  ]);

  app.start();

  setTimeout(() => {
    assert.ok(results.length >= 1, 'Should produce at least one packet');
    assert.strictEqual(results[0].payload, 'hello');
    done();
  }, 50);
});

test('Debug node logs and passes through', () => {
  const logs = [];
  const results = [];

  const customLogger = (...args) => logs.push(args);

  function collector(options) {
    return (send, packet) => {
      results.push(packet);
      send(packet);
    };
  }

  const app = flow([
    ['input', Debug({ name: 'test', logger: customLogger }), collector],
  ]);

  app.inject('input', { payload: 42 });

  assert.strictEqual(logs.length, 1, 'Should log once');
  assert.strictEqual(logs[0][0], '[test]', 'Should have correct label');
  assert.strictEqual(logs[0][1], 42, 'Should log payload');
  assert.strictEqual(results.length, 1, 'Should pass through');
});

test('Function node transforms messages', () => {
  const results = [];

  function collector(options) {
    return (send, packet) => {
      results.push(packet);
      send(packet);
    };
  }

  const app = flow([
    ['input', FunctionNode({
      func: (msg) => ({
        ...msg,
        payload: msg.payload.toUpperCase()
      })
    }), collector],
  ]);

  app.inject('input', { payload: 'hello' });

  assert.strictEqual(results[0].payload, 'HELLO');
});

test('Change node sets properties', () => {
  const results = [];

  function collector(options) {
    return (send, packet) => {
      results.push(packet);
      send(packet);
    };
  }

  const app = flow([
    ['input', Change({
      rules: [
        { type: 'set', prop: 'payload', to: 'changed' },
        { type: 'set', prop: 'topic', to: 'test' },
      ]
    }), collector],
  ]);

  app.inject('input', { payload: 'original' });

  assert.strictEqual(results[0].payload, 'changed');
  assert.strictEqual(results[0].topic, 'test');
});

test('Switch node routes messages', () => {
  const results = { high: [], low: [] };

  function highCollector(options) {
    return (send, packet) => {
      results.high.push(packet.payload);
      send(packet);
    };
  }

  function lowCollector(options) {
    return (send, packet) => {
      results.low.push(packet.payload);
      send(packet);
    };
  }

  const app = flow([
    ['input', Switch({
      property: 'payload',
      rules: [
        { type: 'gte', value: 50 },
      ]
    }), 'high'],
    ['high', highCollector],
  ]);

  app.inject('input', { payload: 75 });
  app.inject('input', { payload: 25 });

  assert.strictEqual(results.high.length, 1, 'Only high value should route');
  assert.strictEqual(results.high[0], 75);
});

test('Template node renders mustache', () => {
  const results = [];

  function collector(options) {
    return (send, packet) => {
      results.push(packet);
      send(packet);
    };
  }

  const app = flow([
    ['input', Template({
      template: 'Hello {{name}}, you have {{count}} messages!'
    }), collector],
  ]);

  app.inject('input', { payload: '', name: 'Alice', count: 5 });

  assert.strictEqual(results[0].payload, 'Hello Alice, you have 5 messages!');
});

test('Split node splits arrays', () => {
  const results = [];

  function collector(options) {
    return (send, packet) => {
      results.push(packet.payload);
      send(packet);
    };
  }

  const app = flow([
    ['input', Split(), collector],
  ]);

  app.inject('input', { payload: [1, 2, 3] });

  assert.strictEqual(results.length, 3);
  assert.deepStrictEqual(results, [1, 2, 3]);
});

test('Tutorial 1: Inject timestamp to Debug', (t, done) => {
  const logs = [];
  const customLogger = (...args) => logs.push(args);

  // Recreate first tutorial flow
  const app = flow([
    [Inject({ payload: () => Date.now(), once: true }), Debug({ name: 'debug', logger: customLogger })],
  ]);

  app.start();

  setTimeout(() => {
    assert.ok(logs.length >= 1, 'Should have logged');
    assert.strictEqual(typeof logs[0][1], 'number', 'Should be timestamp');
    done();
  }, 50);
});

test('Tutorial 2: Modify payload with Function node', (t, done) => {
  const logs = [];
  const customLogger = (...args) => logs.push(args);

  // Second tutorial: inject → function (modify payload) → debug
  const app = flow([
    [Inject({
      payload: 'Hello World!',
      once: true
    }), 'msg'],
    ['msg', FunctionNode({
      func: (msg) => ({
        ...msg,
        payload: msg.payload.toLowerCase()
      })
    }), Debug({ name: 'output', logger: customLogger })],
  ]);

  app.start();

  setTimeout(() => {
    assert.ok(logs.length >= 1, 'Should have logged');
    assert.strictEqual(logs[0][1], 'hello world!', 'Should be lowercase');
    done();
  }, 50);
});
