/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { Cc, Ci, Cr, Cu, ChromeWorker } = require("chrome");
const Promise = require("sdk/core/promise");

const URL_PREFIX = module.uri.replace(/adb\-pure\.js/, "");
const WORKER_URL_SERVER = URL_PREFIX + "adb-server-thread.js";
const WORKER_URL_IO = URL_PREFIX + "adb-io-thread.js";
const WORKER_URL_UTIL = URL_PREFIX + "adb-utility-thread.js";

const EventedChromeWorker = require("adb-pure/evented-chrome-worker").EventedChromeWorker;
const deviceTracker = require("adb-pure/adb-device-tracker");
const fileTransfer = require("adb-pure/adb-file-transfer");
const commandRunner = require("adb-pure/adb-command-runner");
const blockingNative = require("adb-pure/adb-blocking-native");
const timers = require("timers");
const URL = require("url");
const env = require("api-utils/environment").env;
const file = require("file");
const subprocess = require("subprocess");
const self = require("self");
const { platform } = require("system");

Cu.import("resource://gre/modules/Services.jsm");

let serverWorker, ioWorker, utilWorker;

let extension = (platform === "winnt") ? ".dll" : ".so";

let platformDir;
if (platform === "winnt") {
  platformDir = "win32";
} else if (platform === "linux") {
  let is64bit = (require("runtime").XPCOMABI.indexOf("x86_64") == 0);
  if (is64bit) {
    platformDir = "linux64";
  } else {
    platformDir = "linux";
  }
} else if (platform === "darwin") {
  platformDir = "mac64";
} else {
  throw "Unsupported platform";
}
let libPath = URL.toFilename(self.data.url(platformDir + "/adb/libadb" + extension));
let driversPath = (platform === "winnt") ?
  URL.toFilename(self.data.url("win32/adb/AdbWinApi.dll")) : null;

// the context is used as shared state between EventedChromeWorker runOnPeerThread calls and this module
let context = { __workers: [], // this array is populated automatically by EventedChromeWorker
                platform: platform,
                driversPath: driversPath,
                libPath: libPath
              };

const DEVICE_NOT_CONNECTED = "Device not connected";
exports.DEVICE_NOT_CONNECTED = DEVICE_NOT_CONNECTED;

let server_die_fd = null;

let ready = false;
let didRunInitially = false;
const psRegexNix = /.*? \d+ .*? .*? \d+\s+\d+ .*? .*? .*? .*? adb .*fork\-server/;
const psRegexWin = /adb.exe.*/;

function debug() {
  console.log.apply(console, ["AdbPure: "].concat(Array.prototype.slice.call(arguments, 0)));
}

function queryService(service, deferred) {
  let result = "";
  utilWorker.emit("query", { service: service }, function({ fd }) {
    if (fd < 0) {
      debug("Error: fd is " + fd);
      deferred.reject("Bad file descriptor");
      return;
    }

    let msg = service + ":data";
    let idx = ioWorker.listenAndForget(msg, function({ data }) {
      result += data;
    });

    ioWorker.emit("readStringFully", { fd: fd, tag: service }, function({ ret }) {
      ioWorker.freeListener(msg, idx);
      deferred.resolve(result);
    });

  });
}

exports = module.exports = {
  get didRunInitially() didRunInitially,
  set didRunInitially(newVal) { didRunInitially = newVal },
  get ready() ready,
  set ready(newVal) { ready = newVal },

  start: function start() {
    let onSuccessfulStart = (function onSuccessfulStart() {
      Services.obs.notifyObservers(null, "adb-ready", null);
      this.ready = true;
    }).bind(this);

    this._isAdbRunning().then(
      (function onSuccess(isAdbRunning) {
        if (isAdbRunning) {
          this.didRunInitially = false;
          debug("Found ADB process running, not restarting");
          onSuccessfulStart();
          return;
        }
        debug("Didn't find ADB process running, restarting");

        this.didRunInitially = true;
        this._startAdbInBackground();
      }).bind(this));
  },


  _isAdbRunning: function() {
    let deferred = Promise.defer();

    let ps, args;
    if (platform === "winnt") {
      ps = "C:\\windows\\system32\\tasklist.exe";
      args = [];
    } else {
      args = ["aux"];
      let psCommand = "ps";

      let paths = env.PATH.split(':');
      let len = paths.length;
      for (let i = 0; i < len; i++) {
        let fullyQualified = file.join(paths[i], psCommand);
        if (file.exists(fullyQualified)) {
          ps = fullyQualified;
          break;
        }
      }
      if (!ps) {
        debug("Error: a task list executable not found on filesystem");
        deferred.resolve(false); // default to restart adb
        return deferred.promise;
      }
    }

    let buffer = [];

    subprocess.call({
      command: ps,
      arguments: args,
      stdout: function(data) {
        buffer.push(data);
      },
      done: function() {
        let lines = buffer.join('').split('\n');
        let regex = (platform === "winnt") ? psRegexWin : psRegexNix;
        let isAdbRunning = lines.some(function(line) {
          return regex.test(line);
        });
        deferred.resolve(isAdbRunning);
      }
    });

    return deferred.promise;
  },

  pushFile: function pushFile(srcPath, destPath) {
    let deferred = Promise.defer();
    if (!deviceTracker.hasDevice) {
      deferred.reject(DEVICE_NOT_CONNECTED);
      return deferred.promise;
    }

    return fileTransfer.pushFile(srcPath, destPath);
  },

  forwardPort: function forwardPort(port) {
    let deferred = Promise.defer();
    if (!deviceTracker.hasDevice) {
      deferred.reject(DEVICE_NOT_CONNECTED);
      return deferred.promise;
    }

    // <host-prefix>:forward:<local>;<remote>
    let service = "host:forward:tcp:" + port + ";tcp:6000";

    queryService(service, deferred);

    return deferred.promise;
  },

  shell: function shell(shellCommand) {
    let deferred = Promise.defer();
    if (!deviceTracker.hasDevice) {
      deferred.reject(DEVICE_NOT_CONNECTED);
      return deferred.promise;
    }

    debug("Executing: " + shellCommand);

    let service = "shell:" + shellCommand;

    queryService(service, deferred);

    return deferred.promise;
  },

  listDevices: function listDevices() {
    debug("Listing devices");
    return commandRunner.devices();
  },

  close: function close() {
    let t0 = Date.now();
    debug("Closing - ");
    let x = 1;
    deviceTracker.stop();
    debug("After stopTrackingDevices");

    if (context.outputThread) {
      debug("Terminating outputThread");
      context.outputThread.terminate();
      blockingNative.killIOPump(context.t_ptrS);
    }

    // this might take 100ms on OSX...
    blockingNative.killDeviceLoop();
    debug("killDevAck received");
    // this ioWorker writes to the die_fd which wakes of the fdevent_loop which will then die and return to JS
    let res = blockingNative.writeFully(server_die_fd, "ctypes.int(0xDEAD)", 4);
    debug("Finished writing to die_fd ret=" + JSON.stringify(res));
    blockingNative.cleanupNativeCode();
    context.__workers.forEach(function(w) {
      debug("Killing Worker: " + w.tag)
      w.terminate();
    });
    debug("ALL workers are terminated");
    let t1 = Date.now();
    debug("Closing took: " + (t1 - t0) + "ms");
  }
};

function restart_helper() {
  context.restart = exports.restart;
}

exports.restart = function restart() {
  exports.close();

  timers.setTimeout(function timeout() {
    server_die_fd = null;
    context = { __workers: [], // this array is populated automatically by EventedChromeWorker
                platform: platform,
                driversPath: driversPath,
                libPath: libPath
              };
    restart_helper();

    deviceTracker.reset();
    fileTransfer.reset();
    commandRunner.reset();
    blockingNative.reset();

    exports._startAdbInBackground();
  }, 200);
};
restart_helper();

exports._startAdbInBackground = function startAdbInBackground() {
  this.ready = true;

  blockingNative.init(libPath, driversPath);
  serverWorker = new EventedChromeWorker(WORKER_URL_SERVER, "server_thread", context);
  ioWorker = new EventedChromeWorker(WORKER_URL_IO, "io_thread", context);
  utilWorker = new EventedChromeWorker(WORKER_URL_UTIL, "util_thread", context);

  serverWorker.emit("init", { libPath: libPath }, function initack() {
    serverWorker.emit("start", { port: 5037 }, function started(res) {
      debug("Started adb: " + res.result);
    });
  });

  serverWorker.onceAndForget("kill-server-fd", function({ fd }) {
    server_die_fd = fd;
  });
  serverWorker.onceAndForget("track-ready", function trackack() {
    deviceTracker.start();
  });

  [ioWorker, utilWorker].forEach(function initworker(w) {
    w.emit("init", { libPath: libPath,
                     driversPath: context.driversPath,
                     platform: context.platform }, function initack() {
      debug("Inited worker");
    });
  });
};

