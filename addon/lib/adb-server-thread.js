/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Core code
 */
const URL_PREFIX = self.location.href.replace(/adb\-server\-thread\.js/, "");
const INSTANTIATOR_URL = URL_PREFIX + "ctypes-instantiator.js";
const EVENTED_CHROME_WORKER_URL = URL_PREFIX + "evented-chrome-worker.js";
const CONSOLE_URL = URL_PREFIX + "worker-console.js";

const WORKER_URL_SIMPLE_THREAD_SPAWNER = URL_PREFIX + "adb-simple-thread-spawner.js";
const WORKER_URL_DEVICE_POLL = URL_PREFIX + "adb-device-poll-thread.js";

importScripts(INSTANTIATOR_URL, EVENTED_CHROME_WORKER_URL, CONSOLE_URL);

const worker = new EventedChromeWorker(null);
const console = new Console(worker);

let I = null;
let libadb = null;
let libPath_ = null;
const struct_adb_main_input =
  new ctypes.StructType("adb_main_input", [
    { is_daemon: ctypes.int },
    { server_port: ctypes.int },
    { is_lib_call: ctypes.int },

    { exit_fd: ctypes.int },

    // TODO: make the void_t.ptr an atransport.ptr
    { spawnIO: ctypes.FunctionType(ctypes.default_abi, ctypes.int, [ctypes.void_t.ptr]).ptr },
    { spawnD: ctypes.FunctionType(ctypes.default_abi, ctypes.int).ptr }
  ]);

console.log("Did the magic work?");
worker.once("init", function({ libPath }) {

  libPath_ = libPath;

  I = new Instantiator();

  libadb = ctypes.open(libPath);

  I.declare({ name: "main_server",
              returns: ctypes.int,
              // server_port
              args: [struct_adb_main_input.ptr]
            }, libadb);

  I.declare({ name: "malloc_",
              returns: ctypes.void_t.ptr,
              // size in bytes
              args: [ctypes.int]
            }, libadb);

  I.declare({ name: "free_",
              returns: ctypes.void_t,
              // ptr
              args: [ctypes.void_t.ptr]
            }, libadb);

  I.declare({ name: "socket_pipe",
              returns: ctypes.void_t,
              // the two ends of the pipe (sv)
              args: [ ctypes.ArrayType(ctypes.int, 2) ]
            }, libadb);
});

worker.once("start", function({ port }) {
  //let main = I.use("adb_main");
  let main = I.use("main_server");
  let malloc = I.use("malloc_");

  // struct adb_main_input *
  let input = ctypes.cast(malloc(struct_adb_main_input.size), struct_adb_main_input.ptr);

  input.contents.is_daemon = 0;
  input.contents.server_port = port;
  input.contents.is_lib_call = 1;

  let spawnIOfn = function spawnIO(t_ptr) {
    console.log("spawnIO was actually called from C!!!, with voidPtr: " + t_ptr.toString());
    worker.runOnPeerThread(function spawnIO_task(libPathS, t_ptr_strS, workerURIS) {
      let [libPath, t_ptr_str, workerURI] = [JSON.parse(libPathS), JSON.parse(t_ptr_strS), JSON.parse(workerURIS)];

      let inputThread = this.newWorker(workerURI, "input_thread");
      inputThread.emitAndForget("init",
        { libPath: libPath,
          threadName: "device_input_thread",
          argTypesStrings: ["ctypes.void_t.ptr"],
          argStrings: [t_ptr_str]
        });

      let outputThread = this.newWorker(workerURI, "output_thread");
      outputThread.emitAndForget("init",
        { libPath: libPath,
          threadName: "device_output_thread",
          argTypesStrings: ["ctypes.void_t.ptr"],
          argStrings: [t_ptr_str]
        });

      this.context.outputThread = outputThread;
      this.context.t_ptrS = t_ptr_str;

    }, libPath_, t_ptr.toString(), WORKER_URL_SIMPLE_THREAD_SPAWNER);
  };

  input.contents.spawnIO = ctypes.FunctionType(ctypes.default_abi, ctypes.int, [ctypes.void_t.ptr]).ptr(spawnIOfn);


  // NOTE: on linux this will not be called
  let spawnDfn = function() {
    console.log("spawnD was actually called from C!!!");
    worker.runOnPeerThread(function spawnD_task(libPathS, workerURIS) {
      let [libPath, workerURI] = [JSON.parse(libPathS), JSON.parse(workerURIS)]

      console.log("WORKER URI: " + workerURI);
      let devicePollWorker = this.newWorker(workerURI, "device_poll_thread");
      devicePollWorker.emitAndForget("init", { libPath: libPath });

    }, libPath_, WORKER_URL_DEVICE_POLL);
  };

  input.contents.spawnD = ctypes.FunctionType(ctypes.default_abi, ctypes.int).ptr(spawnDfn);



  let pipe = ctypes.ArrayType(ctypes.int, 2)();
  I.use("socket_pipe")(pipe);
  worker.emitAndForget("kill-server-fd", { fd: pipe[0] });

  input.contents.exit_fd = pipe[1];
  // NOTE: this will loop forever (until signal-ed)
  let x = main(input);
  console.log("Main returned; " + x);
  return { ret: x };
});

worker.listen("cleanup", function() {
  console.log("Cleaning up");
  if (libadb) {
    libadb.close();
  }
});

