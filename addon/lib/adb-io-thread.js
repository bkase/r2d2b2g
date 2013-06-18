/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * The IO worker
 */


const URL_PREFIX = self.location.href.replace(/adb\-io\-thread\.js/, "");
const INSTANTIATOR_URL = URL_PREFIX + "ctypes-instantiator.js";
const EVENTED_CHROME_WORKER_URL = URL_PREFIX + "evented-chrome-worker.js";
const CONSOLE_URL = URL_PREFIX + "worker-console.js";

importScripts(INSTANTIATOR_URL, EVENTED_CHROME_WORKER_URL, CONSOLE_URL);

const worker = new EventedChromeWorker(null, false);
const console = new Console(worker);

let I = null;
let libadb = null;
worker.listen("init", function({ libPath }) {
  I = new Instantiator();

  libadb = ctypes.open(libPath);

  I.declare({ name: "read_fd",
              returns: ctypes.int,
              // fd, buffer, size
              args: [ctypes.int, ctypes.char.ptr, ctypes.int]
            }, libadb);

  I.declare({ name: "write_fd",
              returns: ctypes.int,
              // fd, buffer, size
              args: [ctypes.int, ctypes.char.ptr, ctypes.int]
            }, libadb);
});

worker.listen("readFully", function({ fd, tag }) {
  let read = I.use("read_fd");
  let size = 4096;
  let buffer = new ctypes.ArrayType(ctypes.char, 4096)();

  console.log("Buffer constructed successfully");
  while (true) {
    let len = read(fd, buffer, size-1);
    buffer[len] = 0; // null-terminate the string

    // TODO: we don't need done events, just return and the callback will fire
    if (len == 0) {
      worker.emitAndForget(tag + ":done", { });
      break;
    } else {
      worker.emitAndForget(tag + ":data", { data: buffer.readString() });
    }
  }

  return 0;
});

// TODO: don't hardcode
worker.listen("writeFully", function({ fd /*, toWriteS*/ }) {
  let write = I.use("write_fd");
  let len = 4;
  let num = ctypes.int(0xDEAD);
  let buffer = ctypes.cast(num.address(), ctypes.char.ptr);
  let r;

  // console.log("fd: " + fd + ", buf: " + buffer + " len: " + len);
  while(len > 0) {
    r = write(fd, buffer, len);
    if(r > 0) {
      len -= r;
      buffer += r;
    } else {
      if (r < 0) {
        console.log("writex error");
        return { ret: -1 };
      }
    }
  }

  return { ret: 0 };
});

worker.listen("cleanup", function() {
  console.log("IO: Cleaning up");
  if (libadb) {
    libadb.close();
  }
});

