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

const EventedChromeWorker = require("evented-chrome-worker").EventedChromeWorker;
const AdbDeviceTracker = require("adb-device-tracker").AdbDeviceTracker;
const AdbFileTransfer = require("adb-file-transfer").AdbFileTransfer;
const AdbCommandRunner = require("adb-command-runner").AdbCommandRunner;
const timers = require("timers");
const URL = require("url");
const self = require("self");
const { platform } = require("system");

let serverWorker, ioWorker, utilWorker;
// the context is used as shared state between EventedChromeWorker runOnPeerThread calls and this module
let context = { __workers: [] // this array is populated automatically by EventedChromeWorker
              };

console.log("Platform: " + platform);
let dll = (platform === "winnt") ? ".dll" : ".so";
let libPath = URL.toFilename(self.data.url("libadb" + dll));
// let libPath = "c:\\users\\bkase\\documents\\visual studio 2012\\Projects\\AdbLib\\Debug\\AdbLib.dll";

const DEVICE_NOT_CONNECTED = "Device not connected";
exports.DEVICE_NOT_CONNECTED = DEVICE_NOT_CONNECTED;

let hasDevice = false;

let server_die_fd = null;

let adbClients;
exports.startAdbInBackground = function(deviceTrackerCb) {
  adbClients = [];

  serverWorker = new EventedChromeWorker(WORKER_URL_SERVER, "server_thread", context);
  ioWorker = new EventedChromeWorker(WORKER_URL_IO, "io_thread", context);
  utilWorker = new EventedChromeWorker(WORKER_URL_UTIL, "util_thread", context);

  serverWorker.emit("init", { libPath: libPath }, function initack() {
    serverWorker.emit("start", { port: 5037 }, function started(res) {
      console.log("Started adb: " + res.result);
    });
  });

  serverWorker.onceAndForget("kill-server-fd", function({ fd }) {
    server_die_fd = fd;
  });

  timers.setTimeout(function() {
    trackDevices(function(data) {
      console.log("Tracked device in init: " + JSON.stringify(data));
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


  [ioWorker, utilWorker].forEach(function(w) w.emit("init", { libPath: libPath }, function initack() {
    console.log("Inited worker");
  }));
};

function trackDevices(cb) {
  let adbDeviceTracker = new AdbDeviceTracker(cb);
  adbClients.push(adbDeviceTracker);
};

function stopTrackingDevices() {
  adbClients.forEach(function(c) c instanceof AdbDeviceTracker && c.close());
};

exports.pushFile = function(srcPath, destPath) {
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
};

exports.shell = function(shellCommand) {
  let deferred = Promise.defer();
  if (!hasDevice) {
    deferred.reject(DEVICE_NOT_CONNECTED);
    return deferred.promise;
  }

  console.log("Executing: " + shellCommand);

  let service = "shell:" + shellCommand;
  let result = "";
  utilWorker.emit("query", { service: service }, function({ fd }) {
    if (fd < 0) {
      console.log("Error: fd is " + fd);
      deferred.reject("Bad file descriptor");
      return;
    }

    let msg = service + ":data";
    let idx = ioWorker.listenAndForget(msg, function({ data }) {
      result += data;
    });

    ioWorker.emit("readFully", { fd: fd, tag: service }, function({ ret }) {
      ioWorker.freeListener(msg, idx);
      deferred.resolve(result);
    });

  });

  return deferred.promise;
}

exports.listDevices = function() {
  console.log("Listing devices");
  let adbCommandRunner = new AdbCommandRunner();
  let d = adbCommandRunner.devices();
  return d.then(
      function success(e) {
        adbCommandRunner.close();
        return e;
      },
      function fail(e) {
        console.log("Failed: " + e);
        adbCommandRunner.close();
        return e;
      });
}

// TODO: Figure out a way to close leaking workers
exports.close = function(cb) {
  console.log("Closing - ");
  let x = 1;
  stopTrackingDevices();
  let workersToClean = [serverWorker, ioWorker, utilWorker];
  timers.setTimeout(function() {

    // NOTE: the output thread should be manually terminated, the input thread 
    //       will be terminated safely by the kill-ioPump message to 
    //       the util worker
    context.outputThread.terminate();
    utilWorker.emit("kill-ioPump", { t_ptrS: context.t_ptrS }, function killIOAck() {
      // NOTE: this call will return immediately for now, but it needs at most 100ms to close
      utilWorker.emit("kill-deviceLoop", { }, function killDevAck() {
        // this ioWorker writes to the die_fd which wakes of the fdevent_loop which will then die and return to JS
        ioWorker.emit("writeFully", { fd: server_die_fd }, function writeAck(err) {
          console.log("Finished writing to die_fd ret=" + JSON.stringify(err));
          timers.setTimeout(function() {
            workersToClean.forEach(function(w) {
              w.emit("cleanup", null, function cleaned() {
                w.terminate();
                console.log("Closed successfully");
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
      context.__workers.forEach(function([w, logi]) {
        console.log("Killing Worker: " + w.tag) 
        w.freeListener("log", logi);
        w.terminate();
      });
      console.log("ALL workers are terminated");
      cb();
    }
  }
};

