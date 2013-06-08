/* Instantiator 
 * TODO: (figure out how to import this properly) */
function Instantiator() {
  this._memo = [];
}
Instantiator.prototype.use = function use(name) {
  if (!this._memo[name])
    throw "Undeclared function in library";
  return this._memo[name];
};
Instantiator.prototype.declare = function declare({ name, returns, args }, lib) {
  let func = 
    lib.declare.apply(lib, 
                         [name, ctypes.default_abi, returns].concat(args));
  this._memo[name] = func;
  return func;
};

/*
 * Core code
 */

const I = new Instantiator();

const console = {
  log: function() {
    self.postMessage({ msg: "log", args: Array.prototype.slice.call(arguments, 0)});
  }
};

console.log("SPAWNED");


let libderp = ctypes.open("/Users/bkase/work/r2d2b2g/addon/lib/derp.so");

I.declare({ name: "spawn_thread",
            returns: ctypes.int,
            args: [] // is_daemon, is_server
          }, libderp);

let main = I.use("spawn_thread");

console.log("INIT");
self.onmessage = function(e) {
  switch(e.data.msg) {
    case "start":
      let port = e.data.port;
      console.log("got message");
      main();
      self.postMessage({ msg: "done", a: 1 });
      break;
  }
};

