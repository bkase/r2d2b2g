/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * A module to track device changes
 * Mostly from original `adb.js`
 */

'use strict';

const { Cu, Cc, Ci } = require("chrome");
const { Class } = require("sdk/core/heritage");

Cu.import("resource://gre/modules/Services.jsm");

const OLD_SOCKET_API =
  Services.vc.compare(Services.appinfo.platformVersion, "23.0a1") < 0;

let { TextEncoder, TextDecoder } = Cu.import("resource://gre/modules/Services.jsm");

function debug() {
  console.log.apply(console, ["AdbClient: "].concat(Array.prototype.slice.call(arguments, 0)));
}

let AdbClient = Class({
  initialize: function initialize() {
    Services.prefs.setBoolPref("dom.mozTCPSocket.enabled", true);

    this._sockets = [ ];
  },

  // @param aPacket         The packet to get the length from.
  // @param aIgnoreResponse True if this packet has no OKAY/FAIL.
  // @return                A js object { length:...; data:... }
  _unpackPacket: function adb_unpackPacket(aPacket, aIgnoreResponse) {
    let buffer = OLD_SOCKET_API ? aPacket.buffer : aPacket;
    let lengthView = new Uint8Array(buffer, aIgnoreResponse ? 0 : 4, 4);
    let decoder = new TextDecoder();
    let length = parseInt(decoder.decode(lengthView), 16);
    let text = new Uint8Array(buffer, aIgnoreResponse ? 4 : 8, length);
    return { length: length, data: decoder.decode(text) };
  },

  // Checks if the response is OKAY or FAIL.
  // @return true for OKAY, false for FAIL.
  _checkResponse: function adb_checkResponse(aPacket) {
    const OKAY = 0x59414b4f; // OKAY
    const FAIL = 0x4c494146; // FAIL
    let buffer = OLD_SOCKET_API ? aPacket.buffer : aPacket;
    let view = new Uint32Array(buffer, 0 , 1);
    if (view[0] == FAIL) {
      debug("Response: FAIL");
    }
    return view[0] == OKAY;
  },

  // @param aCommand A protocol-level command as described in
  //  http://androidxref.com/4.0.4/xref/system/core/adb/OVERVIEW.TXT and
  //  http://androidxref.com/4.0.4/xref/system/core/adb/SERVICES.TXT
  // @return A 8 bit typed array.
  _createRequest: function adb_createRequest(aCommand) {
    let length = aCommand.length.toString(16).toUpperCase();
    while(length.length < 4) {
      length = "0" + length;
    }

    let encoder = new TextEncoder();
    debug("Created request: " + length + aCommand);
    return encoder.encode(length + aCommand);
  },

  /**
   * Dump the first few bytes of the given array to the console.
   *
   * @param {TypedArray} aArray
   *        the array to dump
   */
  _hexdump: function adb_hexdump(aArray) {
    let decoder = new TextDecoder("windows-1252");
    let array = new Uint8Array(aArray.buffer);
    let s = decoder.decode(array);
    let len = array.length;
    let dbg = "len=" + len + " ";
    let l = len > 20 ? 20 : len;

    for (let i = 0; i < l; i++) {
      let c = array[i].toString(16);
      if (c.length == 1)
        c = "0" + c;
      dbg += c;
    }
    dbg += " ";
    for (let i = 0; i < l; i++) {
      let c = array[i];
      if (c < 32 || c > 127) {
        dbg += ".";
      } else {
        dbg += s[i];
      }
    }
    debug(dbg);
  },

  // debugging version of tcpsocket.send()
  _sockSend: function adb_sockSend(aSocket, aArray) {
    this._hexdump(aArray);

    if (OLD_SOCKET_API) {
      // Create a new Uint8Array in case the array we got is of a different type
      // (like Uint32Array), since the old API takes a Uint8Array.
      aSocket.send(new Uint8Array(aArray.buffer));
    } else {
      aSocket.send(aArray.buffer, aArray.byteOffset, aArray.byteLength);
    }
  },

  // Creates a socket connected to the adb instance.
  // This function is sync, and returns before we know if opening the
  // connection succeeds. Callers must attach handlers to the socket.
  _connect: function adb_connect() {
    let TCPSocket = Cc["@mozilla.org/tcp-socket;1"]
                      .createInstance(Ci.nsIDOMTCPSocket);
    let socket = TCPSocket.open(
     "127.0.0.1", 5037,
     { binaryType: "arraybuffer" });
    this._sockets.push(socket);
    return socket;
  },

  close: function() {
    this._sockets.forEach(function(s) {
      console.log("&&&& READY STATE: " + s.readyState);
      if (s.readyState === "open" || s.readyState === "connecting") {
        s.close();
      }
    });
  }
});

exports.AdbClient = AdbClient;

