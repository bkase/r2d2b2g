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
    _zipWithIndex: function zipWithIndex(a) {
      let i = 0;
      return a.map(function(x) [x, i++]);
    },

    unravel: function unravel(/* types */) {
      let types = Array.prototype.slice.call(arguments);
      let struct_body = this._zipWithIndex(types).map(function ([type, i]) {
        let o = {};
        o["s_" + i] = type;
        return o;
      });

      const struct_type =
        new ctypes.StructType("anon", struct_body);

      let as_struct_type = ctypes.cast(this.struct_ptr, struct_type.ptr);
      return this._zipWithIndex(types)
          .map(function([,i]) as_struct_type.contents["s_" + i]);
    }
  };

  exports.JsMessage = JsMessage;

}).apply(null,
  typeof module !== 'undefined' ?
       [exports, module] : [this]);

