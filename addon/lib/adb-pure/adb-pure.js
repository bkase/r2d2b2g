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
const AdbDeviceTracker = require("adb-pure/adb-device-tracker").AdbDeviceTracker;
const AdbFileTransfer = require("adb-pure/adb-file-transfer").AdbFileTransfer;
const AdbCommandRunner = require("adb-pure/adb-command-runner").AdbCommandRunner;
const timers = require("timers");
const URL = require("url");
const env = require("api-utils/environment").env;
const file = require("file");
const subprocess = require("subprocess");
const self = require("self");
const { platform } = require("system");

Cu.import("resource://gre/modules/Services.jsm");

let serverWorker, ioWorker, utilWorker;

let dll = (platform === "winnt") ? ".dll" : ".so";
let libPath = URL.toFilename(self.data.url("libadb" + dll));
let driversPath = (platform === "winnt") ? URL.toFilename(self.data.url("win32/AdbWinApi.dll")) : null;

// the context is used as shared state between EventedChromeWorker runOnPeerThread calls and this module
let context = { __workers: [], // this array is populated automatically by EventedChromeWorker
                platform: platform,
                driversPath: driversPath,
                libPath: libPath
              };

const DEVICE_NOT_CONNECTED = "Device not connected";
exports.DEVICE_NOT_CONNECTED = DEVICE_NOT_CONNECTED;

let hasDevice = false;

let server_die_fd = null;

let adbClients;

let ready = false;
let didRunInitially = false;
const psRegexNix = /.*? \d+ .*? .*? \d+\s+\d+ .*? .*? .*? .*? adb .*fork\-server/;
const psRegexWin = /adb.exe.*/;

function debug() {
  console.log.apply(console, ["AdbPure: "].concat(Array.prototype.slice.call(arguments, 0)));
}

function trackDevices(cb) {
  let adbDeviceTracker = new AdbDeviceTracker(cb);
  adbClients.push(adbDeviceTracker);
}

function stopTrackingDevices() {
  adbClients.forEach(function(c) c instanceof AdbDeviceTracker && c.close());
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

module.exports = {
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
        this._startAdbInBackground(function(data) {
          if (data.topic === "adb-device-connected") {
            Services.obs.notifyObservers(null, data.topic, data.dev);
          } else if (data.topic === "adb-device-disconnected") {
            Services.obs.notifyObservers(null, data.topic, data.dev);
          }
        });

      }).bind(this));
  },
  _startAdbInBackground: function startAdbInBackground(deviceTrackerCb) {
    adbClients = [];
    this.ready = true;

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
    timers.setTimeout(function() {
      trackDevices(function(data) {
        debug("Tracked device in init: " + JSON.stringify(data));
        if (data.topic === "adb-device-disconnected") {
          hasDevice = false;
        } else if (data.topic === "adb-device-connected") {
          hasDevice = true;
        } else {
          throw "Strange topic in device tracker";
        }
        deviceTrackerCb(data);
      });
    }, 2000);


    [ioWorker, utilWorker].forEach(function initworker(w) {
      w.emit("init", { libPath: libPath,
                       driversPath: context.driversPath,
                       platform: context.platform }, function initack() {
        debug("Inited worker");
      });
    });
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
    if (!hasDevice) {
      deferred.reject(DEVICE_NOT_CONNECTED);
      return deferred.promise;
    }

    let adbFileTransfer = new AdbFileTransfer();
    let t = adbFileTransfer.pushFile(srcPath, destPath);
    return t.then(
        function success(e) {
          adbFileTransfer.close();
          return e;
        },
        function fail(e) {
          adbFileTransfer.close();
        });
  },

  forwardPort: function forwardPort(port) {
    let deferred = Promise.defer();
    if (!hasDevice) {
      deferred.reject(DEVICE_NOT_CONNECTED);
      return deferred.promise;
    }

    // <host-prefix>:forward:<local>;<remote>
    let service = "host:forward:tcp:" + port + ";tcp:6000";

    queryService(service, deferred);

    return deferred.promise.then(
        function onSuccess(data) {
          return data;
        }
    );
  },

  shell: function shell(shellCommand) {
    let deferred = Promise.defer();
    if (!hasDevice) {
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
    let adbCommandRunner = new AdbCommandRunner();
    let d = adbCommandRunner.devices();
    return d.then(
        function success(e) {
          adbCommandRunner.close();
          return e;
        },
        function fail(e) {
          debug("Failed: " + e);
          adbCommandRunner.close();
          return e;
        });
  },

  close: function close(cb) {
    debug("Closing - ");
    let x = 1;
    stopTrackingDevices();
    debug("After stopTrackingDevices");
    let workersToClean = [serverWorker, ioWorker, utilWorker];
    timers.setTimeout(function() {

      // NOTE: the output thread should be manually terminated, the input thread
      //       will be terminated safely by the kill-ioPump message to
      //       the util worker
      debug("Terminating outputThread");
      context.outputThread.terminate();
      utilWorker.emit("kill-ioPump", { t_ptrS: context.t_ptrS }, function killIOAck() {
        debug("killIOAck received");
        // NOTE: this call will return immediately for now, but it needs at most 100ms to close on OSX
        utilWorker.emit("kill-deviceLoop", { }, function killDevAck() {
          debug("killDevAck received");
          // this ioWorker writes to the die_fd which wakes of the fdevent_loop which will then die and return to JS
          ioWorker.emit("writeFully", { fd: server_die_fd,
                                        toWriteS: "ctypes.int(0xDEAD)",
                                        length: 4
                                      }, function writeAck(err) {
            debug("Finished writing to die_fd ret=" + JSON.stringify(err));
            timers.setTimeout(function() {
              workersToClean.forEach(function(w) {
                w.emit("cleanup", null, function cleaned() {
                  w.terminate();
                  debug("Closed successfully");
                  waitForAll(x++);
                });
              });
            }, 1000);
          });
        });
      });
    }, 1000);

    function waitForAll(x) {
      if (x >= workersToClean.length) {
        context.__workers.forEach(function(w) {
          debug("Killing Worker: " + w.tag)
          w.terminate();
        });
        debug("ALL workers are terminated");
        cb();
      }
    }
  }
};

