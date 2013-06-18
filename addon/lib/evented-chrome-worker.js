/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Evented ChromeWorker
 *
 * (a ChromeWorker with an evented
 * wrapper around the message passing)
 */

'use strict';

;(function(exports) {

  let defer, ChromeWorker;
  if (typeof module !== 'undefined') {
    ChromeWorker = require('chrome').ChromeWorker;
  }

  /*
   * context only exists on the main thread (for now)
   * it contains anything you want to be accessible in runOnPeerThread calls
   */
  function EventedChromeWorker(url, tag, context) {
    const isUIThread = !!url;
    this.tag = tag
    if (isUIThread) {
      this.context = context;
      this.worker = new ChromeWorker(url);
    } else {
      this.worker = self;
    }

    this.msgToEmitCb = { };
    this.msgToCallbacksRespond = { };
    this.msgToCallbacksFree = { };
    this._count = 0;

    this.worker.onmessage = (function(e) {
      let msg = e.data._msg;
      let count = e.data._count;

      let slug = this._slug(msg, count);
      let cb = this.msgToEmitCb[slug];
      delete e.data._msg;
      delete e.data._count;

      if (cb) {
        cb(e.data);
      } else {
        let cbs = this.msgToCallbacksRespond[msg];
        if (cbs) {
          this._callCbs(cbs, e.data, (function(res) {
              if (!res) {
                res = { };
              }
              res._msg = msg;
              res._count = count;
              this.worker.postMessage(res);
          }).bind(this));
        }

        let cbs_ = this.msgToCallbacksFree[msg];
        if (cbs_) {
          this._callCbs(cbs_, e.data, function() { });
        }
      }
    }).bind(this);

    // magic (the other half of runOnPeerThread)
    // TODO: This only works if there are 2 or more args (fix this)
    this.listenAndForget("_task", (function({ task, args }) {
      console.log("taskFn: (" + task + ")");
      console.log("args: " + args );
      let ja = JSON.parse(args);
      console.log("ja: " + ja);
      let taskFn = eval("(" + task + ")");
      return taskFn.apply(this, ja);
    }).bind(this));

    // If we are the worker
    if (!isUIThread) {
      // on the main thread
      this.runOnPeerThread(function() {
        // start a log listener
        this.listen("log", function log(args) {
          console.log.apply(console, ["Thread: "].concat(Array.prototype.slice.call(args, 0)));
        });
        // add ourselves to __workers (to be terminated later)
        this.context.__workers.push(this);
      });
    } else {

    }
  }
  EventedChromeWorker.prototype = {
    newWorker: function make(url, args) {
      console.log("this.context: " + this.context);
      return new EventedChromeWorker(url, args, this.context);
    },

    emit: function emit(msg, args, onResponse) {
      if (!onResponse) {
        throw "emit must take a callback on response, try emitAndForget";
      }
      if (!args) {
        args = {};
      }
      args._msg = msg;
      args._count = this._count;

      let slug = this._slug(msg, this._count);
      this.msgToEmitCb[slug] = onResponse;
      this._count++;

      this.worker.postMessage(args);

      return this;
    },

    emitAndForget: function emitOnce(msg, args) {
      args._msg = msg;
      this.worker.postMessage(args);

      return this;
    },

    listen: function listen(msg, cb) {
      if (!this.msgToCallbacksRespond[msg]) {
        this.msgToCallbacksRespond[msg] = [];
      }

      this.msgToCallbacksRespond[msg].push(cb);
      return this;
    },

    listenAndForget: function listenAndForget(msg, cb) {
      if (!this.msgToCallbacksFree[msg]) {
        this.msgToCallbacksFree[msg] = [];
      }

      this.msgToCallbacksFree[msg].push(cb);
      return this;
    },

    terminate: function terminate() {
      this.worker.terminate();
      return this;
    },

    runOnPeerThread: function runOnThread(task /*, serializableArgs */) {
      let serializableArgs = Array.prototype.slice.call(arguments, 1);
      let args = JSON.stringify(serializableArgs.map(JSON.stringify));

      this.emitAndForget("_task", { task: task.toString(), args: args });
    },

    _slug: function _slug(msg, count) {
      return msg + "_" + count;
    },

    _callCbs: function _callCbs(cbs, data, andThenCb) {
      for (let i = 0; i < cbs.length; i++) {
        let res = cbs[i](data);
        andThenCb(res);
      }
    }
  };

  exports.EventedChromeWorker = EventedChromeWorker;

}).apply(null,
  typeof module !== 'undefined' ?
       [exports] : [this]);

