/**
 * lulz - A reactive dataflow system
 *
 * Inspired by FFmpeg filtergraph notation and Node-RED
 */

export { flow, subflow, compose, makeNode, makePipe, isOuter, isInner } from './src/flow.js';
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
  getProperty,
  setProperty,
  deleteProperty,
} from './src/nodes.js';
