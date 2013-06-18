/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Core code
 */
const URL_PREFIX = self.location.href.replace(/adb\-simple\-thread\-spawner.js/, "");
const INSTANTIATOR_URL = URL_PREFIX + "ctypes-instantiator.js";
const EVENTED_CHROME_WORKER_URL = URL_PREFIX + "evented-chrome-worker.js";
const CONSOLE_URL = URL_PREFIX + "worker-console.js";

importScripts(INSTANTIATOR_URL, EVENTED_CHROME_WORKER_URL, CONSOLE_URL);

const worker = new EventedChromeWorker(null, false);
const console = new Console(worker);

let I = null;
let libadb = null;

worker.listen("init", function({ libPath, threadName, argTypesStrings, argStrings }) {
  I = new Instantiator();

  argTypesStrings = argTypesStrings || [];
  argStrings = argStrings || [];

  libadb = ctypes.open(libPath);

  I.declare({ name: threadName,
              returns: ctypes.int,
              // server_port
              args: argTypesStrings.map(function(x) eval(x))
            }, libadb);

  console.log("Spawning: " + threadName + " with args: " + argStrings);
  let spawn = I.use(threadName);

  return spawn.apply( spawn, argStrings.map(function(x) eval(x)) );
});

