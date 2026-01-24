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

## Workers

lulz includes a worker pool system for CPU-intensive tasks. It uses **Worker Threads** in Node.js (and Web Workers in browsers) so heavy computation doesn't block your main thread.

### Why Workers?

JavaScript is single-threaded. If you compute Fibonacci(45), your entire app freezes:

```javascript
// ❌ Bad: Blocks everything
['input', (send, packet) => {
  const result = fibonacci(packet.payload);  // 🧊 Frozen for 5 seconds
  send({ ...packet, payload: result });
}, 'output']
```

Workers run in separate threads:

```javascript
// ✅ Good: Non-blocking
['input', worker({ handler: fibonacci }), 'output']
// Main thread stays responsive while workers compute
```

---

### taskQueue — Standalone Task Queue

The foundation. An EventEmitter that manages a pool of workers.

```javascript
import { taskQueue } from 'lulz';

// Create a queue with 4 workers
const queue = taskQueue({
  workers: 4,                      // Number of worker threads (default: CPU cores)
  handler: (data) => data * data   // Function that runs in worker
});

// Listen for completed tasks
queue.on('result', ({ id, result }) => {
  console.log(`Task ${id} finished:`, result);
});

// Listen for errors (handler threw an exception)
queue.on('error', ({ id, error }) => {
  console.error(`Task ${id} failed:`, error);
});

// Listen for all tasks complete
queue.on('drain', () => {
  console.log('All tasks done!');
});

// Submit a single task
queue.submit({ id: 'task-1', data: 42 });
// → Task task-1 finished: 1764

// Submit multiple tasks
queue.submitAll([
  { id: 'a', data: 10 },
  { id: 'b', data: 20 },
  { id: 'c', data: 30 },
]);
```

#### Async Handlers

Handlers can be async:

```javascript
const queue = taskQueue({
  workers: 2,
  handler: async (url) => {
    const response = await fetch(url);
    return response.json();
  }
});

queue.submit({ data: 'https://api.example.com/data' });
```

#### Queue Control

```javascript
// Check queue status
console.log(queue.stats());
// → { pending: 5, running: 4, available: 0, totalSubmitted: 9, totalCompleted: 4 }

// Wait for all tasks to complete
await queue.drain();

// Shut down all workers
await queue.terminate();
```

---

### worker — Flow Integration

Use workers directly in your flows. Packets go in, get processed in worker threads, come out.

```javascript
import { flow, worker } from 'lulz';

const app = flow([
  ['numbers',
    // This runs in a worker thread, not the main thread
    worker({
      workers: 4,
      handler: (n) => {
        // Heavy computation here
        let sum = 0;
        for (let i = 0; i < n * 1000000; i++) {
          sum += Math.sqrt(i);
        }
        return sum;
      }
    }),
    'results'
  ],

  ['results', debug({ name: 'computed' })],
]);

// Send numbers to process
app.emit('numbers', { payload: 100 });
app.emit('numbers', { payload: 200 });
app.emit('numbers', { payload: 300 });
// Results arrive as workers complete (may be out of order)
```

#### Preserves Packet Metadata

The worker node keeps your packet's other properties intact:

```javascript
app.emit('numbers', {
  payload: 100,
  userId: 'alice',      // ← preserved
  requestId: 'req-123'  // ← preserved
});

// Output packet:
// { payload: 12345.67, userId: 'alice', requestId: 'req-123' }
```

---

### parallelMap — Process Arrays

When you have an array and want each item processed in parallel:

```javascript
import { flow, parallelMap } from 'lulz';

const app = flow([
  ['images',
    parallelMap({
      workers: 4,
      fn: (image) => {
        // Each image processed in its own worker
        return {
          ...image,
          thumbnail: generateThumbnail(image),
          compressed: compress(image)
        };
      }
    }),
    'processed'
  ],
]);

// Send an array
app.emit('images', {
  payload: [image1, image2, image3, image4, image5]
});

// Receive complete array (order preserved!)
// { payload: [processed1, processed2, processed3, processed4, processed5] }
```

Key difference from `worker`:
- `worker`: Each packet = one task, results stream out
- `parallelMap`: One packet with array = many tasks, waits for all, emits single array

---

### cpuTask — Quick Wrapper

Shorthand when you just want to run a function in a worker:

```javascript
import { flow, cpuTask } from 'lulz';

// Instead of this:
worker({ handler: (n) => fibonacci(n) })

// Write this:
cpuTask((n) => fibonacci(n))
```

Example:

```javascript
const app = flow([
  ['input', cpuTask(expensiveCalculation), 'output'],
]);
```

It's just sugar for `worker({ handler: fn })` with default worker count.

---

### Patterns

#### Pattern 1: Fan-Out Computation

Process the same data multiple ways in parallel:

```javascript
const app = flow([
  ['data', [
    worker({ handler: analyzeWithMethodA }),
    worker({ handler: analyzeWithMethodB }),
    worker({ handler: analyzeWithMethodC }),
  ], 'analyzed'],
]);
// All three analyses run simultaneously in different workers
```

#### Pattern 2: Pipeline with Mixed Threading

Some steps in main thread, heavy steps in workers:

```javascript
const app = flow([
  ['request',
    validate,           // Fast: main thread
    parseInput,         // Fast: main thread
    worker({ handler: heavyTransform }),  // Slow: worker
    formatOutput,       // Fast: main thread
    'response'
  ],
]);
```

#### Pattern 3: Batch Processing

Split → process in workers → join:

```javascript
const app = flow([
  // Split array into individual items
  ['batch', split(), 'item'],

  // Process each in workers
  ['item', worker({ handler: processOne }), 'processed'],

  // Collect results (need custom collector)
  ['processed', join({ count: expectedCount }), 'complete'],
]);
```

Or just use `parallelMap` which does this for you:

```javascript
const app = flow([
  ['batch', parallelMap({ fn: processOne }), 'complete'],
]);
```

---

### Error Handling

Worker errors don't crash your app. They emit on the `'error'` event:

```javascript
const queue = taskQueue({
  handler: (data) => {
    if (data < 0) throw new Error('Negative not allowed');
    return Math.sqrt(data);
  }
});

queue.on('result', ({ id, result }) => {
  console.log(`${id} = ${result}`);
});

queue.on('error', ({ id, error }) => {
  console.log(`${id} failed: ${error}`);
});

queue.submit({ id: 'good', data: 16 });   // → good = 4
queue.submit({ id: 'bad', data: -1 });    // → bad failed: Negative not allowed
```

In flows, errors become packet properties:

```javascript
['input', worker({ handler: riskyFunction }), 'output']

// If handler throws, packet becomes:
// { payload: ..., error: 'Error message' }
```

---

### Configuration

```javascript
import { cpus } from 'os';

taskQueue({
  workers: cpus().length,  // Default: number of CPU cores
  handler: fn,             // Required: function to run in worker
})

worker({
  workers: 4,              // Default: number of CPU cores
  handler: fn,             // Required: function to run in worker
})

parallelMap({
  workers: 4,              // Default: number of CPU cores
  fn: fn,                  // Required: function to run in worker
})
```

---

### When to Use Workers

✅ **Use workers for:**
- Mathematical computations (crypto, statistics, ML inference)
- Image/video processing
- Data parsing (large JSON, CSV)
- Compression/decompression
- Any task taking >50ms

❌ **Don't use workers for:**
- Simple transformations (`x * 2`)
- I/O-bound tasks (use async/await instead)
- Tasks needing DOM access (workers can't touch DOM)
- Very small tasks (worker overhead > computation)

The overhead of sending data to a worker and back is ~1-5ms. If your task takes less than that, just run it in the main thread.

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
