/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { Cc, Ci, Cr, Cu, ChromeWorker } = require("chrome");
const system = require("system");

const I = require("ctypes-instantiator").Instantiator();

const URL_PREFIX = module.uri.replace(/adb\-pure\.js/, "");
const WORKER_URL_SERVER = URL_PREFIX + "adb-server-thread.js";
const WORKER_URL_TEST = URL_PREFIX + "adb-test.js";

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://gre/modules/Services.jsm");
const arch = system.architecture;

let close_cb = function() { };
let libadb = ctypes.open("/Users/bkase/work/r2d2b2g/addon/lib/low-level/android-tools/adb/libadb.so");

 //let libderp = ctypes.open("/Users/bkase/work/r2d2b2g/addon/lib/derp.so");

/*I.declare({ name: "spawn_thread",
            returns: ctypes.int,
            args: [] // is_daemon, is_server
          }, libderp);

let main = I.use("spawn_thread");*/


  I.declare({ name: "adb_query", 
              returns: ctypes.char.ptr, 
              args: [ctypes.char.ptr] // service
            }, libadb);


/*  I.declare({ name: "adb_main",
              returns: ctypes.int,
              // is_daemon, is_server, is_lib_call
              args: [ctypes.int, ctypes.int, ctypes.int]
            }, libadb); */

  I.declare({ name: "cleanup",
              returns: ctypes.void_t,
              args: []
            }, libadb);
  /*I.declare({ name: "cleanup",
              returns: ctypes.void_t,
              args: []
            }, libderp);*/
 

let w = null;
exports.startAdbInBackground = function() {
  let serverWorker = new ChromeWorker(WORKER_URL_SERVER);
  serverWorker.onmessage = function(e) {
    switch(e.data.msg) {
      case "closed": 
        libadb.close();
        close_cb();
        break;
    }
  };
  serverWorker.onerror = function(err) {
    console.error(err);
  };
  serverWorker.postMessage({ msg: "start", port: 5037 });
  //let main = I.use("adb_main");

  console.log("About");

  //main(0, 8991, 1);
  //startAdbEvent.run();
  console.log("Dispatched");
  w = serverWorker;
};

exports.getDevices = function(cb) {
  let query = I.use("adb_query"); 
  return query("host:devices");
};

exports.close = function(cb) {
  w.postMessage({ msg: "cleanup" });
  close_cb = cb;
  // libderp.close();
  // with or without w.terminate for test case
  //w.terminate();
};
