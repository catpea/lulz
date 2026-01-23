/**
 * lulz - A reactive dataflow system that makes coders happy
 * 
 * https://github.com/catpea/lulz
 * 
 * @example
 * import { flow, inject, debug, series, parallel } from 'lulz';
 * 
 * const app = flow([
 *   [inject({ payload: 'Hello!' }), debug({ name: 'out' })],
 * ]);
 * 
 * app.start();
 */

// ─────────────────────────────────────────────────────────────
// Core Flow Engine
// ─────────────────────────────────────────────────────────────

export {
  flow,
  subflow,
  compose,
  parallel,
  series,
  makeNode,
  isOuter,
  isInner,
  isFlow,
} from './src/flow.js';


// ─────────────────────────────────────────────────────────────
// Node-RED Style Library
// ─────────────────────────────────────────────────────────────

export {
  // Core nodes
  inject,
  debug,
  func,
  change,
  switchNode as switch,  // 'switch' is reserved, use switchNode
  switchNode,
  template,
  delay,
  split,
  join,
  filter,
  linkIn,
  linkOut,
  catchError,
  status,
  
  // Property helpers
  getProperty,
  setProperty,
  deleteProperty,
} from './src/red-lib.js';


// ─────────────────────────────────────────────────────────────
// RxJS-Inspired Operators
// ─────────────────────────────────────────────────────────────

export {
  // Combination
  combineLatest,
  merge,
  concat,
  zip,
  withLatestFrom,
  
  // Transformation
  map,
  pluck,
  scan,
  buffer,
  window,
  pairwise,
  
  // Filtering
  filter as rxFilter,
  distinct,
  distinctUntilChanged,
  take,
  skip,
  takeWhile,
  skipWhile,
  
  // Timing
  debounce,
  throttle,
  delay as rxDelay,
  timeout,
  timestamp,
  
  // Error handling
  catchError as rxCatchError,
  retry,
  
  // Utility
  tap,
  log,
  count,
  toArray,
  defaultIfEmpty,
  share,
} from './src/rx-lib.js';


// ─────────────────────────────────────────────────────────────
// Worker Task Queue
// ─────────────────────────────────────────────────────────────

export {
  taskQueue,
  worker,
  parallelMap,
  cpuTask,
} from './src/workers.js';


// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

export {
  // Packet helpers
  packet,
  clonePacket,
  mergePackets,
  
  // Function composition
  pipe,
  compose as composeF,
  identity,
  constant,
  noop,
  
  // Async helpers
  sleep,
  withTimeout,
  withRetry,
  
  // Collection helpers
  chunk,
  flatten,
  unique,
  groupBy,
  partition,
  
  // Object helpers
  deepClone,
  deepMerge,
  pick,
  omit,
  
  // Debug helpers
  createLogger,
  measure,
  assert,
} from './src/utils.js';


// ─────────────────────────────────────────────────────────────
// Default Export
// ─────────────────────────────────────────────────────────────

import { flow as flowFn } from './src/flow.js';
export default flowFn;
