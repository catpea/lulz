/**
 * lulz - Core Flow Engine
 * 
 * A reactive dataflow system that makes coders happy.
 * 
 * Processing Modes (2.0):
 *   - Series (default):   ['in', a, b, c, 'out']     → a→b→c sequential
 *   - Parallel (explicit): ['in', [a, b, c], 'out']  → all receive same packet
 * 
 * Helper functions for readability:
 *   - series(a, b, c)   → sequential processing
 *   - parallel(a, b, c) → fan-out processing
 * 
 * EventEmitter API:
 *   - app.emit('pipeName', packet)  → inject packet
 *   - app.on('pipeName', handler)   → intercept packets
 */

import { EventEmitter } from 'events';


// ─────────────────────────────────────────────────────────────
// Function Type Detection
// ─────────────────────────────────────────────────────────────

export const isOuter = (fn) => 
  typeof fn === 'function' && fn.hasOwnProperty('prototype');

export const isInner = (fn) => 
  typeof fn === 'function' && !fn.hasOwnProperty('prototype');

export const isFlow = (obj) => 
  obj && obj._isFlow === true;

export const isParallel = (item) => 
  Array.isArray(item) && item._parallel === true;

export const isSeriesMarker = (item) => 
  Array.isArray(item) && item._series === true;


// ─────────────────────────────────────────────────────────────
// Processing Mode Markers
// ─────────────────────────────────────────────────────────────

/**
 * Mark functions for parallel (fan-out) processing
 * All functions receive the same packet simultaneously
 */
export function parallel(...fns) {
  const arr = [...fns];
  arr._parallel = true;
  return arr;
}

/**
 * Mark functions for series (sequential) processing
 * Explicit marker, though series is the default
 */
export function series(...fns) {
  const arr = [...fns];
  arr._series = true;
  return arr;
}


// ─────────────────────────────────────────────────────────────
// Node Factory
// ─────────────────────────────────────────────────────────────

/**
 * Create a processing node
 */
export function makeNode(name, fn) {
  const outputs = new Set();

  function send(packet) {
    for (const out of outputs) {
      out.receive(packet);
    }
  }

  function node(packet) {
    fn(send, packet);
  }

  node.connect = function(next) {
    outputs.add(next);
    return next;
  };

  node.disconnect = function(next) {
    outputs.delete(next);
    return next;
  };

  node.receive = node;
  node.send = send;
  node.nodeName = name;
  node.outputs = outputs;
  node._isNode = true;

  return node;
}


// ─────────────────────────────────────────────────────────────
// Main Flow Builder
// ─────────────────────────────────────────────────────────────

/**
 * Create a reactive flow from a graph definition
 * 
 * @param {Array} graph - Array of pipeline definitions
 * @param {Object} context - Shared context object
 * @returns {EventEmitter} Flow instance with emit/on API
 */
export function flow(graph, context = {}) {
  
  // ─── EventEmitter Base ───
  const app = new EventEmitter();
  app._isFlow = true;
  app._context = context;
  app._pipes = {};
  app._nodes = [];
  app._producers = [];
  app._cleanups = [];
  
  // Store original emit for internal use
  const _originalEmit = app.emit.bind(app);

  
  // ─── Pipe Management ───
  
  const getPipe = (name) => {
    if (!app._pipes[name]) {
      const node = makeNode(`pipe:${name}`, (send, packet) => {
        // Notify EventEmitter listeners (use original to avoid loop)
        _originalEmit(name, packet);
        // Continue down the chain
        send(packet);
      });
      app._pipes[name] = node;
    }
    return app._pipes[name];
  };

  
  // ─── Function Preparation ───
  
  const prepareFunction = (fn) => {
    if (isOuter(fn)) {
      // Factory function: bind context, call with empty options
      const bound = fn.bind({ context });
      return bound({});
    } else {
      // Already an inner (arrow) function
      return fn;
    }
  };

  
  // ─── Build Series Chain ───
  
  const buildSeries = (fns) => {
    if (fns.length === 0) {
      const passthrough = makeNode('passthrough', (send, packet) => send(packet));
      return { input: passthrough, output: passthrough };
    }

    const nodes = fns.map((fn, i) => {
      if (isFlow(fn)) {
        // Embedded flow - return its input, wire to its output
        return { 
          _isEmbeddedFlow: true, 
          flow: fn,
          receive: (packet) => fn.emit('in', packet)
        };
      }
      
      const inner = prepareFunction(fn);
      return makeNode(fn.name || `series:${i}`, inner);
    });

    // Chain: node[0] → node[1] → ... → node[n-1]
    for (let i = 0; i < nodes.length - 1; i++) {
      const current = nodes[i];
      const next = nodes[i + 1];
      
      if (current._isEmbeddedFlow) {
        // Wire flow's output to next node
        current.flow.on('out', (packet) => {
          if (next._isEmbeddedFlow) {
            next.flow.emit('in', packet);
          } else {
            next.receive(packet);
          }
        });
      } else if (next._isEmbeddedFlow) {
        // Wire current node to flow's input
        current.connect({
          receive: (packet) => next.flow.emit('in', packet)
        });
      } else {
        current.connect(next);
      }
    }

    // Return input of first, output of last
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    
    return {
      input: first._isEmbeddedFlow 
        ? { receive: (packet) => first.flow.emit('in', packet) }
        : first,
      output: last._isEmbeddedFlow
        ? { connect: (next) => last.flow.on('out', (packet) => next.receive(packet)) }
        : last
    };
  };

  
  // ─── Build Parallel Fan-out ───
  
  const buildParallel = (fns, dest) => {
    const nodes = [];
    
    for (const fn of fns) {
      if (isFlow(fn)) {
        // Embedded flow
        const adapter = {
          receive: (packet) => fn.emit('in', packet),
          connect: (next) => fn.on('out', (packet) => next.receive(packet))
        };
        nodes.push(adapter);
      } else {
        const inner = prepareFunction(fn);
        const node = makeNode(fn.name || 'parallel', inner);
        nodes.push(node);
      }
    }
    
    return nodes;
  };

  
  // ─── Process Graph ───
  
  for (const line of graph) {
    if (!Array.isArray(line) || line.length < 2) continue;

    const elements = [...line];
    const first = elements[0];
    const last = elements[elements.length - 1];
    const middle = elements.slice(1, -1);

    // ─── SOURCE ───
    let source;
    
    if (typeof first === 'string') {
      source = getPipe(first);
    } else if (isFlow(first)) {
      // Flow as source - create adapter
      source = makeNode('flow-source', (send, packet) => send(packet));
      first.on('out', (packet) => source.receive(packet));
      first.start?.();
    } else if (typeof first === 'function') {
      // Producer function
      const producerFn = isOuter(first) 
        ? first.bind({ context })({}) 
        : first;
      
      source = makeNode(first.name || 'producer', (send, packet) => send(packet));
      
      app._producers.push({ 
        fn: producerFn, 
        node: source 
      });
    }

    // ─── DESTINATION ───
    let dest;
    
    if (typeof last === 'string') {
      dest = getPipe(last);
    } else if (isFlow(last)) {
      // Flow as destination
      dest = { 
        receive: (packet) => last.emit('in', packet),
        _isNode: true
      };
    } else if (typeof last === 'function') {
      const inner = prepareFunction(last);
      dest = makeNode(last.name || 'sink', inner);
      app._nodes.push(dest);
    }

    // ─── MIDDLE (transforms) ───
    
    if (middle.length === 0) {
      // Direct connection
      if (source.connect) source.connect(dest);
      
    } else if (middle.length === 1 && isSeriesMarker(middle[0])) {
      // Explicit series marker: ['in', series(a, b, c), 'out']
      const { input, output } = buildSeries(middle[0]);
      if (source.connect) source.connect(input);
      if (output.connect) output.connect(dest);
      
    } else if (middle.length === 1 && (isParallel(middle[0]) || Array.isArray(middle[0]))) {
      // Explicit parallel: ['in', [a, b, c], 'out'] or ['in', parallel(a,b,c), 'out']
      const fns = middle[0];
      const nodes = buildParallel(fns, dest);
      
      for (const node of nodes) {
        if (source.connect) source.connect(node);
        if (node.connect) node.connect(dest);
      }
      
    } else {
      // Default: SERIES processing (a → b → c)
      const allFns = [];
      
      for (const item of middle) {
        if (isParallel(item) || (Array.isArray(item) && !isSeriesMarker(item))) {
          // Nested parallel within series - treat as single parallel block
          allFns.push({ _parallelBlock: true, fns: item });
        } else if (isSeriesMarker(item)) {
          // Nested explicit series
          allFns.push(...item);
        } else {
          allFns.push(item);
        }
      }
      
      // Build the series chain
      const { input, output } = buildSeries(allFns.filter(f => !f._parallelBlock));
      
      if (source.connect) source.connect(input);
      if (output.connect) output.connect(dest);
    }
  }

  
  // ─── EventEmitter Injection Setup ───
  
  // Override emit to inject into pipes
  app.emit = (event, packet) => {
    // If it's a pipe name, inject the packet (which will trigger _originalEmit)
    if (app._pipes[event] && packet !== undefined) {
      app._pipes[event].receive(packet);
      return true;
    }
    // For non-pipe events, use original emit
    return _originalEmit(event, packet);
  };

  
  // ─── API Methods ───
  
  app.start = () => {
    for (const { fn, node } of app._producers) {
      const cleanup = fn((packet) => node.receive(packet));
      if (typeof cleanup === 'function') {
        app._cleanups.push(cleanup);
      }
    }
    app.emit('start');
    return app;
  };

  app.stop = () => {
    for (const cleanup of app._cleanups) {
      cleanup();
    }
    app._cleanups = [];
    app.emit('stop');
    return app;
  };

  app.inject = (pipeName, packet) => {
    app.emit(pipeName, packet);
    return app;
  };

  app.pipe = (name) => getPipe(name);
  
  // Expose for subflow wiring
  app._input = getPipe('in');
  app._output = getPipe('out');

  return app;
}


// ─────────────────────────────────────────────────────────────
// Subflow Helper
// ─────────────────────────────────────────────────────────────

/**
 * Create a subflow - a reusable flow component
 * Uses 'in' and 'out' pipes for embedding
 */
export function subflow(graph, context = {}) {
  const sub = flow(graph, context);
  sub._isSubflow = true;
  return sub;
}


// ─────────────────────────────────────────────────────────────
// Compose Helper
// ─────────────────────────────────────────────────────────────

/**
 * Compose multiple flows in sequence
 */
export function compose(...flows) {
  const composed = new EventEmitter();
  composed._isFlow = true;
  composed._isComposed = true;
  composed._flows = flows;

  // Wire flows together
  for (let i = 0; i < flows.length - 1; i++) {
    const current = flows[i];
    const next = flows[i + 1];
    current.on('out', (packet) => next.emit('in', packet));
  }

  // Expose first input, last output
  composed._input = flows[0]?._input;
  composed._output = flows[flows.length - 1]?._output;

  composed.start = () => {
    for (const f of flows) f.start?.();
    return composed;
  };

  composed.stop = () => {
    for (const f of flows) f.stop?.();
    return composed;
  };

  // Forward 'in' to first flow
  composed.emit = (event, packet) => {
    if (event === 'in') {
      flows[0]?.emit('in', packet);
    }
    return EventEmitter.prototype.emit.call(composed, event, packet);
  };

  // Forward 'out' from last flow
  flows[flows.length - 1]?.on('out', (packet) => {
    EventEmitter.prototype.emit.call(composed, 'out', packet);
  });

  return composed;
}
