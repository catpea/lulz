This is the original chiken scratch that started this project

 ```js

const fakeServer = new EventEmitter();
let counter = 1;
setInterval(()=>{
  fakeServer.emit('fakeData', counter++);
},1_000)


// the actual program

const context = {
  username: 'alice',

};

const pipes = {};

// PROGRAM EXAMPLE
const blogBuilder = [

  [ socket('post'), 'post' ], // monitor web socket for new post announcement
  [ watch('assets'), 'asset' ], // watch assets folder for changes

  [ 'post', log ], // log whan a new post arrives on post pipe

  [ 'asset', assets ], // listen to asset pipe and call the asset funcion
  [ 'post', cover, audio, post, 'updated' ], // listen to post pipe and call cover+aufio+post with same data (fan not series like in ffmpeg, series would requre array ['in', [a,b,c], 'out'], where a gets in, sends a out to b, b sends b out to c, and c sends to out pipe (or funcion if a funcion follows the array) this is a todo)
  [ 'updated', pagerizer, log ],

];


const app = flow(blogBuilder, context);


// User Functions (DO NOT IMPLEMENT YET)

function log(options){ // outer declaration: allows user to configure the funcion in program array

  return (send, packet) => { // inner funcion must be arrow as .arguments are used to set inner/outer apart
    console.log( options, this.context, packet );
    send(packet); /* send through */
  }
}

// examples of producers

function socket(options){
  return (send)=>{
    fakeServer.on('fakeData', counter=>send(counter))
  }
}

function watch(options){
  return (send)=>{
    fakeServer.on('fakeData', counter=>send(counter))
  }
}



// example sink/tranducer, just pass through
function assets(options){ return (send, packet)=>send(packet)}
function cover(options){ return (send, packet)=>send(packet)}
function audio(options){ return (send, packet)=>send(packet)}
function post(options){ return (send, packet)=>send(packet)}
function pagerizer(options){ return (send, packet)=>send(packet)}






// System Functions

function flow(graph, context){

  const directions = {from:0, to:2};

  const [ inputs, transforms, outputs ] = graph.reduce((a, c)=>{
    let direction = directions.from;
    if(typeof c === 'string'){
     a[direction].push(makePipe(c));
    }else{
      direction = directions.to; // flip direction
      const isOuter = c?.arguments;
      let fn;
      if(isOuter){
        // bind outer funcion
        const bound = c.bind(context)
        fn = bound({}); // apply empty config and retreive inner funcion
      }else{
        // already inner funcion
        // set context to an already configured inner function
        fn.context = context;
      }


      a[1].push(makeNode(fn)); // store transform

    }
  },[[],[],[]]);

  if(inputs.length){
    for (const input of inputs){
      for( const transform of transforms ){
        input.connect(transform);
        for (const output of outputs){
          transform.connect(output);
        }
      }
    }
  }else{
    for( const transform of transforms ){
      input.connect(transform);
      for (const output of outputs){
        transform.connect(output);
      }
    }
  }
}










function makeNode(name, fn) {
  const outputs = new Set()
  function send(packet) {
    for (const out of outputs) out(packet)
  }
  function input(packet) {
    fn(send, packet)
  }
  input.connect = next => {
    outputs.add(next)
    return next
  }
  input.name = name
  return input
}

makePipe(name){
  if(!pipes[name]) pipes[name] = {type:'pipe', name, through: makeNode(through)};
  return pipes[name];
}

```
