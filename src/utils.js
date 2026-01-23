/**
 * lulz - Utilities
 * 
 * Helper functions and utilities.
 */


// ─────────────────────────────────────────────────────────────
// Packet Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Create a properly formatted packet
 */
export const packet = (payload, meta = {}) => ({
  payload,
  topic: meta.topic ?? '',
  _id: meta._id ?? crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
  _ts: Date.now(),
  ...meta,
});

/**
 * Clone a packet (deep copy)
 */
export const clonePacket = (pkt) => 
  JSON.parse(JSON.stringify(pkt));

/**
 * Merge packets
 */
export const mergePackets = (...packets) => 
  packets.reduce((acc, p) => ({
    ...acc,
    ...p,
    payload: p.payload ?? acc.payload,
  }), {});


// ─────────────────────────────────────────────────────────────
// Function Composition Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Pipe functions left to right
 */
export const pipe = (...fns) => (x) => 
  fns.reduce((v, f) => f(v), x);

/**
 * Compose functions right to left
 */
export const compose = (...fns) => (x) => 
  fns.reduceRight((v, f) => f(v), x);

/**
 * Identity function
 */
export const identity = (x) => x;

/**
 * Constant function
 */
export const constant = (x) => () => x;

/**
 * Noop function
 */
export const noop = () => {};


// ─────────────────────────────────────────────────────────────
// Async Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Sleep for ms
 */
export const sleep = (ms) => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Timeout a promise
 */
export const withTimeout = (promise, ms, message = 'Timeout') =>
  Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);

/**
 * Retry a function
 */
export const withRetry = async (fn, { retries = 3, delay = 1000, backoff = 2 } = {}) => {
  let lastError;
  
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < retries) {
        await sleep(delay * Math.pow(backoff, i));
      }
    }
  }
  
  throw lastError;
};


// ─────────────────────────────────────────────────────────────
// Collection Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Chunk array into groups
 */
export const chunk = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

/**
 * Flatten nested arrays
 */
export const flatten = (arr, depth = 1) => 
  arr.flat(depth);

/**
 * Unique values
 */
export const unique = (arr, keyFn = (x) => x) => {
  const seen = new Set();
  return arr.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Group by key
 */
export const groupBy = (arr, keyFn) => {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
};

/**
 * Partition by predicate
 */
export const partition = (arr, predicate) => {
  const truthy = [];
  const falsy = [];
  
  for (const item of arr) {
    (predicate(item) ? truthy : falsy).push(item);
  }
  
  return [truthy, falsy];
};


// ─────────────────────────────────────────────────────────────
// Object Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Deep clone
 */
export const deepClone = (obj) => 
  JSON.parse(JSON.stringify(obj));

/**
 * Deep merge
 */
export const deepMerge = (target, ...sources) => {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
};

const isObject = (item) => 
  item && typeof item === 'object' && !Array.isArray(item);

/**
 * Pick keys from object
 */
export const pick = (obj, keys) => 
  keys.reduce((acc, key) => {
    if (key in obj) acc[key] = obj[key];
    return acc;
  }, {});

/**
 * Omit keys from object
 */
export const omit = (obj, keys) => {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
};


// ─────────────────────────────────────────────────────────────
// Debug Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Create a debug logger
 */
export const createLogger = (namespace, enabled = true) => {
  const log = (...args) => {
    if (enabled) {
      console.log(`[${namespace}]`, ...args);
    }
  };
  
  log.error = (...args) => console.error(`[${namespace}:error]`, ...args);
  log.warn = (...args) => console.warn(`[${namespace}:warn]`, ...args);
  log.info = (...args) => enabled && console.info(`[${namespace}:info]`, ...args);
  log.debug = (...args) => enabled && console.debug(`[${namespace}:debug]`, ...args);
  
  return log;
};

/**
 * Measure execution time
 */
export const measure = async (label, fn) => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  console.log(`[${label}] ${(end - start).toFixed(2)}ms`);
  return result;
};

/**
 * Assert condition
 */
export const assert = (condition, message = 'Assertion failed') => {
  if (!condition) {
    throw new Error(message);
  }
};
