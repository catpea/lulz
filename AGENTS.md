# AGENTS.md

## Flow-First Programming: A Manifesto

> Software has always been about moving information.
> We simply forgot to draw the pipes.

This document describes **flow-first programming**: a discipline where programs are expressed as readable graphs of **pipes** (facts) and **motions** (transformations).

---

## 0. The Problem We Forgot We Had

Most software is a **lie detector's nightmare**.

```js
// Traditional code: What is happening?
if (user && user.isValid && !user.banned) {
  const order = processOrder(cart);
  if (order.success) {
    if (payment.charge(order.total)) {
      // 47 more nested conditions...
    }
  }
}
```

This code **hides its shape**. You cannot see:
- What paths exist
- What outcomes are possible
- Where errors go to die

Flow-first programming has one rule:

> **If you can draw it, you can debug it.**

```
request ──→ validate ──→ price ──→ charge ──→ 'paid'
                │                      │
                └──→ 'invalid'         └──→ 'declined'
```

The program **is** the diagram. The diagram **is** the program.

---

## 1. What This Is (and Is Not)

This is **not**:
- an AI abstraction
- a fancy DSL
- a new syntax to learn

This **is**:
- a way to see your program's skeleton
- a shared language for humans and LLMs
- a method that scales from scripts to systems
- the spiritual successor to Unix pipes and FFmpeg filtergraphs

**The test**: Can a stranger read your program aloud and understand it?

---

## 2. The Two Symbols That Matter

Every flow-first program uses exactly two concepts:

### 2.1 Pipes — Named Facts (Nouns)

A **pipe** is a named checkpoint. A promise kept.

Written as a **quoted string**:

```js
'request'    // An HTTP request arrived
'validated'  // Data passed all checks
'paid'       // Money changed hands
'published'  // The world can see it
```

**Pipes are contracts.** When you see one, you can say:

> "This happened. I can depend on it."

Think of pipes as **milestones on a highway**. They tell you where you are.

### 2.2 Motions — Transformations (Verbs)

Anything **unquoted** is motion—work being done:

```js
validate     // check the data
calculate    // compute something
save         // persist to storage
notify       // tell someone
```

Motions are **honest about uncertainty**. They might:
- Transform the packet and pass it on
- Drop the packet silently (this is how branching works!)
- Create errors

**Motions do not promise. Pipes do.**

### The Shape of a Line

Every line follows this pattern:

```js
['source', motion, motion, motion, 'destination']
//  noun    verb    verb    verb      noun

// Read it like English:
// "From source, do this, then this, then this, arriving at destination."
```

---

## 3. The Golden Rules

### Rule 1: Producers Begin, Pipes End

**Producers** create packets from the outside world:
- `http` — incoming web requests
- `stdin` — terminal input
- `watch` — file changes
- `socket` — real-time messages
- `timer` — scheduled events

Producers appear **only at the start** of a feature:

```js
[http, route, 'request']     // ✓ Producer starts the flow
['request', process, 'done'] // ✓ Pipe starts subsequent flows
[process, 'done']            // ✗ Motion cannot start a flow
```

### Rule 2: Every Feature Must Name a Pipe

A feature isn't done when it runs. It's done when it **commits to a name**.

```js
// Bad: Where does this go? What can depend on it?
['request', handle]

// Good: Clear commitment
['request', handle, 'response']
```

### Rule 3: Motions Drop, Never Branch

There is no `if`. There is no `switch`. There is only:

> **Forward what you understand. Drop what you don't.**

```js
['request', isGetRequest, loadPage, 'page']
['request', isPostRequest, saveData, 'saved']
```

Both lines listen to `'request'`. Each motion decides:
- "Is this for me? → Forward it."
- "Not for me? → Drop it silently."

**This is how branching works.** The packet finds its own path.

---

## 4. Reading Flows Aloud

If you can read it aloud, you can understand it.

```js
const wiki = flow([
  [http, route, 'request'],
  ['request', loadPage, render, 'viewed'], // loadPage is both a test isLoadPage and page loader, it simply does nothing if not load page.
  ['request', savePage, confirm, 'saved'],
]);
```

Read it:

> "HTTP requests become requests.
> Requests that load pages get rendered and become viewed.
> Requests that save pages get confirmed and become saved."

No translation needed. No mental compiler required.

---

## 5. The Packet's Journey (A Mental Model)

Imagine a **letter** traveling through a postal system.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   📧 Packet                                                 │
│   ┌──────────────────────┐                                  │
│   │ payload: "Hello"     │                                  │
│   │ topic: "greeting"    │                                  │
│   │ _timestamp: 17283... │                                  │
│   └──────────────────────┘                                  │
│                                                             │
│   The packet travels through motions:                       │
│                                                             │
│   validate ──→ transform ──→ save                           │
│       │            │           │                            │
│       │            │           └─→ Adds { saved: true }     │
│       │            └─→ Uppercases payload                   │
│       └─→ Checks format, drops if invalid                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Each motion can:
1. **Pass it through** unchanged
2. **Enrich it** with new data
3. **Transform it** entirely
4. **Drop it** (the packet simply stops)

When the packet reaches a pipe, **that pipe emits**. Listeners wake up.

---

## 6. Patterns That Emerge

### 6.1 The Funnel (Validation)

```js
['input',
  notEmpty,      // drops empty
  isValidEmail,  // drops invalid format
  notDisposable, // drops throwaway domains
  'validEmail'
]
// Only survivors reach 'validEmail'
```

### 6.2 The Fork (Routing)

```js
['request', isApi, handleApi, 'apiResponse']
['request', isPage, renderPage, 'pageResponse']
['request', isAsset, serveFile, 'assetResponse']
// Each packet takes exactly one path
```

### 6.3 The Merge (Convergence)

```js
['apiResponse', format, 'response']
['pageResponse', format, 'response']
['assetResponse', format, 'response']
// All roads lead to 'response'
```

### 6.4 The Fan (Parallel Effects)

```js
['order', [
  sendEmail,      // notify customer
  updateStock,    // adjust inventory
  logAnalytics,   // record metrics
], 'processed']
// All three happen simultaneously
```

### 6.5 The Saga (Multi-Step Process)

```js
['checkout',
  validateCart,
  reserveStock,
  chargePayment,
  confirmOrder,
  'completed'
]
// Each step must succeed for the next to run
```

---

## 7. TODOs Instead of Errors

Missing code should not block understanding.

The `todo` prefix turns unimplemented features into **work queues**:

```js
const wiki = flow([
  [todo.http, todo.route, 'request'],
  ['request', todo.loadPage, todo.render, 'viewed'],
  ['request', todo.savePage, todo.confirm, 'saved'],
]);
```

This flow **runs**. It **reads correctly**. It just doesn't do anything yet.

You can hand this to an LLM and say: "Implement `todo.loadPage`."

The shape is preserved. The poem remains intact.

---

## 8. Examples (Annotated for Beginners)

### 8.1 Static Web Server

```js
const server = flow([

  // ─── Entry Point ─────────────────────────────
  [http, route, 'request'],
  // http: produces packets from incoming connections
  // route: parses URL, method, headers
  // 'request': guaranteed to be a valid, parsed request

  // ─── Static Files ────────────────────────────
  ['request',
    isStaticFile,   // drops non-file requests, nothing is sent to readFile
    readFile,       // loads from disk (drops if missing)
    detectMime,     // adds content-type
    respond,        // sends to client
    'served'
  ],
  // 'served': a file was successfully delivered

]);
```

### 8.2 Pastebin

```js
const pastebin = flow([

  [http, route, 'request'],

  // ─── Create Paste ────────────────────────────
  ['request',
    isPost,           // drops GET requests
    parseBody,        // extracts paste content
    generateId,       // creates unique identifier
    store,            // saves to database
    'stored'
  ],

  // ─── View Paste ──────────────────────────────
  ['request',
    isGet,            // drops POST requests
    extractId,        // gets paste ID from URL
    retrieve,         // loads from database (drops if missing)
    'found'
  ],

  // ─── Responses ───────────────────────────────
  ['stored', respondWithLink, 'done'],
  ['found', respondWithContent, 'done'],

]);
```

### 8.3 Wiki

```js
const wiki = flow([

  [http, route, 'request'],

  // ─── View Page ───────────────────────────────
  ['request',
    isViewRequest,    // drops edits and saves
    loadPage,         // fetches from storage
    renderMarkdown,   // converts to HTML
    wrapInLayout,     // adds header/footer
    'viewResponse'
  ],

  // ─── Edit Page ───────────────────────────────
  ['request',
    isEditRequest,    // drops views and saves
    loadPage,         // fetches current content
    renderEditor,     // shows edit form
    'editResponse'
  ],

  // ─── Save Page ───────────────────────────────
  ['request',
    isSaveRequest,    // drops views and edits
    parseChanges,     // extracts new content
    validateContent,  // checks for spam, etc.
    saveToHistory,    // preserves old version
    saveToStorage,    // writes new version
    'saveResponse'
  ],

  // ─── Send Response ───────────────────────────
  ['viewResponse', respond, 'done'],
  ['editResponse', respond, 'done'],
  ['saveResponse', respondWithRedirect, 'done'],

]);
```

### 8.4 Coding Agent

```js
const agent = flow([

  // ─── Intake ──────────────────────────────────
  [stdin, clean, parse, 'order'],
  // User's raw input becomes a structured order

  // ─── Negotiation ─────────────────────────────
  ['order',
    understand,           // LLM comprehends intent
    plan,                 // LLM creates action plan
    confirm('Proceed?'),  // Human approves or rejects
    'decision'
  ],

  ['decision', approved, 'greenlight'],
  ['decision', refused, 'rejected'],

  // ─── Execution ───────────────────────────────
  ['greenlight',
    prepare,    // set up environment
    execute,    // run the plan
    observe,    // check results
    'result'
  ],

  // ─── Recovery ────────────────────────────────
  ['rejected',
    explain,    // clarify what was misunderstood
    rephrase,   // offer alternative
    'proposal'
  ],

  // ─── Output ──────────────────────────────────
  ['result', summarize, format, 'output'],
  ['proposal', format, 'output'],

  ['output', print, 'spoken'],

]);
```

Delete every function body. **You still understand the system.**

That is the point.

---

## 9. Common Mistakes (And How to Fix Them)

### Mistake 1: Returning Instead of Sending

```js
// Wrong: Functions don't return
function double(packet) {
  return { ...packet, payload: packet.payload * 2 };
}

// Right: Functions send forward
function double(options) {
  return (send, packet) => {
    send({ ...packet, payload: packet.payload * 2 });
  };
}
```

### Mistake 2: Explicit Branching

```js
// Wrong: Traditional if/else thinking
function router(send, packet) {
  if (packet.method === 'GET') {
    send({ ...packet, route: 'get' });
  } else if (packet.method === 'POST') {
    send({ ...packet, route: 'post' });
  }
}

// Right: Separate motions that drop
function isGet(options) {
  return (send, packet) => {
    if (packet.method === 'GET') send(packet);
    // Otherwise: silence (packet dropped)
  };
}

function isPost(options) {
  return (send, packet) => {
    if (packet.method === 'POST') send(packet);
  };
}

// Usage: each path is its own line
['request', isGet, handleGet, 'response']
['request', isPost, handlePost, 'response']
```

### Mistake 3: Pipes in the Middle

```js
// Wrong: Pipe mid-sentence
['request', validate, 'validated', transform, 'result']

// Right: One pipe per line
['request', validate, 'validated']
['validated', transform, 'result']
```

### Mistake 4: Unnamed Endings

```js
// Wrong: Where does this go?
['request', process, notify]

// Right: Commit to a name
['request', process, notify, 'notified']
```

---

## 10. Why This Works

### For Humans

- **Readability**: Programs read like sentences
- **Debuggability**: Add a `tap` anywhere to see packets
- **Refactorability**: Move lines around without breaking logic
- **Onboarding**: New developers understand the system in minutes

### For LLMs

- **Structured**: Clear grammar, predictable patterns
- **Bounded**: Each motion is a small, focused task
- **Testable**: Easy to verify individual transformations
- **Extensible**: "Add a motion after X" is unambiguous

### For Systems

- **Composable**: Flows embed inside flows
- **Observable**: Every pipe is an event you can monitor
- **Resilient**: Dropped packets don't crash the system
- **Parallelizable**: Independent paths run concurrently

---

## 11. The Philosophy

Flow-first programming rests on three beliefs:

### Belief 1: Shape Over Syntax

The **topology** of a program matters more than its tokens.
If you can see the shape, you can reason about behavior.

### Belief 2: Silence Over Exceptions

When a motion doesn't apply, it drops the packet.
No errors. No catches. No noise.
The packet simply takes another path—or no path.

### Belief 3: Names Over Comments

A well-named pipe is worth a thousand comments.
When `'validated'` appears, no explanation is needed.
The name carries the meaning.

---

## 12. Getting Started

1. **Draw first**. Sketch the flow on paper before coding.
2. **Name your pipes**. What are the important states?
3. **List your motions**. What transformations connect them?
4. **Wire it up**. Write the flow array.
5. **Implement motions**. One small function at a time.

Start with `todo.` prefixes. Let the shape emerge.
Fill in the implementations later.

The program will tell you what it needs.

---

## 13. A Final Word

> Programs should be written for people to read,
> and only incidentally for machines to execute.
> — Abelson & Sussman

Flow-first programming takes this seriously.

The graph is the spec.
The graph is the documentation.
The graph is the test plan.
The graph is the program.

Draw your pipes.
Name your truths.
Let the packets flow.

---

*End of AGENTS.md*
