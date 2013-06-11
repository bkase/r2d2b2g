/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Core code
 */
const URL_PREFIX = self.location.href.replace(/adb\-server\-thread\.js/, "");
const INSTANTIATOR_URL = URL_PREFIX + "ctypes-instantiator.js";
const EVENTED_CHROME_WORKER_URL = URL_PREFIX + "evented-chrome-worker.js";
const CONSOLE_URL = URL_PREFIX + "worker-console.js";

importScripts(INSTANTIATOR_URL, EVENTED_CHROME_WORKER_URL, CONSOLE_URL);

const worker = new EventedChromeWorker(null, false);
const console = new Console(worker);
const I = new self.Instantiator();

let libadb = null;
worker.listen("init", function({ libPath }) {
  libadb = ctypes.open(libPath);

  I.declare({ name: "adb_main",
              returns: ctypes.int,
              // is_daemon, is_server, is_lib_call
              args: [ctypes.int, ctypes.int, ctypes.int]
            }, libadb);

  I.declare({ name: "cleanup",
              returns: ctypes.void_t,
              args: []
            }, libadb);

  I.declare({ name: "adb_query",
              returns: ctypes.char.ptr,
              args: [ctypes.char.ptr] // service
            }, libadb);
});

worker.listen("start", function({ port }) {
  let main = I.use("adb_main");
  return { ret: main(0, port, 1) };
});

worker.listen("cleanup", function() {
  console.log("Cleaning up");
  let cleanup = I.use("cleanup");
  if (libadb) {
    libadb.close();
  }
});

worker.listen("query", function({ action }) {
  console.log("got query: " + action);
  let query = I.use("adb_query");
  let result = query(action);
  console.log("Query returned: " + result);
  return { result: result.readString() };
});

console.log("INIT");

