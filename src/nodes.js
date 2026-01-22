/**
 * Node-RED style core nodes
 * 
 * Each node is an "outer" function that takes options and returns
 * an "inner" arrow function that processes packets.
 * 
 * Inner function signature: (send, packet) => { ... }
 * - send: function to emit packet to next node
 * - packet: incoming data (called 'msg' in Node-RED)
 */

/**
 * Inject node - Produces packets on a schedule or trigger
 * 
 * Options:
 *   - payload: value to inject (default: timestamp)
 *   - topic: message topic
 *   - interval: repeat interval in ms (optional)
 *   - once: inject once on start (default: true)
 *   - onceDelay: delay before first inject in ms (default: 0)
 */
function Inject(options = {}) {
  const {
    payload = () => Date.now(),
    topic = '',
    interval = null,
    once = true,
    onceDelay = 0,
  } = options;

  // Return producer function (only takes send, no packet)
  return (send) => {
    const timers = [];

    function emit() {
      const value = typeof payload === 'function' ? payload() : payload;
      send({ payload: value, topic });
    }

    if (once) {
      if (onceDelay > 0) {
        timers.push(setTimeout(emit, onceDelay));
      } else {
        // Use setImmediate to ensure flow is fully constructed
        setImmediate(emit);
      }
    }

    if (interval && interval > 0) {
      timers.push(setInterval(emit, interval));
    }

    // Return cleanup function
    return () => {
      for (const t of timers) {
        clearTimeout(t);
        clearInterval(t);
      }
    };
  };
}

/**
 * Debug node - Logs packets to console
 * 
 * Options:
 *   - name: label for output
 *   - active: whether to output (default: true)
 *   - complete: show complete msg object (default: false, shows payload only)
 *   - console: output to console (default: true)
 *   - sidebar: would output to sidebar in Node-RED (not implemented)
 *   - logger: custom logger function (default: console.log)
 */
function Debug(options = {}) {
  const {
    name = 'debug',
    active = true,
    complete = false,
    console: useConsole = true,
    logger = console.log,
  } = options;

  return (send, packet) => {
    if (active && useConsole) {
      const output = complete ? packet : packet?.payload;
      logger(`[${name}]`, output);
    }
    send(packet);
  };
}

/**
 * Function node - Execute custom JavaScript
 * 
 * Options:
 *   - func: function(msg, context) that returns msg or array of msgs
 *   - outputs: number of outputs (default: 1)
 *   - initialize: setup function called once
 *   - finalize: cleanup function
 * 
 * The func receives:
 *   - msg: the incoming packet
 *   - context: { global, flow, node } storage objects
 */
function Function(options = {}) {
  const {
    func = (msg) => msg,
    outputs = 1,
    initialize = null,
    finalize = null,
  } = options;

  // Context storage (simplified)
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
      const result = func(packet, context);
      
      if (result === null || result === undefined) {
        // Don't send anything
        return;
      }

      if (Array.isArray(result) && outputs > 1) {
        // Multiple outputs - each array element goes to different output
        // For now, we just send the first non-null
        for (const msg of result) {
          if (msg !== null && msg !== undefined) {
            send(msg);
            break;
          }
        }
      } else {
        send(result);
      }
    } catch (err) {
      console.error('[Function] Error:', err);
      send({ ...packet, error: err.message });
    }
  };
}

/**
 * Change node - Set, change, delete, or move message properties
 * 
 * Options:
 *   - rules: array of rule objects
 * 
 * Rule types:
 *   - { type: 'set', prop: 'payload', to: value }
 *   - { type: 'change', prop: 'payload', from: /regex/, to: 'replacement' }
 *   - { type: 'delete', prop: 'payload' }
 *   - { type: 'move', prop: 'payload', to: 'newProp' }
 */
function Change(options = {}) {
  const { rules = [] } = options;

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

/**
 * Switch node - Route messages based on property values
 * 
 * Options:
 *   - property: property to test (default: 'payload')
 *   - rules: array of test rules
 *   - checkall: check all rules or stop at first match (default: false)
 * 
 * Rule types:
 *   - { type: 'eq', value: x }     - equals
 *   - { type: 'neq', value: x }    - not equals
 *   - { type: 'lt', value: x }     - less than
 *   - { type: 'gt', value: x }     - greater than
 *   - { type: 'lte', value: x }    - less than or equal
 *   - { type: 'gte', value: x }    - greater than or equal
 *   - { type: 'regex', value: /x/ } - regex match
 *   - { type: 'true' }             - is true
 *   - { type: 'false' }            - is false
 *   - { type: 'null' }             - is null
 *   - { type: 'nnull' }            - is not null
 *   - { type: 'else' }             - no previous match
 */
function Switch(options = {}) {
  const {
    property = 'payload',
    rules = [],
    checkall = false,
  } = options;

  return (send, packet) => {
    const value = getProperty(packet, property);
    let matched = false;

    for (const rule of rules) {
      let isMatch = false;

      switch (rule.type) {
        case 'eq':
          isMatch = value === rule.value;
          break;
        case 'neq':
          isMatch = value !== rule.value;
          break;
        case 'lt':
          isMatch = value < rule.value;
          break;
        case 'gt':
          isMatch = value > rule.value;
          break;
        case 'lte':
          isMatch = value <= rule.value;
          break;
        case 'gte':
          isMatch = value >= rule.value;
          break;
        case 'regex':
          isMatch = rule.value.test(String(value));
          break;
        case 'true':
          isMatch = value === true;
          break;
        case 'false':
          isMatch = value === false;
          break;
        case 'null':
          isMatch = value === null || value === undefined;
          break;
        case 'nnull':
          isMatch = value !== null && value !== undefined;
          break;
        case 'else':
          isMatch = !matched;
          break;
      }

      if (isMatch) {
        matched = true;
        
        // If rule has a 'send' property, use that, otherwise send original
        if (rule.send !== undefined) {
          send(typeof rule.send === 'function' ? rule.send(packet) : { ...packet, ...rule.send });
        } else {
          send(packet);
        }

        if (!checkall) break;
      }
    }
  };
}

/**
 * Template node - Generate output using a template
 * 
 * Options:
 *   - template: template string with {{mustache}} placeholders
 *   - field: output field (default: 'payload')
 *   - format: 'mustache' | 'plain' (default: 'mustache')
 */
function Template(options = {}) {
  const {
    template = '{{payload}}',
    field = 'payload',
    format = 'mustache',
  } = options;

  return (send, packet) => {
    let output;

    if (format === 'mustache') {
      output = template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = getProperty(packet, path.trim());
        return value !== undefined ? String(value) : '';
      });
    } else {
      output = template;
    }

    const result = { ...packet };
    setProperty(result, field, output);
    send(result);
  };
}

/**
 * Delay node - Delay or rate-limit messages
 * 
 * Options:
 *   - delay: delay in ms (default: 1000)
 *   - rate: rate limit (msgs per second, optional)
 *   - drop: drop messages when rate limited (default: false, queues instead)
 */
function Delay(options = {}) {
  const {
    delay = 1000,
    rate = null,
    drop = false,
  } = options;

  const queue = [];
  let processing = false;

  return (send, packet) => {
    if (rate) {
      // Rate limiting mode
      const interval = 1000 / rate;
      
      if (drop && processing) {
        return; // Drop the message
      }

      queue.push(packet);
      
      if (!processing) {
        processing = true;
        
        const processQueue = () => {
          if (queue.length > 0) {
            const msg = queue.shift();
            send(msg);
            setTimeout(processQueue, interval);
          } else {
            processing = false;
          }
        };
        
        processQueue();
      }
    } else {
      // Simple delay mode
      setTimeout(() => send(packet), delay);
    }
  };
}

/**
 * Join node - Join sequences of messages
 * 
 * Options:
 *   - mode: 'auto' | 'manual' | 'reduce'
 *   - count: number of messages to join
 *   - property: property to join (default: 'payload')
 *   - key: property to use as key for object mode
 *   - reducer: function(acc, msg) for reduce mode
 *   - initial: initial value for reduce
 */
function Join(options = {}) {
  const {
    mode = 'manual',
    count = 0,
    property = 'payload',
    key = null,
    reducer = null,
    initial = [],
  } = options;

  let buffer = Array.isArray(initial) ? [...initial] : initial;
  let msgCount = 0;

  return (send, packet) => {
    const value = getProperty(packet, property);

    if (mode === 'reduce' && reducer) {
      buffer = reducer(buffer, packet);
    } else if (key) {
      // Object mode
      if (!buffer || typeof buffer !== 'object') buffer = {};
      const k = getProperty(packet, key);
      buffer[k] = value;
    } else {
      // Array mode
      if (!Array.isArray(buffer)) buffer = [];
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

/**
 * Split node - Split a message into a sequence
 * 
 * Options:
 *   - property: property to split (default: 'payload')
 *   - delimiter: string delimiter for strings, or 'array' for arrays
 */
function Split(options = {}) {
  const {
    property = 'payload',
    delimiter = 'array',
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
    } else if (typeof value === 'string' && delimiter !== 'array') {
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

// === Helper functions for property access ===

function getProperty(obj, path) {
  if (!path) return obj;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

function setProperty(obj, path, value) {
  if (!path) return;
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined) current[part] = {};
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

function deleteProperty(obj, path) {
  if (!path) return;
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined) return;
    current = current[part];
  }
  delete current[parts[parts.length - 1]];
}

export {
  Inject,
  Debug,
  Function,
  Change,
  Switch,
  Template,
  Delay,
  Join,
  Split,
  // Helpers
  getProperty,
  setProperty,
  deleteProperty,
};
