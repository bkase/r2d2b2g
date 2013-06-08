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

let libadb = ctypes.open("/Users/bkase/work/r2d2b2g/addon/lib/low-level/android-tools/adb/libadb.so");

I.declare({ name: "adb_main",
            returns: ctypes.int,
            // is_daemon, is_server, is_lib_call
            args: [ctypes.int, ctypes.int, ctypes.int] 
          }, libadb);

I.declare({ name: "cleanup",
            returns: ctypes.void_t,
            args: []
          }, libadb);

let main = I.use("adb_main");

console.log("INIT");
self.onmessage = function(e) {
  switch(e.data.msg) {
    case "start":
      let port = e.data.port;
      console.log("got start");
      main(0, port, 1);
      break;
    case "cleanup":
      console.log("got cleanup");
      let cleanup = I.use("cleanup");
      cleanup();
      libadb.close();
      self.postMessage({ msg: "closed", a: 1 });
      break;
  }
};

