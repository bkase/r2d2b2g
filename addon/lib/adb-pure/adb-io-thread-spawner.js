/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Core code
 */

'use strict'; 

const URL_PREFIX = self.location.href.replace(/adb\-io\-thread\-spawner.js/, "");
const INSTANTIATOR_URL = URL_PREFIX + "ctypes-instantiator.js";
const EVENTED_CHROME_WORKER_URL = URL_PREFIX + "evented-chrome-worker.js";
const CONSOLE_URL = URL_PREFIX + "worker-console.js";
const ADB_TYPES = URL_PREFIX + "adb-types.js";
const CTYPES_BRIDGE_BUILDER = URL_PREFIX + "ctypes-bridge-builder.js";

importScripts(INSTANTIATOR_URL, EVENTED_CHROME_WORKER_URL, CONSOLE_URL, ADB_TYPES, CTYPES_BRIDGE_BUILDER);

const worker = new EventedChromeWorker(null, false);
const console = new Console(worker);

function debug() {
  console.log.apply(console, ["AdbIOThreadSpawner: "].concat(Array.prototype.slice.call(arguments, 0)));
}

let I = null;
let libadb = null;

worker.once("init", function({ libPath, driversPath, threadName, argTypesStrings, argStrings, platform }) {
  I = new Instantiator();

  argTypesStrings = argTypesStrings || [];
  argStrings = argStrings || [];
  
  libadb = ctypes.open(libPath);

  if (platform === "winnt") {
    const libadbdrivers = ctypes.open(driversPath);

    const io_bridge_funcs = [
      { "AdbReadEndpointAsync": AdbReadEndpointAsyncType },
      { "AdbWriteEndpointAsync": AdbWriteEndpointAsyncType },
      { "AdbReadEndpointSync": AdbReadEndpointSyncType },
      { "AdbWriteEndpointSync": AdbWriteEndpointSyncType },
      { "AdbCloseHandle": AdbCloseHandleType },
    ];
    
    let [struct_dll_io_bridge, io_bridge, ref] = new BridgeBuilder(I, libadbdrivers).build("dll_io_bridge", io_bridge_funcs);
      
    I.declare({ name: threadName,
                returns: ctypes.int,
                args: argTypesStrings.map(function(x) eval(x)).concat([ struct_dll_io_bridge.ptr ])
              }, libadb);

    debug("Spawning: " + threadName + " with args: " + argStrings);
    let spawn = I.use(threadName);

    return spawn.apply( spawn, argStrings.map(function(x) eval(x)).concat([ io_bridge.address() ]) );
  } else {
    I.declare({ name: threadName,
                returns: ctypes.int,
                args: argTypesStrings.map(function(x) eval(x))
              }, libadb);

    debug("Spawning: " + threadName + " with args: " + argStrings);
    let spawn = I.use(threadName);

    return spawn.apply( spawn, argStrings.map(function(x) eval(x)) );
  }
});
