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

importScripts(INSTANTIATOR_URL, EVENTED_CHROME_WORKER_URL, CONSOLE_URL);

const worker = new EventedChromeWorker(null, false);
const console = new Console(worker);

let I = null;
let libadb = null;
let platform_ = null;
const pthread_t = ctypes.void_t;
const atransport = ctypes.void_t; // TODO: opaque struct
worker.listen("init", function({ libPath, platform }) {
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

  I.declare({ name: "on_kill_io_pump",
              returns: ctypes.void_t,
              args: [ atransport.ptr ]
            }, libadb);

  if (platform === "darwin") {
    I.declare({ name: "kill_device_loop",
                returns: ctypes.void_t,
                args: []
              }, libadb);
  }
});

worker.listen("cleanup", function() {
  console.log("Cleaning up Utility");
  if (libadb) {
    let cleanup = I.use("cleanup");
    cleanup();
    libadb.close();
  }
});

worker.listen("query", function({ service }) {
  console.log("got query: " + service);
  let connect = I.use("connect_service");
  let fd = connect(service);
  console.log("Query returned: " + fd);
  return { fd: fd };
});

worker.listen("kill-deviceLoop", function({ }) {
  // if we're not on OSX, just terminating the worker is fine
  if (platform_ === "darwin") {
    I.use("kill_device_loop")();
  }
});

worker.listen("kill-ioPump", function({ t_ptrS }) {
  I.use("on_kill_io_pump")(eval(t_ptrS));
});

