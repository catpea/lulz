/**
 * lulz - RxJS-Inspired Operators Library
 * 
 * Reactive operators for stream processing.
 * All operators follow the outer/inner function pattern.
 */


// ─────────────────────────────────────────────────────────────
// Combination Operators
// ─────────────────────────────────────────────────────────────

/**
 * combineLatest - Combines latest values from multiple pipes
 * 
 * Creates a node that collects the latest value from each specified pipe
 * and emits an array/object whenever any pipe updates.
 * 
 * @param {Object} options
 * @param {string[]} options.pipes - Array of pipe names to combine
 * @param {string} options.output - Output format: 'array' or 'object' (default: 'object')
 * @param {Object} options.app - The flow app instance (required)
 * 
 * Usage:
 *   const app = flow([
 *     ['temp', combineLatest({ app: () => app, pipes: ['temp', 'humidity'] }), 'combined'],
 *   ]);
 */
export function combineLatest(options = {}) {
  const { 
    pipes = [], 
    output = 'object',
    app: getApp = null 
  } = options;

  if (pipes.length === 0) {
    console.warn('[combineLatest] No pipes configured');
  }

  const latest = {};
  const received = new Set();

  return (send, packet) => {
    // This node should be connected to trigger on any pipe update
    // We track the pipe name from packet.topic or a special field
    const pipeName = packet._pipe || packet.topic;
    
    if (pipeName && pipes.includes(pipeName)) {
      latest[pipeName] = packet.payload !== undefined ? packet.payload : packet;
      received.add(pipeName);
    }

    // Only emit when all pipes have sent at least once
    if (received.size === pipes.length) {
      if (output === 'array') {
        send({ payload: pipes.map(p => latest[p]) });
      } else {
        send({ payload: { ...latest } });
      }
    }
  };
}

/**
 * merge - Merges multiple inputs into single output
 * Simply passes through all packets from any source.
 */
export function merge(options = {}) {
  return (send, packet) => send(packet);
}

/**
 * concat - Concatenates inputs (waits for completion)
 * Since we're push-based, this buffers until 'complete' signal.
 */
export function concat(options = {}) {
  const { waitFor = 'complete' } = options;
  const buffer = [];

  return (send, packet) => {
    if (packet._complete || packet.complete) {
      for (const p of buffer) send(p);
      buffer.length = 0;
    } else {
      buffer.push(packet);
    }
  };
}

/**
 * zip - Zips values from multiple sources by index
 * 
 * @param {Object} options
 * @param {number} options.sources - Number of sources to zip
 */
export function zip(options = {}) {
  const { sources = 2 } = options;
  const buffers = Array.from({ length: sources }, () => []);
  let sourceIndex = 0;

  return (send, packet) => {
    const idx = packet._sourceIndex ?? sourceIndex++ % sources;
    buffers[idx].push(packet);

    // Check if all buffers have at least one item
    if (buffers.every(b => b.length > 0)) {
      const zipped = buffers.map(b => b.shift());
      send({ payload: zipped.map(p => p.payload !== undefined ? p.payload : p) });
    }
  };
}

/**
 * withLatestFrom - Combines with latest from another source
 */
export function withLatestFrom(options = {}) {
  const { pipe = null, app: getApp = null } = options;
  let latest = null;
  let hasLatest = false;

  return (send, packet) => {
    if (packet._pipe === pipe || packet._fromLatest) {
      latest = packet.payload !== undefined ? packet.payload : packet;
      hasLatest = true;
    } else if (hasLatest) {
      send({
        ...packet,
        payload: [packet.payload, latest]
      });
    }
  };
}


// ─────────────────────────────────────────────────────────────
// Transformation Operators
// ─────────────────────────────────────────────────────────────

/**
 * map - Transform each value
 * 
 * @param {Object} options
 * @param {Function} options.fn - Transformation function
 */
export function map(options = {}) {
  const { fn = (x) => x } = options;

  return (send, packet) => {
    const result = fn(packet.payload !== undefined ? packet.payload : packet, packet);
    send({ ...packet, payload: result });
  };
}

/**
 * pluck - Extract a property
 * 
 * @param {Object} options
 * @param {string} options.path - Property path to extract
 */
export function pluck(options = {}) {
  const { path = 'payload' } = options;

  return (send, packet) => {
    const parts = path.split('.');
    let value = packet;
    for (const part of parts) {
      value = value?.[part];
    }
    send({ ...packet, payload: value });
  };
}

/**
 * scan - Accumulate values over time
 * 
 * @param {Object} options
 * @param {Function} options.reducer - Reducer function (acc, value) => newAcc
 * @param {*} options.initial - Initial accumulator value
 */
export function scan(options = {}) {
  const { reducer = (acc, x) => acc + x, initial = 0 } = options;
  let accumulator = initial;

  return (send, packet) => {
    const value = packet.payload !== undefined ? packet.payload : packet;
    accumulator = reducer(accumulator, value);
    send({ ...packet, payload: accumulator });
  };
}

/**
 * buffer - Buffer values until condition
 * 
 * @param {Object} options
 * @param {number} options.count - Emit after N values
 * @param {number} options.time - Emit after N ms
 */
export function buffer(options = {}) {
  const { count = null, time = null } = options;
  const buf = [];
  let timer = null;

  const flush = (send) => {
    if (buf.length > 0) {
      send({ payload: buf.map(p => p.payload !== undefined ? p.payload : p) });
      buf.length = 0;
    }
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return (send, packet) => {
    buf.push(packet);

    if (time && !timer) {
      timer = setTimeout(() => flush(send), time);
    }

    if (count && buf.length >= count) {
      flush(send);
    }
  };
}

/**
 * window - Divide into windows
 * 
 * @param {Object} options
 * @param {number} options.count - Window size
 */
export function window(options = {}) {
  const { count = 10 } = options;
  let windowBuf = [];

  return (send, packet) => {
    windowBuf.push(packet);
    
    if (windowBuf.length >= count) {
      send({ payload: windowBuf });
      windowBuf = [];
    }
  };
}

/**
 * pairwise - Emit previous and current value
 */
export function pairwise(options = {}) {
  let previous = null;
  let hasPrevious = false;

  return (send, packet) => {
    if (hasPrevious) {
      const prev = previous.payload !== undefined ? previous.payload : previous;
      const curr = packet.payload !== undefined ? packet.payload : packet;
      send({ ...packet, payload: [prev, curr] });
    }
    previous = packet;
    hasPrevious = true;
  };
}


// ─────────────────────────────────────────────────────────────
// Filtering Operators
// ─────────────────────────────────────────────────────────────

/**
 * filter - Filter based on predicate
 * 
 * @param {Object} options
 * @param {Function} options.predicate - Filter function
 */
export function filter(options = {}) {
  const { predicate = () => true } = options;

  return (send, packet) => {
    const value = packet.payload !== undefined ? packet.payload : packet;
    if (predicate(value, packet)) {
      send(packet);
    }
  };
}

/**
 * distinct - Only emit distinct values
 * 
 * @param {Object} options
 * @param {Function} options.keyFn - Key extraction function
 */
export function distinct(options = {}) {
  const { keyFn = (x) => x } = options;
  const seen = new Set();

  return (send, packet) => {
    const value = packet.payload !== undefined ? packet.payload : packet;
    const key = keyFn(value);
    
    if (!seen.has(key)) {
      seen.add(key);
      send(packet);
    }
  };
}

/**
 * distinctUntilChanged - Only emit when different from previous
 * 
 * @param {Object} options
 * @param {Function} options.comparator - Comparison function
 */
export function distinctUntilChanged(options = {}) {
  const { comparator = (a, b) => a === b } = options;
  let previous;
  let hasPrevious = false;

  return (send, packet) => {
    const value = packet.payload !== undefined ? packet.payload : packet;
    
    if (!hasPrevious || !comparator(previous, value)) {
      previous = value;
      hasPrevious = true;
      send(packet);
    }
  };
}

/**
 * take - Take only first N values
 * 
 * @param {Object} options
 * @param {number} options.count - Number to take
 */
export function take(options = {}) {
  const { count = 1 } = options;
  let taken = 0;

  return (send, packet) => {
    if (taken < count) {
      taken++;
      send(packet);
    }
  };
}

/**
 * skip - Skip first N values
 * 
 * @param {Object} options
 * @param {number} options.count - Number to skip
 */
export function skip(options = {}) {
  const { count = 1 } = options;
  let skipped = 0;

  return (send, packet) => {
    if (skipped >= count) {
      send(packet);
    } else {
      skipped++;
    }
  };
}

/**
 * takeWhile - Take while condition is true
 * 
 * @param {Object} options
 * @param {Function} options.predicate - Condition function
 */
export function takeWhile(options = {}) {
  const { predicate = () => true } = options;
  let active = true;

  return (send, packet) => {
    if (active) {
      const value = packet.payload !== undefined ? packet.payload : packet;
      if (predicate(value, packet)) {
        send(packet);
      } else {
        active = false;
      }
    }
  };
}

/**
 * skipWhile - Skip while condition is true
 * 
 * @param {Object} options
 * @param {Function} options.predicate - Condition function
 */
export function skipWhile(options = {}) {
  const { predicate = () => true } = options;
  let skipping = true;

  return (send, packet) => {
    const value = packet.payload !== undefined ? packet.payload : packet;
    
    if (skipping && !predicate(value, packet)) {
      skipping = false;
    }
    
    if (!skipping) {
      send(packet);
    }
  };
}


// ─────────────────────────────────────────────────────────────
// Timing Operators
// ─────────────────────────────────────────────────────────────

/**
 * debounce - Debounce emissions
 * 
 * @param {Object} options
 * @param {number} options.time - Debounce time in ms
 */
export function debounce(options = {}) {
  const { time = 300 } = options;
  let timer = null;
  let latest = null;

  return (send, packet) => {
    latest = packet;
    
    if (timer) clearTimeout(timer);
    
    timer = setTimeout(() => {
      send(latest);
      timer = null;
    }, time);
  };
}

/**
 * throttle - Throttle emissions
 * 
 * @param {Object} options
 * @param {number} options.time - Throttle time in ms
 * @param {boolean} options.leading - Emit on leading edge (default: true)
 * @param {boolean} options.trailing - Emit on trailing edge (default: true)
 */
export function throttle(options = {}) {
  const { time = 300, leading = true, trailing = true } = options;
  let lastEmit = 0;
  let timer = null;
  let latest = null;

  return (send, packet) => {
    const now = Date.now();
    latest = packet;

    if (now - lastEmit >= time) {
      if (leading) {
        lastEmit = now;
        send(packet);
      }
    } else if (trailing && !timer) {
      timer = setTimeout(() => {
        lastEmit = Date.now();
        send(latest);
        timer = null;
      }, time - (now - lastEmit));
    }
  };
}

/**
 * delay - Delay each emission
 * 
 * @param {Object} options
 * @param {number} options.time - Delay in ms
 */
export function delay(options = {}) {
  const { time = 0 } = options;

  return (send, packet) => {
    setTimeout(() => send(packet), time);
  };
}

/**
 * timeout - Error if no value within time
 * 
 * @param {Object} options
 * @param {number} options.time - Timeout in ms
 */
export function timeout(options = {}) {
  const { time = 5000 } = options;
  let timer = null;

  return (send, packet) => {
    if (timer) clearTimeout(timer);
    
    timer = setTimeout(() => {
      send({ ...packet, error: 'timeout', _timeout: true });
    }, time);
    
    send(packet);
  };
}

/**
 * timestamp - Add timestamp to each value
 */
export function timestamp(options = {}) {
  return (send, packet) => {
    send({
      ...packet,
      timestamp: Date.now()
    });
  };
}


// ─────────────────────────────────────────────────────────────
// Error Handling Operators
// ─────────────────────────────────────────────────────────────

/**
 * catchError - Handle errors
 * 
 * @param {Object} options
 * @param {Function} options.handler - Error handler function
 */
export function catchError(options = {}) {
  const { handler = (err, packet) => packet } = options;

  return (send, packet) => {
    if (packet.error) {
      const result = handler(packet.error, packet);
      if (result !== null && result !== undefined) {
        send(result);
      }
    } else {
      send(packet);
    }
  };
}

/**
 * retry - Retry on error
 * 
 * @param {Object} options
 * @param {number} options.count - Number of retries
 */
export function retry(options = {}) {
  const { count = 3 } = options;
  let retries = 0;

  return (send, packet) => {
    if (packet.error && retries < count) {
      retries++;
      send({ ...packet, _retry: retries });
    } else {
      retries = 0;
      send(packet);
    }
  };
}


// ─────────────────────────────────────────────────────────────
// Utility Operators
// ─────────────────────────────────────────────────────────────

/**
 * tap - Side effect without transformation
 * 
 * @param {Object} options
 * @param {Function} options.fn - Side effect function
 */
export function tap(options = {}) {
  const { fn = () => {} } = options;

  return (send, packet) => {
    fn(packet);
    send(packet);
  };
}

/**
 * log - Log values (alias for debug)
 * 
 * @param {Object} options
 * @param {string} options.label - Log label
 */
export function log(options = {}) {
  const { label = 'log', logger = console.log } = options;

  return (send, packet) => {
    logger(`[${label}]`, packet.payload !== undefined ? packet.payload : packet);
    send(packet);
  };
}

/**
 * count - Count emissions
 */
export function count(options = {}) {
  let counter = 0;

  return (send, packet) => {
    counter++;
    send({ ...packet, count: counter });
  };
}

/**
 * toArray - Collect all values into array
 * 
 * @param {Object} options
 * @param {Function} options.until - Condition to emit
 */
export function toArray(options = {}) {
  const { until = null } = options;
  const arr = [];

  return (send, packet) => {
    arr.push(packet.payload !== undefined ? packet.payload : packet);
    
    if (until && until(packet, arr)) {
      send({ payload: [...arr] });
      arr.length = 0;
    }
  };
}

/**
 * defaultIfEmpty - Emit default if no values
 * 
 * @param {Object} options
 * @param {*} options.value - Default value
 */
export function defaultIfEmpty(options = {}) {
  const { value = null } = options;
  let hasEmitted = false;

  return (send, packet) => {
    if (packet._complete && !hasEmitted) {
      send({ payload: value });
    } else {
      hasEmitted = true;
      send(packet);
    }
  };
}

/**
 * share - Multicast to multiple subscribers
 * Converts cold observable behavior to hot
 */
export function share(options = {}) {
  const subscribers = new Set();
  let hasValue = false;
  let latest = null;

  const node = (send, packet) => {
    latest = packet;
    hasValue = true;
    for (const sub of subscribers) {
      sub(packet);
    }
    send(packet);
  };

  node.subscribe = (fn) => {
    subscribers.add(fn);
    if (hasValue) fn(latest);
    return () => subscribers.delete(fn);
  };

  return node;
}
