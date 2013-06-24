/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Core code
 */
const URL_PREFIX = self.location.href.replace(/adb\-device\-poll\-thread\.js/, "");
const INSTANTIATOR_URL = URL_PREFIX + "ctypes-instantiator.js";
const EVENTED_CHROME_WORKER_URL = URL_PREFIX + "evented-chrome-worker.js";
const CONSOLE_URL = URL_PREFIX + "worker-console.js";

importScripts(INSTANTIATOR_URL, EVENTED_CHROME_WORKER_URL, CONSOLE_URL);

const worker = new EventedChromeWorker(null, false);
const console = new Console(worker);

let I = null;
let libadb = null;

const CFRunLoopTimerCallback = ctypes.FunctionType(ctypes.default_abi, ctypes.int).ptr;
const struct_func_carrier =
  new ctypes.StructType("func_carrier", [
    { "should_kill": CFRunLoopTimerCallback }
  ]);

let shouldKillNow = 0;
worker.once("init", function({ libPath }) {
  I = new Instantiator();

  libadb = ctypes.open(libPath);

  I.declare({ name: "usb_monitor",
              returns: ctypes.int,
              // should_kill
              args: [ struct_func_carrier.ptr ]
            }, libadb);

  let input = struct_func_carrier();
  let shouldKill = function shouldKill() {
    console.log("Sending back: " + shouldKillNow);
    return shouldKillNow;
  }

  input.should_kill = CFRunLoopTimerCallback(shouldKill);

  I.use("usb_monitor")(input.address());
  console.log("usb_monitor returned!");
});

worker.listen("cleanup", function() {
  console.log("Cleaning up");
  if (libadb) {
    libadb.close();
  }
});

