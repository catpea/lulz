/**
 * lulz - Node-RED Style Library
 * 
 * Core nodes inspired by Node-RED.
 * 
 * Naming Convention:
 *   - Factory functions: lowercase (e.g., delay, inject, debug)
 *   - Called with options: delay({ delay: 1000 })
 *   - Called without: delay → uses sane defaults or warns
 */


// ─────────────────────────────────────────────────────────────
// Property Helpers
// ─────────────────────────────────────────────────────────────

export const getProperty = (obj, path) => {
  if (!path) return obj;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
};

export const setProperty = (obj, path, value) => {
  if (!path) return;
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined) current[part] = {};
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
};

export const deleteProperty = (obj, path) => {
  if (!path) return;
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined) return;
    current = current[part];
  }
  delete current[parts[parts.length - 1]];
};


// ─────────────────────────────────────────────────────────────
// Inject - Produces packets
// ─────────────────────────────────────────────────────────────

/**
 * Inject node - Produces packets on schedule or trigger
 * 
 * @param {Object} options
 * @param {*} options.payload - Value to inject (or function for dynamic)
 * @param {string} options.topic - Message topic
 * @param {number} options.interval - Repeat interval in ms
 * @param {boolean} options.once - Inject once on start (default: true)
 * @param {number} options.onceDelay - Delay before first inject
 */
export function inject(options = {}) {
  const {
    payload = () => Date.now(),
    topic = '',
    interval = null,
    once = true,
    onceDelay = 0,
  } = options;

  return (send) => {
    const timers = [];

    const emit = () => {
      const value = typeof payload === 'function' ? payload() : payload;
      send({ payload: value, topic });
    };

    if (once) {
      if (onceDelay > 0) {
        timers.push(setTimeout(emit, onceDelay));
      } else {
        setImmediate(emit);
      }
    }

    if (interval && interval > 0) {
      timers.push(setInterval(emit, interval));
    }

    // Cleanup function
    return () => {
      for (const t of timers) {
        clearTimeout(t);
        clearInterval(t);
      }
    };
  };
}


// ─────────────────────────────────────────────────────────────
// Debug - Logs packets
// ─────────────────────────────────────────────────────────────

/**
 * Debug node - Logs packets to console
 * 
 * @param {Object} options
 * @param {string} options.name - Label for output
 * @param {boolean} options.active - Whether to output (default: true)
 * @param {boolean} options.complete - Show complete msg (default: false)
 * @param {Function} options.logger - Custom logger (default: console.log)
 */
export function debug(options = {}) {
  const {
    name = 'debug',
    active = true,
    complete = false,
    logger = console.log,
  } = options;

  return (send, packet) => {
    if (active) {
      const output = complete ? packet : packet?.payload;
      logger(`[${name}]`, output);
    }
    send(packet);
  };
}


// ─────────────────────────────────────────────────────────────
// Function - Execute custom code
// ─────────────────────────────────────────────────────────────

/**
 * Function node - Execute custom JavaScript
 * 
 * @param {Object} options
 * @param {Function} options.func - Function(msg, context) → msg
 * @param {Function} options.initialize - Setup function
 * @param {Function} options.finalize - Cleanup function
 */
export function func(options = {}) {
  const {
    func: fn = (msg) => msg,
    initialize = null,
    finalize = null,
  } = options;

  // Context storage
  const nodeContext = {};
  const flowContext = {};
  const globalContext = {};

  if (initialize) {
    initialize({ global: globalContext, flow: flowContext, node: nodeContext });
  }

  return (send, packet) => {
    const context = {
      global: globalContext,
      flow: flowContext,
      node: nodeContext,
    };

    try {
      const result = fn(packet, context);
      
      if (result === null || result === undefined) {
        return; // Drop message
      }

      if (Array.isArray(result)) {
        for (const msg of result) {
          if (msg !== null && msg !== undefined) {
            send(msg);
          }
        }
      } else {
        send(result);
      }
    } catch (err) {
      console.error('[func] Error:', err);
      send({ ...packet, error: err.message });
    }
  };
}


// ─────────────────────────────────────────────────────────────
// Change - Modify message properties
// ─────────────────────────────────────────────────────────────

/**
 * Change node - Set, change, delete, or move message properties
 * 
 * @param {Object} options
 * @param {Array} options.rules - Array of transformation rules
 * 
 * Rule types:
 *   { type: 'set', prop: 'payload', to: value }
 *   { type: 'change', prop: 'payload', from: /regex/, to: 'replacement' }
 *   { type: 'delete', prop: 'payload' }
 *   { type: 'move', prop: 'payload', to: 'newProp' }
 */
export function change(options = {}) {
  const { rules = [] } = options;

  if (rules.length === 0) {
    console.warn('[change] No rules configured - pass-through mode');
  }

  return (send, packet) => {
    let msg = { ...packet };

    for (const rule of rules) {
      const { type, prop, to, from } = rule;

      switch (type) {
        case 'set':
          setProperty(msg, prop, typeof to === 'function' ? to(msg) : to);
          break;

        case 'change':
          const current = getProperty(msg, prop);
          if (typeof current === 'string') {
            setProperty(msg, prop, current.replace(from, to));
          }
          break;

        case 'delete':
          deleteProperty(msg, prop);
          break;

        case 'move':
          const value = getProperty(msg, prop);
          deleteProperty(msg, prop);
          setProperty(msg, to, value);
          break;
      }
    }

    send(msg);
  };
}


// ─────────────────────────────────────────────────────────────
// Switch - Route messages
// ─────────────────────────────────────────────────────────────

/**
 * Switch node - Route messages based on conditions
 * 
 * @param {Object} options
 * @param {string} options.property - Property to test (default: 'payload')
 * @param {Array} options.rules - Array of test rules
 * @param {boolean} options.checkall - Check all rules (default: false)
 * 
 * Rule types: eq, neq, lt, gt, lte, gte, regex, true, false, null, nnull, else
 */
export function switchNode(options = {}) {
  const {
    property = 'payload',
    rules = [],
    checkall = false,
  } = options;

  if (rules.length === 0) {
    console.warn('[switch] No rules configured - pass-through mode');
  }

  return (send, packet) => {
    const value = getProperty(packet, property);
    let matched = false;

    for (const rule of rules) {
      let isMatch = false;

      switch (rule.type) {
        case 'eq':    isMatch = value === rule.value; break;
        case 'neq':   isMatch = value !== rule.value; break;
        case 'lt':    isMatch = value < rule.value; break;
        case 'gt':    isMatch = value > rule.value; break;
        case 'lte':   isMatch = value <= rule.value; break;
        case 'gte':   isMatch = value >= rule.value; break;
        case 'regex': isMatch = rule.value.test(String(value)); break;
        case 'true':  isMatch = value === true; break;
        case 'false': isMatch = value === false; break;
        case 'null':  isMatch = value === null || value === undefined; break;
        case 'nnull': isMatch = value !== null && value !== undefined; break;
        case 'else':  isMatch = !matched; break;
      }

      if (isMatch) {
        matched = true;
        send(rule.send !== undefined 
          ? (typeof rule.send === 'function' ? rule.send(packet) : { ...packet, ...rule.send })
          : packet
        );
        if (!checkall) break;
      }
    }
  };
}


// ─────────────────────────────────────────────────────────────
// Template - Render templates
// ─────────────────────────────────────────────────────────────

/**
 * Template node - Render mustache-style templates
 * 
 * @param {Object} options
 * @param {string} options.template - Template string with {{placeholders}}
 * @param {string} options.field - Output field (default: 'payload')
 */
export function template(options = {}) {
  const {
    template: tmpl = '{{payload}}',
    field = 'payload',
  } = options;

  return (send, packet) => {
    const output = tmpl.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = getProperty(packet, path.trim());
      return value !== undefined ? String(value) : '';
    });

    const result = { ...packet };
    setProperty(result, field, output);
    send(result);
  };
}


// ─────────────────────────────────────────────────────────────
// Delay - Delay or rate-limit
// ─────────────────────────────────────────────────────────────

/**
 * Delay node - Delay or rate-limit messages
 * 
 * @param {Object} options
 * @param {number} options.delay - Delay in ms (default: 1000)
 * @param {number} options.rate - Rate limit (msgs/sec)
 * @param {boolean} options.drop - Drop when rate limited (default: false)
 */
export function delay(options = {}) {
  const {
    delay: delayMs = 1000,
    rate = null,
    drop = false,
  } = options;

  const queue = [];
  let processing = false;

  return (send, packet) => {
    if (rate) {
      const interval = 1000 / rate;
      
      if (drop && processing) return;

      queue.push(packet);
      
      if (!processing) {
        processing = true;
        
        const processQueue = () => {
          if (queue.length > 0) {
            send(queue.shift());
            setTimeout(processQueue, interval);
          } else {
            processing = false;
          }
        };
        
        processQueue();
      }
    } else {
      setTimeout(() => send(packet), delayMs);
    }
  };
}


// ─────────────────────────────────────────────────────────────
// Split - Split messages
// ─────────────────────────────────────────────────────────────

/**
 * Split node - Split arrays/strings into sequences
 * 
 * @param {Object} options
 * @param {string} options.property - Property to split (default: 'payload')
 * @param {string} options.delimiter - Delimiter for strings
 */
export function split(options = {}) {
  const {
    property = 'payload',
    delimiter = null,
  } = options;

  return (send, packet) => {
    const value = getProperty(packet, property);

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        send({
          ...packet,
          payload: item,
          parts: { index, count: value.length }
        });
      });
    } else if (typeof value === 'string' && delimiter) {
      const parts = value.split(delimiter);
      parts.forEach((item, index) => {
        send({
          ...packet,
          payload: item,
          parts: { index, count: parts.length }
        });
      });
    } else {
      send(packet);
    }
  };
}


// ─────────────────────────────────────────────────────────────
// Join - Join messages
// ─────────────────────────────────────────────────────────────

/**
 * Join node - Join sequences of messages
 * 
 * @param {Object} options
 * @param {number} options.count - Number of messages to join
 * @param {string} options.property - Property to join (default: 'payload')
 * @param {Function} options.reducer - Custom reducer function
 * @param {*} options.initial - Initial value
 */
export function join(options = {}) {
  const {
    count = 0,
    property = 'payload',
    reducer = null,
    initial = [],
  } = options;

  let buffer = Array.isArray(initial) ? [...initial] : initial;
  let msgCount = 0;

  if (count === 0) {
    console.warn('[join] count=0 - messages will accumulate but never emit');
  }

  return (send, packet) => {
    const value = getProperty(packet, property);

    if (reducer) {
      buffer = reducer(buffer, packet);
    } else if (Array.isArray(buffer)) {
      buffer.push(value);
    }

    msgCount++;

    if (count > 0 && msgCount >= count) {
      send({ payload: buffer });
      buffer = Array.isArray(initial) ? [...initial] : initial;
      msgCount = 0;
    }
  };
}


// ─────────────────────────────────────────────────────────────
// Filter - Filter messages
// ─────────────────────────────────────────────────────────────

/**
 * Filter node - Filter messages based on condition
 * 
 * @param {Object} options
 * @param {Function} options.condition - Function(msg) → boolean
 */
export function filter(options = {}) {
  const { condition = () => true } = options;

  return (send, packet) => {
    if (condition(packet)) {
      send(packet);
    }
  };
}


// ─────────────────────────────────────────────────────────────
// Link - Named links for connecting flows
// ─────────────────────────────────────────────────────────────

const linkRegistry = new Map();

/**
 * Link Out - Send to named link
 */
export function linkOut(options = {}) {
  const { name = '' } = options;

  if (!name) {
    console.warn('[linkOut] No name configured');
  }

  return (send, packet) => {
    const handlers = linkRegistry.get(name) || [];
    for (const handler of handlers) {
      handler(packet);
    }
    send(packet);
  };
}

/**
 * Link In - Receive from named link
 */
export function linkIn(options = {}) {
  const { name = '' } = options;

  if (!name) {
    console.warn('[linkIn] No name configured');
  }

  return (send) => {
    const handlers = linkRegistry.get(name) || [];
    handlers.push(send);
    linkRegistry.set(name, handlers);

    return () => {
      const h = linkRegistry.get(name) || [];
      linkRegistry.set(name, h.filter(x => x !== send));
    };
  };
}


// ─────────────────────────────────────────────────────────────
// Catch - Error handling
// ─────────────────────────────────────────────────────────────

/**
 * Catch node - Catches errors from other nodes
 */
export function catchError(options = {}) {
  const { scope = 'all' } = options;

  return (send, packet) => {
    if (packet.error) {
      send(packet);
    }
  };
}


// ─────────────────────────────────────────────────────────────
// Status - Status reporting
// ─────────────────────────────────────────────────────────────

/**
 * Status node - Reports node status
 */
export function status(options = {}) {
  const { 
    fill = 'green',   // 'red', 'green', 'yellow', 'blue', 'grey'
    shape = 'dot',    // 'ring', 'dot'
    text = ''
  } = options;

  return (send, packet) => {
    send({
      ...packet,
      status: { fill, shape, text: typeof text === 'function' ? text(packet) : text }
    });
  };
}
