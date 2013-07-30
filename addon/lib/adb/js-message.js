/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * JsMessage
 *
 * Takes a (void *)(struct *) from C and unpacks it properly
 */

'use strict';

;(function(exports, module) {

  if (module) {
    const { Cu } = require("chrome");
    Cu.import("resource://gre/modules/ctypes.jsm");
  }

  function JsMessage(struct_ptr) {
    this.struct_ptr = struct_ptr;
  }

  JsMessage.prototype = {
    unravel: function unravel(/* types */) {
      let types = Array.slice(arguments);
      let struct_body = types.map(function (type, i) {
        let o = {};
        o["s_" + i] = type;
        return o;
      });

      const struct_type =
        new ctypes.StructType("anon", struct_body);

      let as_struct_type = ctypes.cast(this.struct_ptr, struct_type.ptr);
      return types.map(function(unused, i) as_struct_type.contents["s_" + i]);
    }
  };

  exports.JsMessage = JsMessage;

}).apply(null,
  typeof module !== 'undefined' ?
       [exports, module] : [this]);

