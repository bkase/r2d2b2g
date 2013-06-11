/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

// depends on: EventedChromeWorker
;(function(exports) {

  function Console(worker) {
    this._worker = worker;
  }
  Console.prototype.log = function() {
    this._worker.emitAndForget("log", Array.prototype.slice.call(arguments, 0));
  };

  exports.Console = Console;
}).apply(null,
  typeof module !== 'undefined' ?
       [exports] : [this]);

