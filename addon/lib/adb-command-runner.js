/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * A module to run adb commands
 * Mostly from original `adb.js`
 */

'use strict';

const { Cu, Cc, Ci } = require("chrome");

const Promise = require("sdk/core/promise");
const { Class } = require("sdk/core/heritage");
const { AdbClient } = require("adb-client");

function debug() {
  console.log.apply(console, ["AdbCommandRunner: "].concat(Array.prototype.slice.call(arguments, 0)));
}

let AdbCommandRunner = Class({
  implements: [ AdbClient ],
  initialize: function initialize() {
    AdbClient.prototype.initialize.call(this);
  },

  devices: function devices() {
    debug("devices");
    let deferred = Promise.defer();

    let promise = this._runCommand("host:devices");

    return promise.then(
      function onSuccess(data) {
        let lines = data.split("\n");
        let res = [];
        lines.forEach(function(aLine) {
          if (aLine.length == 0) {
            return;
          }
          let [device, status] = aLine.split("\t");
          res.push([device, status]);
        });
        return res;
      }
    );
  },

  _runCommand: function runCommand(aCommand) {
    debug("runCommand " + aCommand);
    let deferred = Promise.defer();

    let socket = this._connect();
    let waitForFirst = true;
    let devices = {};

    socket.onopen = function() {
      debug("runCommand onopen");
      let req = this._createRequest(aCommand);
      this._sockSend(socket, req);

    }.bind(this);

    socket.onerror = function() {
      debug("runCommand onerror");
      deferred.reject("NETWORK_ERROR");
    }

    socket.onclose = function() {
      debug("runCommand onclose");
    }

    socket.ondata = function(aEvent) {
      debug("runCommand ondata");
      let data = aEvent.data;

      if (!this._checkResponse(data)) {
        socket.close();
        let packet = this._unpackPacket(data, false);
        debug("Error: " + packet.data);
        deferred.reject("PROTOCOL_ERROR");
        return;
      }

      let packet = this._unpackPacket(data, false);
      deferred.resolve(packet.data);
    }.bind(this);


    return deferred.promise;
  }
});

exports.AdbCommandRunner = AdbCommandRunner;

