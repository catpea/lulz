/**
 * lulz - A reactive dataflow system inspired by FFmpeg filtergraph
 *
 * Syntax:
 *   [source, ...transforms, destination]
 *
 * Where:
 *   - source: string (pipe name) or producer function
 *   - transforms: functions (outer or inner) or arrays for series
 *   - destination: string (pipe name) or consumer function
 *
 * Series processing:
 *   ['in', [a, b, c], 'out']  - a→b→c in sequence
 *
 * Fan-out (parallel):
 *   ['in', a, b, c, 'out']    - all receive same packet, all send to out
 */

// Distinguish outer (regular fn) from inner (arrow fn)
function isOuter(fn) {
  return typeof fn === 'function' && fn.hasOwnProperty('prototype');
}

function isInner(fn) {
  return typeof fn === 'function' && !fn.hasOwnProperty('prototype');
}

function isSeriesArray(item) {
  return Array.isArray(item) && item.every(el => typeof el === 'function');
}

/**
 * Create a processing node
 */
function makeNode(name, fn) {
  const outputs = new Set();

  function send(packet) {
    for (const out of outputs) {
      out.receive(packet);
    }
  }

  function receive(packet) {
    fn(send, packet);
  }

  receive.connect = (next) => {
    outputs.add(next);
    return next;
  };

  receive.disconnect = (next) => {
    outputs.delete(next);
  };

  receive.receive = receive;
  Object.defineProperty(receive, 'name', { value: name, writable: false });
  receive.outputs = outputs;
  receive._isNode = true;

  return receive;
}

/**
 * Create a pass-through pipe
 */
function makePipe(name) {
  return makeNode(name, (send, packet) => send(packet));
}

/**
 * Build a series chain: a→b→c
 * Returns { input, output } nodes
 */
function buildSeries(fns, context, prepareFunction) {
  if (fns.length === 0) {
    const passthrough = makeNode('passthrough', (send, packet) => send(packet));
    return { input: passthrough, output: passthrough };
  }

  const nodes = fns.map((fn, i) => {
    const inner = prepareFunction(fn);
    return makeNode(fn.name || `series-${i}`, inner);
  });

  // Chain them: node[0] → node[1] → ... → node[n-1]
  for (let i = 0; i < nodes.length - 1; i++) {
    nodes[i].connect(nodes[i + 1]);
  }

  return {
    input: nodes[0],
    output: nodes[nodes.length - 1]
  };
}

/**
 * Main flow builder
 */
function flow(graph, context = {}) {
  const pipes = {};
  const nodes = [];
  const producers = [];

  function getPipe(name) {
    if (!pipes[name]) {
      pipes[name] = makePipe(name);
    }
    return pipes[name];
  }

  // Convert any function to a ready-to-use inner function
  function prepareFunction(fn) {
    if (isOuter(fn)) {
      // Factory function: call with empty options, bind context
      const bound = fn.bind({ context });
      return bound({});
    } else {
      // Arrow (inner) function - wrap to provide context
      return (send, packet) => {
        // Create a this-like object for arrow functions via closure
        fn(send, packet);
      };
    }
  }

  // Process each line in the graph
  for (const line of graph) {
    if (!Array.isArray(line) || line.length < 2) continue;

    const elements = [...line];
    const first = elements[0];
    const last = elements[elements.length - 1];
    const middle = elements.slice(1, -1);

    // === SOURCE ===
    let source;
    if (typeof first === 'string') {
      source = getPipe(first);
    } else if (typeof first === 'function') {
      // Producer function
      const producerFn = isOuter(first) ? first.bind({ context })({}) : first;
      const node = makeNode(first.name || 'producer', (send, packet) => send(packet));
      
      // Store producer for later activation
      producers.push({ fn: producerFn, node });
      source = node;
    } else if (first?._isFlow) {
      // Subflow as source
      source = first._output || getPipe('__subflow_out__');
    }

    // === DESTINATION ===
    let dest;
    if (typeof last === 'string') {
      dest = getPipe(last);
    } else if (typeof last === 'function') {
      const inner = prepareFunction(last);
      dest = makeNode(last.name || 'sink', inner);
      nodes.push(dest);
    } else if (last?._isFlow) {
      // Subflow as destination
      dest = last._input || getPipe('__subflow_in__');
    }

    // === MIDDLE (transforms) ===
    if (middle.length === 0) {
      // Direct connection
      source.connect(dest);
    } else {
      // Check if we have series arrays or fan-out
      const hasSeries = middle.some(isSeriesArray);
      
      if (middle.length === 1 && isSeriesArray(middle[0])) {
        // Pure series: ['in', [a, b, c], 'out']
        const { input, output } = buildSeries(middle[0], context, prepareFunction);
        source.connect(input);
        output.connect(dest);
        nodes.push(input);
      } else {
        // Fan-out or mixed
        for (const item of middle) {
          if (isSeriesArray(item)) {
            // Series within fan-out: ['in', a, [b, c, d], e, 'out']
            const { input, output } = buildSeries(item, context, prepareFunction);
            source.connect(input);
            output.connect(dest);
            nodes.push(input);
          } else if (typeof item === 'function') {
            // Regular transform in fan-out
            const inner = prepareFunction(item);
            const node = makeNode(item.name || 'transform', inner);
            source.connect(node);
            node.connect(dest);
            nodes.push(node);
          }
        }
      }
    }
  }

  // Create the flow object
  const flowObj = {
    pipes,
    nodes,
    producers,
    _isFlow: true,

    // Start all producers
    start() {
      for (const { fn, node } of producers) {
        fn((packet) => node.receive(packet));
      }
      return this;
    },

    // Stop all producers (if they return cleanup functions)
    stop() {
      // TODO: implement cleanup
      return this;
    },

    // Inject a packet into a pipe
    inject(pipeName, packet) {
      const pipe = pipes[pipeName];
      if (pipe) {
        pipe.receive(packet);
      } else {
        console.warn(`Pipe "${pipeName}" not found`);
      }
      return this;
    },

    // Get a pipe for external connection
    getPipe(name) {
      return getPipe(name);
    },

    // For subflow embedding
    _input: pipes['in'],
    _output: pipes['out'],
  };

  return flowObj;
}

/**
 * Create a subflow that can be embedded in other flows
 */
function subflow(graph, context = {}) {
  // Ensure the subflow has 'in' and 'out' pipes
  const flowObj = flow(graph, context);
  
  // Mark as subflow
  flowObj._isSubflow = true;
  flowObj._input = flowObj.getPipe('in');
  flowObj._output = flowObj.getPipe('out');

  return flowObj;
}

/**
 * Compose multiple flows
 */
function compose(...flows) {
  // Connect flows in sequence
  for (let i = 0; i < flows.length - 1; i++) {
    const current = flows[i];
    const next = flows[i + 1];
    
    if (current._output && next._input) {
      current._output.connect(next._input);
    }
  }

  return {
    _isFlow: true,
    _isComposed: true,
    flows,
    _input: flows[0]?._input,
    _output: flows[flows.length - 1]?._output,
    
    start() {
      for (const f of flows) {
        if (f.start) f.start();
      }
      return this;
    },
    
    stop() {
      for (const f of flows) {
        if (f.stop) f.stop();
      }
      return this;
    },
    
    inject(pipeName, packet) {
      flows[0]?.inject(pipeName, packet);
      return this;
    }
  };
}

export {
  flow,
  subflow,
  compose,
  makeNode,
  makePipe,
  isOuter,
  isInner,
};
