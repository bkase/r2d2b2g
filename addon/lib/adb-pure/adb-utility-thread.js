/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Core code
 */
const URL_PREFIX = self.location.href.replace(/adb\-utility\-thread\.js/, "");
const INSTANTIATOR_URL = URL_PREFIX + "ctypes-instantiator.js";
const EVENTED_CHROME_WORKER_URL = URL_PREFIX + "evented-chrome-worker.js";
const CONSOLE_URL = URL_PREFIX + "worker-console.js";
const ADB_TYPES = URL_PREFIX + "adb-types.js";

importScripts(INSTANTIATOR_URL, EVENTED_CHROME_WORKER_URL, CONSOLE_URL, ADB_TYPES);

const worker = new EventedChromeWorker(null, false);
const console = new Console(worker);

function debug() {
  console.log.apply(console, ["AdbUtilityThread: "].concat(Array.prototype.slice.call(arguments, 0)));
}

let I = null;
let libadb = null;
let platform_ = null;
const atransport = ctypes.void_t; // TODO: opaque struct
worker.listen("init", function({ libPath, driversPath, platform }) {
  platform_ = platform;

  I = new Instantiator();

  libadb = ctypes.open(libPath);

  I.declare({ name: "cleanup",
              returns: ctypes.void_t,
              args: []
            }, libadb);

  I.declare({ name: "connect_service",
              returns: ctypes.int,
              args: [ctypes.char.ptr] // service
            }, libadb);


  if (platform === "darwin") {
    I.declare({ name: "kill_device_loop",
                returns: ctypes.void_t,
                args: []
              }, libadb);
  }
  
  if (platform === "winnt") {
    const libadbdrivers = ctypes.open(driversPath);

    I.declare({ name: "AdbCloseHandle",
                returns: AdbCloseHandleType.returnType,
                args: AdbCloseHandleType.argTypes
              }, libadbdrivers);
              
    
    I.declare({ name: "on_kill_io_pump",
              returns: ctypes.void_t,
              args: [ atransport.ptr, AdbCloseHandleType.ptr ]
            }, libadb);
  } else {
    I.declare({ name: "on_kill_io_pump",
                returns: ctypes.void_t,
                args: [ atransport.ptr ]
              }, libadb);
  }
});

worker.listen("cleanup", function() {
  debug("Cleaning up Utility");
  if (libadb) {
    let cleanup = I.use("cleanup");
    cleanup();
    libadb.close();
  }
});

worker.listen("query", function({ service }) {
  debug("got query: " + service);
  let connect = I.use("connect_service");
  let fd = connect(service);
  debug("Query returned: " + fd);
  return { fd: fd };
});

worker.listen("kill-deviceLoop", function({ }) {
  // if we're not on OSX, just terminating the worker is fine
  if (platform_ === "darwin") {
    I.use("kill_device_loop")();
  }
});

worker.listen("kill-ioPump", function({ t_ptrS }) {
   
  let bridge;
  if (platform_ === "winnt") {
    bridge = function close_bridge() {
      let f = I.use("AdbCloseHandle");
      // call the real DLL function with the arguments to the bridge call
      return f.apply(f, arguments);
    };
  } else {
    bridge = null
  }
  
  let onKillIOPump = I.use("on_kill_io_pump");
  onKillIOPump.apply(onKillIOPump, 
                     [eval(t_ptrS)].concat((bridge) ? [AdbCloseHandleType.ptr(bridge)] : []));
});

