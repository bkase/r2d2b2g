/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { Cc, Ci, Cr, Cu, ChromeWorker } = require("chrome");

const URL_PREFIX = module.uri.replace(/adb\-pure\.js/, "");
const WORKER_URL_SERVER = URL_PREFIX + "adb-server-thread.js";
const EventedChromeWorker = require("evented-chrome-worker").EventedChromeWorker;
const AdbDeviceTracker = require("adb-device-tracker").AdbDeviceTracker;
const AdbFileTransfer = require("adb-file-transfer").AdbFileTransfer;
const timers = require("timers");
const URL = require("url");
const self = require("self");

let serverWorker;
let adbClients;
let libPath = URL.toFilename(self.data.url("libadb.so"));

exports.startAdbInBackground = function() {
  adbClients = [];
  serverWorker = new EventedChromeWorker(WORKER_URL_SERVER, true);
  serverWorker.listenAndForget("log", function log(args) {
    console.log("Server Log: " + JSON.stringify(args));
  });

  serverWorker.emit("init", { libPath: libPath }, function initack() {
    serverWorker.emit("start", { port: 5037 }, function started(res) {
      console.log("Started adb: " + res.result);
    });
  });
};

exports.trackDevices = function(cb) {
  let adbDeviceTracker = new AdbDeviceTracker(function(data) {
    console.log("Tracked device: " + JSON.stringify(data));
    // at least one thing happened
    cb();
  });
  adbClients.push(adbDeviceTracker);
};

exports.stopTrackingDevices = function() {
  adbClients.forEach(function(c) c instanceof AdbDeviceTracker && c.close());
};

exports.pushFile = function(srcPath, destPath) {
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

exports.close = function(cb) {
  console.log("Closing - ");
  timers.setTimeout(function() {
    serverWorker.emit("cleanup", null, function cleaned() {
      serverWorker.terminate();
      console.log("Closed successfully");
      cb();
    });
  }, 100);
};

