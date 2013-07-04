/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { Cu } = require("chrome");
Cu.import("resource://gre/modules/ctypes.jsm");

const { Instantiator } = require("adb-pure/ctypes-instantiator");
const { atransport, AdbCloseHandleType }  = require("adb-pure/adb-types");
const { ioUtils } = require("adb-pure/io-utils");

function debug() {
  console.log.apply(console, ["AdbBlockingNative: "].concat(Array.prototype.slice.call(arguments, 0)));
}

const I = new Instantiator();
let platform_;
let libadb, libadbdrivers;
let io;
module.exports = {
  init: function init(platform, libPath, driversPath) {
    platform_ = platform;
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
  },

  cleanupNativeCode: function cleanupNativeCode() {
    debug("Cleaning up native code");
    I.use("cleanup")();
    libadb.close();
    if (platform_ === "winnt") {
      libadbdrivers.close();
    }
  },

  killDeviceLoop: function killDeviceLoop() {
    // if we're not on OSX, we don't have to do anything
    if (platform_ === "darwin") {
      // The RunLoopThread might take up to 100ms to close
      I.use("kill_device_loop")();
    }
  },

  killIOPump: function killIOPump(t_ptrS) {
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
  },

  writeFully: function writeFully(fd, toWriteS, length) {
    return io.writeFully(fd, toWriteS, length);
  }
};

