/**
 * lulz - Worker Queue Examples
 * 
 * Demonstrates:
 *   - taskQueue: Standalone task queue with worker pool
 *   - worker: Flow-integrated worker node
 *   - parallelMap: Parallel array processing
 *   - cpuTask: Quick wrapper for CPU-bound functions
 */

import { 
  flow, 
  inject, 
  debug, 
  func,
  map,
  split,
  taskQueue, 
  worker, 
  parallelMap, 
  cpuTask 
} from './index.js';

import { cpus } from 'os';

console.log(`\n🖥️  System has ${cpus().length} CPU cores\n`);


// ═══════════════════════════════════════════════════════════════
// Example 1: Basic taskQueue
// ═══════════════════════════════════════════════════════════════

console.log('═══ Example 1: Basic taskQueue ═══\n');

// Create a queue with a simple handler
const queue1 = taskQueue({
  workers: 2,
  handler: (data) => {
    // Simulate CPU work
    let result = 0;
    for (let i = 0; i < 1_000_000; i++) {
      result += Math.sqrt(i);
    }
    return { input: data, computed: Math.round(result) };
  }
});

// Listen for results
queue1.on('result', ({ id, result }) => {
  console.log(`[Queue1] Task ${id} completed:`, result);
});

queue1.on('error', ({ id, error }) => {
  console.error(`[Queue1] Task ${id} failed:`, error);
});

queue1.on('drain', () => {
  console.log('[Queue1] All tasks completed!\n');
});

// Submit tasks
console.log('[Queue1] Submitting 5 tasks...');
for (let i = 1; i <= 5; i++) {
  queue1.submit({ id: i, data: i * 10 });
}


// ═══════════════════════════════════════════════════════════════
// Example 2: taskQueue with async handler
// ═══════════════════════════════════════════════════════════════

setTimeout(() => {
  console.log('═══ Example 2: Async Handler ═══\n');

  const queue2 = taskQueue({
    workers: 3,
    handler: async (data) => {
      // Simulate async work (API call, file I/O, etc.)
      await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
      return `Processed: ${data.toUpperCase()}`;
    }
  });

  const results = [];
  
  queue2.on('result', ({ id, result }) => {
    results.push(result);
    console.log(`[Queue2] Task ${id}: ${result}`);
  });

  queue2.on('drain', () => {
    console.log(`[Queue2] All done! Results:`, results);
    console.log();
  });

  // Submit multiple tasks
  ['apple', 'banana', 'cherry', 'date', 'elderberry'].forEach((fruit, i) => {
    queue2.submit({ id: i + 1, data: fruit });
  });

}, 1500);


// ═══════════════════════════════════════════════════════════════
// Example 3: taskQueue statistics and control
// ═══════════════════════════════════════════════════════════════

setTimeout(() => {
  console.log('═══ Example 3: Queue Statistics ═══\n');

  const queue3 = taskQueue({
    workers: 2,
    handler: async (data) => {
      await new Promise(r => setTimeout(r, 150));
      return data * 2;
    }
  });

  queue3.on('result', ({ id, result }) => {
    console.log(`[Queue3] Task ${id} = ${result}`);
    console.log(`[Queue3] Stats:`, queue3.stats());
  });

  // Submit tasks and check stats
  console.log('[Queue3] Initial stats:', queue3.stats());
  
  queue3.submitAll([
    { id: 'a', data: 10 },
    { id: 'b', data: 20 },
    { id: 'c', data: 30 },
    { id: 'd', data: 40 },
  ]);

  console.log('[Queue3] After submit:', queue3.stats());

  // Wait for completion
  queue3.drain().then(() => {
    console.log('[Queue3] Final stats:', queue3.stats());
    console.log();
  });

}, 3000);


// ═══════════════════════════════════════════════════════════════
// Example 4: worker() in a flow
// ═══════════════════════════════════════════════════════════════

setTimeout(() => {
  console.log('═══ Example 4: worker() in Flow ═══\n');

  // Heavy computation that runs in worker thread
  const heavyComputation = (n) => {
    let result = 0;
    for (let i = 0; i < n * 100000; i++) {
      result += Math.sin(i) * Math.cos(i);
    }
    return Math.round(result * 1000) / 1000;
  };

  const app = flow([
    // Input numbers
    ['numbers', 
      // Process in worker threads (doesn't block main thread!)
      worker({ 
        workers: 2, 
        handler: heavyComputation 
      }), 
      'computed'
    ],
    
    // Log results
    ['computed', debug({ name: 'result', complete: true })],
  ]);

  // Inject numbers to process
  console.log('[Worker Flow] Processing numbers in parallel workers...');
  [10, 20, 30, 40, 50].forEach((n, i) => {
    setTimeout(() => {
      console.log(`[Worker Flow] Submitting: ${n}`);
      app.emit('numbers', { payload: n, id: i });
    }, i * 100);
  });

}, 5000);


// ═══════════════════════════════════════════════════════════════
// Example 5: parallelMap for batch processing
// ═══════════════════════════════════════════════════════════════

setTimeout(() => {
  console.log('\n═══ Example 5: parallelMap ═══\n');

  // Process entire arrays in parallel
  const batchProcessor = flow([
    ['batch',
      parallelMap({
        workers: 4,
        fn: (item) => {
          // Each item processed in its own worker
          return {
            original: item,
            squared: item * item,
            sqrt: Math.sqrt(item),
          };
        }
      }),
      'processed'
    ],
    
    ['processed', debug({ name: 'batch-result', complete: true })],
  ]);

  console.log('[parallelMap] Processing array [1, 4, 9, 16, 25]...');
  batchProcessor.emit('batch', { payload: [1, 4, 9, 16, 25] });

}, 7500);


// ═══════════════════════════════════════════════════════════════
// Example 6: cpuTask shorthand
// ═══════════════════════════════════════════════════════════════

setTimeout(() => {
  console.log('\n═══ Example 6: cpuTask Shorthand ═══\n');

  // cpuTask is a quick way to wrap CPU-intensive functions
  const fibonacci = (n) => {
    if (n <= 1) return n;
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  };

  const app = flow([
    ['input',
      cpuTask(fibonacci),  // Runs in worker thread
      debug({ name: 'fibonacci' })
    ],
  ]);

  console.log('[cpuTask] Computing Fibonacci numbers...');
  [10, 20, 30, 40, 45].forEach((n, i) => {
    setTimeout(() => {
      console.log(`[cpuTask] fib(${n}) = ...`);
      app.emit('input', { payload: n });
    }, i * 200);
  });

}, 9000);


// ═══════════════════════════════════════════════════════════════
// Example 7: Real-world pattern - Image Processing Pipeline
// ═══════════════════════════════════════════════════════════════

setTimeout(() => {
  console.log('\n═══ Example 7: Image Processing Pipeline ═══\n');

  // Simulated image processing functions
  const processImage = (img) => {
    // Simulate resize
    const resized = { ...img, width: 800, height: 600 };
    // Simulate compress
    const compressed = { ...resized, size: Math.round(img.size * 0.3) };
    // Simulate watermark
    const final = { ...compressed, watermark: true };
    return final;
  };

  const imageProcessor = flow([
    // Images come in
    ['upload', func({ func: (msg) => {
      console.log(`[Image] Uploading: ${msg.payload.name} (${msg.payload.size} bytes)`);
      return msg;
    }}), 'image'],

    // Process in parallel workers
    ['image',
      worker({
        workers: 2,
        handler: processImage
      }),
      'processed'
    ],

    // Save results
    ['processed', 
      func({ func: (msg) => {
        const p = msg.payload;
        console.log(`[Image] Done: ${p.name} → ${p.width}x${p.height}, ${p.size} bytes, watermark: ${p.watermark}`);
        return msg;
      }}),
      'saved'
    ],
  ]);

  // Simulate image uploads
  const images = [
    { name: 'photo1.jpg', size: 5000000, width: 4000, height: 3000 },
    { name: 'photo2.jpg', size: 3500000, width: 3000, height: 2000 },
    { name: 'photo3.jpg', size: 8000000, width: 6000, height: 4000 },
  ];

  images.forEach((img, i) => {
    setTimeout(() => {
      imageProcessor.emit('upload', { payload: img });
    }, i * 300);
  });

}, 11000);


// ═══════════════════════════════════════════════════════════════
// Example 8: Error handling in workers
// ═══════════════════════════════════════════════════════════════

setTimeout(() => {
  console.log('\n═══ Example 8: Error Handling ═══\n');

  const riskyQueue = taskQueue({
    workers: 2,
    handler: (data) => {
      if (data < 0) {
        throw new Error(`Negative numbers not allowed: ${data}`);
      }
      return Math.sqrt(data);
    }
  });

  riskyQueue.on('result', ({ id, result }) => {
    console.log(`[Risky] Task ${id} succeeded: √${id} = ${result}`);
  });

  riskyQueue.on('error', ({ id, error }) => {
    console.log(`[Risky] Task ${id} FAILED: ${error}`);
  });

  riskyQueue.on('drain', () => {
    console.log('[Risky] Queue drained (some may have failed)\n');
  });

  // Submit mix of valid and invalid
  [4, 9, -1, 16, -25, 36].forEach((n, i) => {
    riskyQueue.submit({ id: n, data: n });
  });

}, 13000);


// ═══════════════════════════════════════════════════════════════
// Example 9: Combining with RxJS-style operators
// ═══════════════════════════════════════════════════════════════

setTimeout(() => {
  console.log('\n═══ Example 9: Workers + Rx Operators ═══\n');

  const dataProcessor = flow([
    // Split array into individual items
    ['data', split(), 'item'],
    
    // Process each item in worker
    ['item',
      map({ fn: (x) => x * 2 }),  // Quick transform in main thread
      worker({                     // Heavy work in worker
        workers: 2,
        handler: (n) => {
          let sum = 0;
          for (let i = 0; i < n * 10000; i++) sum += Math.random();
          return { n, sum: Math.round(sum) };
        }
      }),
      'processed'
    ],

    ['processed', debug({ name: 'processed' })],
  ]);

  console.log('[Rx+Workers] Processing [5, 10, 15, 20, 25]...');
  dataProcessor.emit('data', { payload: [5, 10, 15, 20, 25] });

}, 15000);


// ═══════════════════════════════════════════════════════════════
// Cleanup and summary
// ═══════════════════════════════════════════════════════════════

setTimeout(() => {
  console.log('\n═══ Summary ═══\n');
  console.log('Worker utilities in lulz:');
  console.log('');
  console.log('  taskQueue({ workers, handler })');
  console.log('    → Standalone EventEmitter-based task queue');
  console.log('    → .submit(task), .submitAll(tasks), .drain()');
  console.log('    → Events: result, error, drain, idle');
  console.log('');
  console.log('  worker({ workers, handler })');
  console.log('    → Flow node that processes packets in workers');
  console.log('    → Non-blocking, preserves packet metadata');
  console.log('');
  console.log('  parallelMap({ workers, fn })');
  console.log('    → Process arrays with parallel workers');
  console.log('    → Preserves order, emits complete array');
  console.log('');
  console.log('  cpuTask(fn)');
  console.log('    → Quick wrapper: cpuTask(x => x*x)');
  console.log('    → Shorthand for worker({ handler: fn })');
  console.log('');
  console.log('═══ All Examples Complete ═══\n');

  // Terminate queues
  queue1.terminate();
  
  process.exit(0);
}, 18000);
