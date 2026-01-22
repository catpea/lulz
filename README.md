# lulz

A reactive dataflow system inspired by FFmpeg filtergraph notation and Node-RED.

## Installation

```bash
npm install lulz
```

## Quick Start

```javascript
const { flow, Inject, Debug } = require('./index');

const app = flow([
  [Inject({ payload: 'Hello World!' }), Debug({ name: 'output' })],
]);

app.start();
```

## Core Concepts

### Flow Syntax

Each line in a flow is an array: `[source, ...transforms, destination]`

- **Source**: A string (pipe name) or producer function
- **Transforms**: Functions that process packets
- **Destination**: A string (pipe name) or consumer function

```javascript
const app = flow([
  [producer, 'pipeName'],          // Producer → pipe
  ['pipeName', transform, 'out'],  // Pipe → transform → pipe
  ['out', consumer],               // Pipe → consumer
]);
```

### Function Types

**Outer functions** (factories) are regular functions that return inner functions:

```javascript
function myTransform(options) {           // Outer - receives config
  return (send, packet) => {              // Inner - processes packets
    send({ ...packet, modified: true });
  };
}
```

**Inner functions** are arrow functions that do the actual processing:

```javascript
const passthrough = (send, packet) => send(packet);
```

The system auto-detects which is which using `fn.hasOwnProperty('prototype')`:
- Regular functions have `prototype` → outer
- Arrow functions don't → inner

### Pre-configured vs Auto-configured

```javascript
['input', myTransform, 'output']              // Auto-config: called with {}
['input', myTransform({ option: 1 }), 'output'] // Pre-configured
```

## Processing Modes

### Fan-out (Parallel)

All transforms receive the same packet simultaneously:

```javascript
['input', transformA, transformB, transformC, 'output']
//         ↓           ↓           ↓
//      packet      packet      packet
//         ↓           ↓           ↓
//         └───────────┴───────────┘
//                     ↓
//                  output (receives 3 packets)
```

### Series (Sequential)

Use `[a, b, c]` syntax for sequential processing:

```javascript
['input', [transformA, transformB, transformC], 'output']
//                ↓
//            packet
//                ↓
//           transformA
//                ↓
//           transformB
//                ↓
//           transformC
//                ↓
//             output (receives 1 packet)
```

### Mixed

Combine both in a single line:

```javascript
['input', validate, [enrich, format], notify, 'output']
//           ↓              ↓            ↓
//        fan-out        series       fan-out
```

## Built-in Nodes

### Inject

Produces packets on schedule or trigger:

```javascript
Inject({
  payload: 'hello',        // or () => Date.now() for dynamic
  topic: 'greeting',
  once: true,              // Emit once on start
  onceDelay: 100,          // Delay before first emit (ms)
  interval: 1000,          // Repeat interval (ms)
})
```

### Debug

Logs packets:

```javascript
Debug({
  name: 'my-debug',
  active: true,
  complete: false,         // true = show full msg, false = payload only
  logger: console.log,     // Custom logger function
})
```

### Function

Execute custom JavaScript:

```javascript
Function({
  func: (msg, context) => {
    return { ...msg, payload: msg.payload.toUpperCase() };
  },
})
```

Return `null` to drop the message.

### Change

Modify message properties:

```javascript
Change({
  rules: [
    { type: 'set', prop: 'payload', to: 'new value' },
    { type: 'set', prop: 'topic', to: (msg) => msg.payload.type },
    { type: 'change', prop: 'payload', from: /old/, to: 'new' },
    { type: 'delete', prop: 'unwanted' },
    { type: 'move', prop: 'payload', to: 'data' },
  ]
})
```

### Switch

Route messages based on conditions:

```javascript
Switch({
  property: 'payload',
  rules: [
    { type: 'eq', value: 'hello' },
    { type: 'gt', value: 100 },
    { type: 'regex', value: /^test/ },
    { type: 'else' },
  ],
  checkall: false,  // Stop at first match
})
```

Rule types: `eq`, `neq`, `lt`, `gt`, `lte`, `gte`, `regex`, `true`, `false`, `null`, `nnull`, `else`

### Template

Render mustache templates:

```javascript
Template({
  template: 'Hello {{name}}, you have {{count}} messages!',
  field: 'payload',  // Output field
})
```

### Delay

Delay or rate-limit messages:

```javascript
Delay({
  delay: 1000,    // Delay in ms
  rate: 10,       // Or rate limit (msgs/sec)
  drop: false,    // Drop vs queue when rate limited
})
```

### Split

Split arrays/strings into sequences:

```javascript
Split({
  property: 'payload',
  delimiter: ',',  // For strings, or 'array' for arrays
})
```

### Join

Join sequences back together:

```javascript
Join({
  count: 5,           // Emit after N messages
  property: 'payload',
  mode: 'manual',     // 'auto', 'manual', 'reduce'
})
```

## Subflows

Create reusable flow components:

```javascript
const sanitizer = subflow([
  ['in', Function({ func: (msg) => ({
    ...msg,
    payload: String(msg.payload).trim().toLowerCase()
  })}), 'out'],
]);

// Wire into main flow
mainFlow.pipes['input'].connect(sanitizer._input);
sanitizer._output.connect(mainFlow.pipes['process']);
```

## API

### `flow(graph, context)`

Create a new flow from a graph definition.

Returns:
- `start()` - Start all producers
- `stop()` - Stop all producers
- `inject(pipeName, packet)` - Inject a packet into a pipe
- `getPipe(name)` - Get a pipe by name
- `pipes` - Object of all pipes

### `subflow(graph, context)`

Create a subflow with `in` and `out` pipes.

### `compose(...flows)`

Connect multiple flows in sequence.

## Running

```bash
npm test      # Run tests
npm run examples  # Run examples
```

## License

MIT
