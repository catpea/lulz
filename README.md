# lulz

A reactive dataflow system that makes coders happy. 🎉

Inspired by FFmpeg filtergraph notation, Node-RED, and RxJS.

```javascript
import { flow, inject, debug } from 'lulz';

const app = flow([
  [inject({ payload: 'Hello!' }), debug({ name: 'out' })],
]);

app.start();
```

## Features

- **EventEmitter API** - Natural `emit`/`on` for packet injection and interception
- **Series by Default** - `['in', a, b, c, 'out']` processes sequentially
- **Explicit Parallel** - `['in', [a, b, c], 'out']` fans out to all
- **Auto-compose** - Embed flows within flows seamlessly
- **Worker Pool** - CPU-bound tasks with Worker Threads/Web Workers
- **RxJS Operators** - `map`, `filter`, `scan`, `combineLatest`, and more
- **Node-RED Style** - `inject`, `debug`, `func`, `switch`, `template`

## Installation

```bash
npm install lulz
```

## Quick Start

```javascript
import { flow, inject, debug, func } from 'lulz';

// Create a flow
const app = flow([
  [inject({ payload: 'Hello World!' }), 'input'],
  ['input', func({ func: msg => ({ ...msg, payload: msg.payload.toUpperCase() }) }), 'output'],
  ['output', debug({ name: 'result' })],
]);

// Start producers
app.start();

// Or inject manually via EventEmitter API
app.emit('input', { payload: 'Manual injection!' });

// Listen to any pipe
app.on('output', (packet) => {
  console.log('Received:', packet.payload);
});
```

## Processing Modes

### Series (Default)

Functions process sequentially. Output of one becomes input of next.

```javascript
['input', validate, transform, save, 'output']
//          ↓          ↓         ↓
//       packet → packet → packet → output
```

### Parallel (Explicit)

Use `[]` or `parallel()` to fan out. All receive the same packet.

```javascript
['input', [processA, processB, processC], 'output']
//              ↓         ↓         ↓
//           packet    packet    packet
//              ↓         ↓         ↓
//              └─────────┴─────────┘
//                        ↓
//                 output (3 packets)
```

### Helper Functions

```javascript
import { series, parallel } from 'lulz';

// Explicit series (same as default, but clearer)
['input', series(a, b, c), 'output']

// Explicit parallel
['input', parallel(a, b, c), 'output']
```

## EventEmitter API

Every flow is an EventEmitter. Pipes are events.

```javascript
const app = flow([
  ['data', transform, 'result'],
]);

// Inject packets
app.emit('data', { payload: 42 });

// Listen to pipes
app.on('result', (packet) => {
  console.log(packet.payload);
});

// Also works
app.inject('data', { payload: 42 });
```

## Function Types

### Outer Functions (Factories)

Regular functions that return inner functions. Called with options.

```javascript
function myTransform(options) {
  const { multiplier = 1 } = options;
  return (send, packet) => {
    send({ ...packet, payload: packet.payload * multiplier });
  };
}

// Usage
['input', myTransform({ multiplier: 2 }), 'output']  // Pre-configured
['input', myTransform, 'output']                      // Auto-configured with {}
```

### Inner Functions (Processors)

Arrow functions that process packets. Used directly.

```javascript
const double = (send, packet) => {
  send({ ...packet, payload: packet.payload * 2 });
};

['input', double, 'output']
```

## Subflows

Create reusable flow components.

```javascript
import { subflow, compose } from 'lulz';

// Create reusable component
const sanitizer = subflow([
  ['in', func({ func: msg => ({
    ...msg,
    payload: String(msg.payload).trim().toLowerCase()
  })}), 'out'],
]);

// Use via compose
const pipeline = compose(sanitizer, validator, enricher);
pipeline.emit('in', { payload: '  HELLO  ' });

// Or embed in flow (auto-compose)
const app = flow([
  ['input', sanitizer, 'output'],
]);
```

## Node-RED Style Nodes

### inject

Produce packets on schedule.

```javascript
inject({
  payload: 'hello',           // or () => Date.now()
  topic: 'greeting',
  once: true,                  // Emit once on start
  onceDelay: 100,             // Delay before first
  interval: 1000,             // Repeat interval (ms)
})
```

### debug

Log packets.

```javascript
debug({
  name: 'my-debug',
  active: true,
  complete: false,            // true = full packet
  logger: console.log,
})
```

### func

Execute custom code.

```javascript
func({
  func: (msg, context) => {
    return { ...msg, payload: msg.payload.toUpperCase() };
  },
})
```

### change

Modify properties.

```javascript
change({
  rules: [
    { type: 'set', prop: 'payload', to: 'new value' },
    { type: 'change', prop: 'payload', from: /old/, to: 'new' },
    { type: 'delete', prop: 'temp' },
    { type: 'move', prop: 'data', to: 'payload' },
  ]
})
```

### switchNode

Route by conditions.

```javascript
switchNode({
  property: 'payload',
  rules: [
    { type: 'gt', value: 100 },
    { type: 'regex', value: /^test/ },
    { type: 'else' },
  ],
})
```

### template

Render templates.

```javascript
template({
  template: 'Hello {{name}}!',
  field: 'payload',
})
```

## RxJS-Style Operators

### Transformation

```javascript
import { map, scan, pluck, pairwise, buffer } from 'lulz';

map({ fn: x => x * 2 })
scan({ reducer: (acc, x) => acc + x, initial: 0 })
pluck({ path: 'data.value' })
pairwise()
buffer({ count: 5 })
```

### Filtering

```javascript
import { filter, take, skip, distinct, distinctUntilChanged } from 'lulz';

filter({ predicate: x => x > 0 })
take({ count: 5 })
skip({ count: 2 })
distinct()
distinctUntilChanged()
```

### Timing

```javascript
import { debounce, throttle, delay, timeout } from 'lulz';

debounce({ time: 300 })
throttle({ time: 1000 })
delay({ time: 500 })
timeout({ time: 5000 })
```

### Combination

```javascript
import { combineLatest, merge, zip, withLatestFrom } from 'lulz';

combineLatest({ pipes: ['temp', 'humidity'] })
merge()
zip({ sources: 2 })
```

## Worker Pool

Process CPU-bound tasks in parallel using Worker Threads.

```javascript
import { taskQueue, worker, parallelMap } from 'lulz';

// Standalone task queue
const queue = taskQueue({
  workers: 4,
  handler: (data) => heavyComputation(data),
});

queue.on('result', ({ id, result }) => console.log(result));
queue.submit({ data: 42 });
await queue.drain();

// In a flow
const app = flow([
  ['input', worker({
    workers: 4,
    handler: (data) => data * data,
  }), 'output'],
]);
```

## API Reference

### flow(graph, context?)

Create a new flow.

```javascript
const app = flow([...], { username: 'alice' });

app.start();     // Start producers
app.stop();      // Stop producers
app.emit(pipe, packet);   // Inject packet
app.on(pipe, handler);    // Listen to pipe
app.pipe(name);           // Get pipe node
```

### subflow(graph, context?)

Create a reusable flow with `in`/`out` pipes.

### compose(...flows)

Connect flows in sequence.

### series(...fns) / parallel(...fns)

Explicit processing mode markers.

## Project Structure

```
lulz/
├── index.js           # Main exports
├── src/
│   ├── flow.js        # Core engine
│   ├── red-lib.js     # Node-RED style nodes
│   ├── rx-lib.js      # RxJS operators
│   ├── workers.js     # Worker pool
│   └── utils.js       # Utilities
├── test.js
├── examples.js
├── TODO.md            # Future operators
└── README.md
```

## Running

```bash
npm test        # Run tests
npm run examples    # Run examples
```

## License

MIT

## Links

- [GitHub](https://github.com/catpea/lulz)
- [Node-RED](https://nodered.org/)
- [RxJS](https://rxjs.dev/)
