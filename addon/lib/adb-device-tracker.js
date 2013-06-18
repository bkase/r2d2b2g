/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * A module to track device changes
 * Mostly from original `adb.js`
 */

'use strict';

const { Cc, Ci, Cr, Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { AdbClient } = require("adb-client");

let { TextDecoder } = Cu.import("resource://gre/modules/Services.jsm");

function debug() {
  console.log.apply(console, ["AdbDeviceTracker: "].concat(Array.prototype.slice.call(arguments, 0)));
}

let AdbDeviceTracker = Class({
  implements: [ AdbClient ],
  initialize: function initialize(cb) {
    AdbClient.prototype.initialize.call(this);
    // TODO: Use something else besides callbacks for changes (observers?)
    this._cb = cb;

    this._waitForFirst = true;
    this._devices = { };
    this._startTrackingDevices();
  },

  _startTrackingDevices: function startTrackingDevices() {
    let socket = this._connect();
    socket.onopen = (function() {
      debug("trackDevices onopen");
      // Services.obs.notifyObservers(null, "adb-track-devices-start", null);
      let req = this._createRequest("host:track-devices");
      this._sockSend(socket, req);
    }).bind(this);

    socket.onerror = (function(event) {
      debug("trackDevices onerror: " + event.data);
      // this._cb({ topic: "adb-track-devices-stop" });
      // Services.obs.notifyObservers(null, "adb-track-devices-stop", null);
    }).bind(this);
    
    socket.onclose = (function() {
      debug("trackDevices onclose");
      // Services.obs.notifyObservers(null, "adb-track-devices-stop", null);
    }).bind(this);

    socket.ondata = (function(aEvent) {
      debug("trackDevices ondata");
      let data = aEvent.data;
      debug("length=" + data.byteLength);
      let dec = new TextDecoder();
      debug(dec.decode(new Uint8Array(data)).trim());

      // check the OKAY or FAIL on first packet.
      if (this._waitForFirst) {
        if (!this._checkResponse(data)) {
          socket.close();
          return;
        }
      }

      let packet = this._unpackPacket(data, !this._waitForFirst);
      this._waitForFirst = false;

      if (packet.data == "") {
        // All devices got disconnected.
        for (let dev in this._devices) {
          this._devices[dev] = false;
          this._cb({ topic: "adb-device-disconnected", dev: dev });
          // Services.obs.notifyObservers(null, "adb-device-disconnected", dev);
        }
      } else {
        // One line per device, each line being $DEVICE\t(offline|device)
        let lines = packet.data.split("\n");
        let newDev = {};
        lines.forEach(function(aLine) {
          if (aLine.length == 0) {
            return;
          }

          let [dev, status] = aLine.split("\t");
          newDev[dev] = status !== "offline";
        });
        // Check which device changed state.
        for (let dev in newDev) {
          if (this._devices[dev] != newDev[dev]) {
            if (dev in this._devices || newDev[dev]) {
              let topic = newDev[dev] ? "adb-device-connected"
                                      : "adb-device-disconnected";
              // Services.obs.notifyObservers(null, topic, dev);
              this._cb({ topic: topic, dev: dev });
            }
            this._devices[dev] = newDev[dev];
          }
        }
      }
    }).bind(this);
  },

});

exports.AdbDeviceTracker = AdbDeviceTracker;

