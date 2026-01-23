/**
 * lulz - Worker Task Queue
 * 
 * EventEmitter-wrapped task queue using:
 *   - Worker Threads (Node.js)
 *   - Web Workers (browsers)
 * 
 * Default worker count: os.cpus().length
 */

import { EventEmitter } from 'events';
import { cpus } from 'os';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';


// ─────────────────────────────────────────────────────────────
// Task Queue
// ─────────────────────────────────────────────────────────────

/**
 * Create a task queue with worker pool
 * 
 * @param {Object} options
 * @param {number} options.workers - Number of workers (default: CPU count)
 * @param {string} options.workerScript - Path to worker script
 * @param {Function} options.handler - Task handler for inline workers
 * 
 * @returns {EventEmitter} Queue with submit/on API
 * 
 * Events:
 *   - 'result' - Task completed { id, result }
 *   - 'error' - Task failed { id, error }
 *   - 'drain' - All tasks completed
 *   - 'idle' - Workers are idle
 * 
 * Usage:
 *   const queue = taskQueue({ workers: 4, handler: (data) => data * 2 });
 *   queue.on('result', ({ id, result }) => console.log(result));
 *   queue.submit({ id: 1, data: 42 });
 */
export function taskQueue(options = {}) {
  const {
    workers: workerCount = cpus().length,
    workerScript = null,
    handler = null,
  } = options;

  const queue = new EventEmitter();
  const pending = [];           // Tasks waiting for a worker
  const running = new Map();    // taskId → worker
  const pool = [];              // Available workers
  let taskIdCounter = 0;
  let totalSubmitted = 0;
  let totalCompleted = 0;

  // ─── Worker Management ───

  const createWorker = () => {
    let worker;

    if (workerScript) {
      // External script
      worker = new Worker(workerScript);
    } else if (handler) {
      // Inline handler - create worker with eval
      const handlerStr = handler.toString();
      const code = `
        const { parentPort } = require('worker_threads');
        const handler = ${handlerStr};
        parentPort.on('message', async (task) => {
          try {
            const result = await handler(task.data);
            parentPort.postMessage({ id: task.id, result });
          } catch (error) {
            parentPort.postMessage({ id: task.id, error: error.message });
          }
        });
      `;
      worker = new Worker(code, { eval: true });
    } else {
      throw new Error('taskQueue requires either workerScript or handler');
    }

    worker._busy = false;

    worker.on('message', (msg) => {
      worker._busy = false;
      running.delete(msg.id);
      totalCompleted++;

      if (msg.error) {
        queue.emit('error', { id: msg.id, error: msg.error });
      } else {
        queue.emit('result', { id: msg.id, result: msg.result });
      }

      // Process next task
      if (pending.length > 0) {
        processNext(worker);
      } else {
        pool.push(worker);
        
        if (totalCompleted === totalSubmitted) {
          queue.emit('drain');
        }
        
        if (pool.length === workerCount) {
          queue.emit('idle');
        }
      }
    });

    worker.on('error', (err) => {
      console.error('[taskQueue] Worker error:', err);
      // Replace crashed worker
      const idx = pool.indexOf(worker);
      if (idx > -1) pool.splice(idx, 1);
      pool.push(createWorker());
    });

    return worker;
  };

  // Initialize worker pool
  for (let i = 0; i < workerCount; i++) {
    pool.push(createWorker());
  }

  // ─── Task Processing ───

  const processNext = (worker) => {
    if (pending.length === 0) return;

    const task = pending.shift();
    worker._busy = true;
    running.set(task.id, worker);
    worker.postMessage(task);
  };

  const tryProcess = () => {
    while (pending.length > 0 && pool.length > 0) {
      const worker = pool.pop();
      processNext(worker);
    }
  };

  // ─── API ───

  /**
   * Submit a task to the queue
   * @param {Object} task - Task object with data property
   * @returns {number} Task ID
   */
  queue.submit = (task) => {
    const id = task.id ?? ++taskIdCounter;
    const taskObj = { id, data: task.data ?? task };
    
    totalSubmitted++;
    pending.push(taskObj);
    tryProcess();
    
    return id;
  };

  /**
   * Submit multiple tasks
   * @param {Array} tasks - Array of tasks
   * @returns {number[]} Task IDs
   */
  queue.submitAll = (tasks) => {
    return tasks.map(t => queue.submit(t));
  };

  /**
   * Get queue statistics
   */
  queue.stats = () => ({
    pending: pending.length,
    running: running.size,
    available: pool.length,
    totalSubmitted,
    totalCompleted,
  });

  /**
   * Terminate all workers
   */
  queue.terminate = async () => {
    const terminatePromises = [];
    
    for (const worker of pool) {
      terminatePromises.push(worker.terminate());
    }
    
    for (const worker of running.values()) {
      terminatePromises.push(worker.terminate());
    }
    
    await Promise.all(terminatePromises);
    pool.length = 0;
    running.clear();
    pending.length = 0;
    
    queue.emit('terminated');
  };

  /**
   * Wait for all tasks to complete
   */
  queue.drain = () => {
    return new Promise((resolve) => {
      if (totalCompleted === totalSubmitted && pending.length === 0) {
        resolve();
      } else {
        queue.once('drain', resolve);
      }
    });
  };

  return queue;
}


// ─────────────────────────────────────────────────────────────
// Worker Node for Flow Integration
// ─────────────────────────────────────────────────────────────

/**
 * Worker node - Process packets in worker threads
 * 
 * @param {Object} options
 * @param {number} options.workers - Worker count
 * @param {Function} options.handler - Processing function
 * 
 * Usage in flow:
 *   ['input', worker({ workers: 4, handler: (data) => heavyComputation(data) }), 'output']
 */
export function worker(options = {}) {
  const {
    workers: workerCount = cpus().length,
    handler = (data) => data,
  } = options;

  // Create dedicated queue for this node
  let queue = null;
  const pendingCallbacks = new Map();

  return (send, packet) => {
    // Lazy initialization
    if (!queue) {
      queue = taskQueue({ workers: workerCount, handler });
      
      queue.on('result', ({ id, result }) => {
        const original = pendingCallbacks.get(id);
        pendingCallbacks.delete(id);
        
        if (original) {
          send({ ...original, payload: result });
        }
      });
      
      queue.on('error', ({ id, error }) => {
        const original = pendingCallbacks.get(id);
        pendingCallbacks.delete(id);
        
        if (original) {
          send({ ...original, error });
        }
      });
    }

    const taskId = queue.submit({ data: packet.payload ?? packet });
    pendingCallbacks.set(taskId, packet);
  };
}


// ─────────────────────────────────────────────────────────────
// Parallel Map - Map with worker pool
// ─────────────────────────────────────────────────────────────

/**
 * parallelMap - Process items in parallel using workers
 * 
 * @param {Object} options
 * @param {Function} options.fn - Mapping function
 * @param {number} options.workers - Worker count
 * @param {number} options.batchSize - Items per batch
 */
export function parallelMap(options = {}) {
  const {
    fn = (x) => x,
    workers: workerCount = cpus().length,
    batchSize = 1,
  } = options;

  let queue = null;
  const results = new Map();
  let expectedCount = 0;

  return (send, packet) => {
    if (!queue) {
      queue = taskQueue({ workers: workerCount, handler: fn });
    }

    const items = Array.isArray(packet.payload) ? packet.payload : [packet.payload];
    expectedCount = items.length;
    results.clear();

    const handleResult = ({ id, result }) => {
      results.set(id, result);
      
      if (results.size === expectedCount) {
        // Preserve order
        const ordered = items.map((_, i) => results.get(i + 1));
        send({ ...packet, payload: ordered });
      }
    };

    queue.on('result', handleResult);

    items.forEach((item, i) => {
      queue.submit({ id: i + 1, data: item });
    });
  };
}


// ─────────────────────────────────────────────────────────────
// CPU-bound Task Helper
// ─────────────────────────────────────────────────────────────

/**
 * cpuTask - Wrap a CPU-bound function for worker execution
 * 
 * @param {Function} fn - CPU-bound function
 * @returns {Function} Worker-enabled function
 */
export function cpuTask(fn) {
  return worker({ handler: fn });
}


// ─────────────────────────────────────────────────────────────
// Export for Worker Script Usage
// ─────────────────────────────────────────────────────────────

// If this module is loaded in a worker thread
if (!isMainThread && parentPort) {
  // This allows the module to be used as a worker script
  // Usage: new Worker('./workers.js', { workerData: { handler: ... } })
  
  if (workerData?.handler) {
    const handler = new Function('return ' + workerData.handler)();
    
    parentPort.on('message', async (task) => {
      try {
        const result = await handler(task.data);
        parentPort.postMessage({ id: task.id, result });
      } catch (error) {
        parentPort.postMessage({ id: task.id, error: error.message });
      }
    });
  }
}
