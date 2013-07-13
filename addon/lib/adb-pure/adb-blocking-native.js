/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { Cu } = require("chrome");
Cu.import("resource://gre/modules/ctypes.jsm");
const { platform } = require("system");

const { Instantiator } = require("adb-pure/ctypes-instantiator");
const { unpackPtr, atransport, AdbCloseHandleType, NULL, CallbackType } =
    require("adb-pure/adb-types");
const { ioUtils } = require("adb-pure/io-utils");

function debug() {
  console.log.apply(console, ["AdbBlockingNative: "].concat(Array.prototype.slice.call(arguments, 0)));
}

const I = new Instantiator();
let libadb, libadbdrivers;
let io;
let io_bridge;
module.exports = {
  reset: function reset() {

  },

  init: function init(libPath, driversPath) {
    libadb = ctypes.open(libPath);

    io = ioUtils(I, libadb);

    I.declare({ name: "cleanup",
                returns: ctypes.void_t,
                args: [ ]
              }, libadb);

    if (platform === "darwin") {
      I.declare({ name: "kill_device_loop",
                  returns: ctypes.void_t,
                  args: []
                }, libadb);
    }

    if (platform === "winnt") {
      libadbdrivers = ctypes.open(driversPath);


      const io_bridge_funcs = [
        { "AdbReadEndpointAsync": AdbReadEndpointAsyncType },
        { "AdbWriteEndpointAsync": AdbWriteEndpointAsyncType },
        { "AdbReadEndpointSync": AdbReadEndpointSyncType },
        { "AdbWriteEndpointSync": AdbWriteEndpointSyncType },
        { "AdbCloseHandle": AdbCloseHandleType },
      ];

      let [struct_dll_io_bridge, io_bridge_, ref] =
        new BridgeBuilder(I, libadbdrivers).
        build("dll_io_bridge", io_bridge_funcs);

      io_bridge = io_bridge_;

      let install_thread_locals =
        I.declare({ name: "install_thread_locals",
                    returns: ctypes.void_t,
                    args: [ CallbackType.ptr, struct_dll_io_bridge.ptr ]
                  }, libadb);

      install_thread_locals(NULL, io_bridge.address());

      I.declare({ name: "AdbCloseHandle",
                  returns: AdbCloseHandleType.returnType,
                  args: AdbCloseHandleType.argTypes
                }, libadbdrivers);
    }

    I.declare({ name: "on_kill_io_pump",
                returns: ctypes.void_t,
                args: [ atransport.ptr, AdbCloseHandleType.ptr ]
              }, libadb);
  },

  cleanupNativeCode: function cleanupNativeCode() {
    debug("Cleaning up native code");
    I.use("cleanup")();
    libadb.close();
    if (platform === "winnt") {
      libadbdrivers.close();
    }
  },

  killDeviceLoop: function killDeviceLoop() {
    // if we're not on OSX, we don't have to do anything
    if (platform === "darwin") {
      // The RunLoopThread might take up to 100ms to close
      I.use("kill_device_loop")();
    }
  },

  killIOPump: function killIOPump(t_ptrS) {
    let t_ptr = unpackPtr(t_ptrS, atransport.ptr);
    let close_handle_func;
    if (platform === "winnt") {
      let bridge = function close_bridge() {
        let f = I.use("AdbCloseHandle");
        // call the real DLL function with the arguments to the bridge call
        return f.apply(f, arguments);
      };
      close_handle_func = AdbCloseHandleType.ptr(bridge);
    } else {
      close_handle_func = ctypes.cast(NULL, AdbCloseHandleType.ptr);
    }

    let onKillIOPump = I.use("on_kill_io_pump");
    onKillIOPump.apply(onKillIOPump, [t_ptr, close_handle_func]);
  },

  writeFully: function writeFully(fd, toWriteS, length) {
    return io.writeFully(fd, toWriteS, length);
  }
};

