/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * A module to track device changes
 * Mostly from original `adb.js`
 */

'use strict';

const { Cu, Cc, Ci } = require("chrome");

const Promise = require("sdk/core/promise");
const { Class } = require("sdk/core/heritage");
const { AdbClient } = require("adb-client");
let { TextEncoder, TextDecoder } = Cu.import("resource://gre/modules/Services.jsm");
/* const OS = */ Cu.import("resource://gre/modules/osfile.jsm");

function debug() {
  console.log.apply(console, ["AdbFileTransfer: "].concat(Array.prototype.slice.call(arguments, 0)));
}

let AdbFileTransfer = Class({
  implements: [ AdbClient ],
  initialize: function initialize() {
    AdbClient.prototype.initialize.call(this);
  },

  // pushes a file to the device.
  // aFrom and aDest are full paths.
  // XXX we should STAT the remote path before sending.
  pushFile: function adb_push(aFrom, aDest) {
    let deferred = Promise.defer();
    let socket;
    let state;
    let fileSize;
    let fileData;
    let remaining;
    let currentPos = 0;
    let fileTime;

    debug("pushing " + aFrom + " -> " + aDest);

    let shutdown = function() {
      debug("push shutdown");
      socket.close();
      deferred.reject("BAD_RESPONSE");
    }

    let runFSM = (function runFSM(aData) {
      debug("runFSM " + state);
      let req;
      switch(state) {
        case "start":
          state = "send-transport";
          runFSM.call(this);
          break;
        case "send-transport":
          req = this._createRequest("host:transport-any");
          this._sockSend(socket, req);
          state = "wait-transport";
          break
        case "wait-transport":
          if (!this._checkResponse(aData)) {
            shutdown();
            return;
          }
          debug("transport: OK");
          state = "send-sync";
          runFSM.call(this);
          break
        case "send-sync":
          req = this._createRequest("sync:");
          this._sockSend(socket, req);
          state = "wait-sync";
          break
        case "wait-sync":
          if (!this._checkResponse(aData)) {
            shutdown();
            return;
          }
          debug("sync: OK");
          state = "send-send";
          runFSM.call(this);
          break
        case "send-send":
          // need to send SEND + length($aDest,$fileMode)
          // $fileMode is not the octal one there.
          let encoder = new TextEncoder();

          let (infoLengthPacket = new Uint32Array(1), info = aDest + ",33204") {
            infoLengthPacket[0] = info.length;
            this._sockSend(socket, encoder.encode("SEND"));
            this._sockSend(socket, infoLengthPacket);
            this._sockSend(socket, encoder.encode(info));
          }

          // now sending file data.
          while (remaining > 0) {
            let toSend = remaining > 65536 ? 65536 : remaining;
            debug("Sending " + toSend + " bytes");

            let dataLengthPacket = new Uint32Array(1);
            // We have to create a new ArrayBuffer for the fileData slice
            // because nsIDOMTCPSocket (or ArrayBufferInputStream) chokes on
            // reused buffers, even when we don't modify their contents.
            let dataPacket = new Uint8Array(new ArrayBuffer(toSend));
            dataPacket.set(new Uint8Array(fileData.buffer, currentPos, toSend));
            dataLengthPacket[0] = toSend;
            this._sockSend(socket, encoder.encode("DATA"));
            this._sockSend(socket, dataLengthPacket);
            this._sockSend(socket, dataPacket);

            currentPos += toSend;
            remaining -= toSend;
          }

          // Ending up with DONE + mtime (wtf???)
          let (fileTimePacket = new Uint32Array(1)) {
            fileTimePacket[0] = fileTime;
            this._sockSend(socket, encoder.encode("DONE"));
            this._sockSend(socket, fileTimePacket);
          }

          state = "wait-done";
          break;
        case "wait-done":
          if (!this._checkResponse(aData)) {
            shutdown();
            return;
          }
          debug("DONE: OK");
          state = "end";
          runFSM.call(this);
          break;
        case "end":
          socket.close();
          deferred.resolve("SUCCESS");
          break;
        default:
          debug("push Unexpected State: " + state);
          deferred.reject("UNEXPECTED_STATE");
      }
    }).bind(this);

    let setupSocket = (function() {
      socket.onerror = (function(aEvent) {
        debug("push onerror");
        deferred.reject("SOCKET_ERROR");
      }).bind(this);

      socket.onopen = (function(aEvent) {
        debug("push onopen");
        state = "start";
        runFSM();
      }).bind(this);

      socket.onclose = (function(aEvent) {
        debug("push onclose");
      }).bind(this);

      socket.ondata = (function(aEvent) {
        debug("push ondata");
        runFSM(aEvent.data);
      }).bind(this);
    }).bind(this);

    // Stat the file, get its size.
    let promise = OS.File.stat(aFrom);
    promise = promise.then(
      (function onSuccess(stat) {
        if (stat.isDir) {
          // The path represents a directory
          deferred.reject("CANT_PUSH_DIR");
        } else {
          // The path represents a file, not a directory
          fileSize = stat.size;
          // We want seconds since epoch
          fileTime = stat.lastModificationDate.getTime() / 1000;
          remaining = fileSize;
          debug(aFrom + " size is " + fileSize);
          let readPromise = OS.File.read(aFrom);
          readPromise.then(
            (function readSuccess(aData) {
              fileData = aData;
              socket = this._connect();
              setupSocket();
            }).bind(this),
            (function readError() {
              deferred.reject("READ_FAILED");
            }).bind(this)
          );
        }
      }).bind(this),

      function onFailure(reason) {
        debug(reason);
        deferred.reject("CANT_ACCESS_FILE");
      }
    );

    return deferred.promise;
  }
  // TODO pull
});

exports.AdbFileTransfer = AdbFileTransfer;

