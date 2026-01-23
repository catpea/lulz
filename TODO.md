# lulz - TODO

## RxJS Operators to Add Later

These operators are less commonly used but might be useful in specific scenarios.

### Combination Operators

- [ ] `forkJoin` - Wait for all observables to complete, emit last values
- [ ] `race` - First to emit wins
- [ ] `combineAll` - Combine all inner observables
- [ ] `concatAll` - Concat all inner observables
- [ ] `mergeAll` - Merge all inner observables
- [ ] `switchAll` - Switch to latest inner observable
- [ ] `startWith` - Prepend values
- [ ] `endWith` - Append values

### Transformation Operators

- [ ] `bufferCount` - Buffer by count
- [ ] `bufferTime` - Buffer by time
- [ ] `bufferToggle` - Buffer between open/close signals
- [ ] `bufferWhen` - Buffer until closing selector
- [ ] `concatMap` - Map and concat
- [ ] `exhaustMap` - Ignore new while processing
- [ ] `expand` - Recursively project
- [ ] `groupBy` - Group by key
- [ ] `mapTo` - Map to constant
- [ ] `mergeMap` / `flatMap` - Map and merge
- [ ] `mergeScan` - Scan with merge
- [ ] `partition` - Split into two streams
- [ ] `switchMap` - Switch to new on each emission
- [ ] `windowCount` - Window by count
- [ ] `windowTime` - Window by time
- [ ] `windowToggle` - Window between signals
- [ ] `windowWhen` - Window by closing selector

### Filtering Operators

- [ ] `audit` - Ignore during duration selector
- [ ] `auditTime` - Ignore during time window
- [ ] `debounceTime` - (alias for debounce with time)
- [ ] `elementAt` - Emit only Nth element
- [ ] `first` - Emit first (or first matching)
- [ ] `ignoreElements` - Ignore all, only complete/error
- [ ] `last` - Emit last (or last matching)
- [ ] `sample` - Sample on signal
- [ ] `sampleTime` - Sample at interval
- [ ] `single` - Emit only if single match
- [ ] `skipLast` - Skip last N
- [ ] `skipUntil` - Skip until signal
- [ ] `takeLast` - Take last N
- [ ] `takeUntil` - Take until signal
- [ ] `throttleTime` - (alias for throttle)

### Utility Operators

- [ ] `dematerialize` - Convert notification objects
- [ ] `materialize` - Wrap in notification objects
- [ ] `observeOn` - Schedule emissions
- [ ] `subscribeOn` - Schedule subscription
- [ ] `timeInterval` - Emit time between values
- [ ] `finalize` - Execute on complete/error
- [ ] `repeat` - Repeat N times
- [ ] `repeatWhen` - Repeat based on notifier

### Error Handling

- [ ] `retryWhen` - Retry based on notifier
- [ ] `onErrorResumeNext` - Continue with next on error

### Multicasting

- [ ] `multicast` - Share with subject
- [ ] `publish` - Share via publish subject
- [ ] `publishBehavior` - Share via behavior subject
- [ ] `publishLast` - Share via async subject
- [ ] `publishReplay` - Share via replay subject
- [ ] `refCount` - Auto connect/disconnect
- [ ] `shareReplay` - Share and replay

## Node-RED Nodes to Add

### Network

- [ ] `http in` - HTTP endpoint
- [ ] `http request` - HTTP client
- [ ] `http response` - HTTP response
- [ ] `websocket in` - WebSocket listener
- [ ] `websocket out` - WebSocket sender
- [ ] `tcp in` / `tcp out` / `tcp request` - TCP nodes
- [ ] `udp in` / `udp out` - UDP nodes
- [ ] `mqtt in` / `mqtt out` - MQTT nodes

### Storage

- [ ] `file in` - Read file
- [ ] `file out` - Write file
- [ ] `watch` - Watch file/directory

### Parsers

- [ ] `csv` - Parse/generate CSV
- [ ] `html` - Parse HTML
- [ ] `json` - Parse/stringify JSON
- [ ] `xml` - Parse/generate XML
- [ ] `yaml` - Parse/generate YAML

### Sequence

- [ ] `batch` - Batch messages
- [ ] `sort` - Sort messages

## Worker Enhancements

- [ ] Browser Web Worker support
- [ ] SharedArrayBuffer for zero-copy data transfer
- [ ] Worker pool auto-scaling
- [ ] Priority queue
- [ ] Task cancellation
- [ ] Progress reporting

## Core Improvements

- [ ] Better TypeScript definitions
- [ ] Flow visualization / debugging
- [ ] Hot reloading of flows
- [ ] Persistence / checkpointing
- [ ] Metrics / monitoring
- [ ] Backpressure handling
- [ ] Dead letter queue for failed messages
- [ ] Circuit breaker pattern
