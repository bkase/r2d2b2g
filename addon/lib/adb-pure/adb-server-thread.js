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
const ADB_TYPES = URL_PREFIX + "adb-types.js";

const WORKER_URL_IO_THREAD_SPAWNER = URL_PREFIX + "adb-io-thread-spawner.js";
const WORKER_URL_DEVICE_POLL = URL_PREFIX + "adb-device-poll-thread.js";

importScripts(INSTANTIATOR_URL, EVENTED_CHROME_WORKER_URL, CONSOLE_URL, ADB_TYPES);

const worker = new EventedChromeWorker(null);
const console = new Console(worker);

function debug() {
  console.log.apply(console, ["AdbServerThread: "].concat(Array.prototype.slice.call(arguments, 0)));
}

let I = null;
let libadb = null;
worker.once("init", function({ libPath }) {

  I = new Instantiator();

  libadb = ctypes.open(libPath);

  I.declare({ name: "main_server",
              returns: ctypes.int,
              // server_port
              args: [ struct_adb_main_input.ptr ]
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

  let onTrackReadyfn = function onTrackReady() {
    console.log("onTrackReady");
    worker.emitAndForget("track-ready", { });
  };

  input.contents.on_track_ready =
    ctypes.FunctionType(ctypes.default_abi, ctypes.void_t, []).ptr(onTrackReadyfn);

  let spawnIOfn = function spawnIO(t_ptr) {
    debug("spawnIO was called from C, with voidPtr: " + t_ptr.toString());
    worker.runOnPeerThread(function spawnIO_task(t_ptr_strS, workerURIS) {
      let [t_ptr_str, workerURI] = [JSON.parse(t_ptr_strS), JSON.parse(workerURIS)];

      let inputThread = this.newWorker(workerURI, "input_thread");
      inputThread.emitAndForget("init",
        { libPath: context.libPath,
          threadName: "device_input_thread",
          argTypesStrings: ["atransport.ptr"],
          argStrings: [t_ptr_str],
          platform: context.platform,
          driversPath: context.driversPath
        });

      let outputThread = this.newWorker(workerURI, "output_thread");
      outputThread.emitAndForget("init",
        { libPath: context.libPath,
          threadName: "device_output_thread",
          argTypesStrings: ["atransport.ptr"],
          argStrings: [t_ptr_str],
          platform: context.platform,
          driversPath: context.driversPath
        });

      this.context.outputThread = outputThread;
      this.context.t_ptrS = t_ptr_str;

    }, t_ptr.toString(), WORKER_URL_IO_THREAD_SPAWNER);
  };

  input.contents.spawnIO = ctypes.FunctionType(ctypes.default_abi, ctypes.int, [atransport.ptr]).ptr(spawnIOfn);


  // NOTE: on linux this will not be called
  let spawnDfn = function() {
    debug("spawnD was actually called from C!!!");
    worker.runOnPeerThread(function spawnD_task(workerURIS) {
      let [workerURI] = [JSON.parse(workerURIS)]

      let devicePollWorker = this.newWorker(workerURI, "device_poll_thread");
      devicePollWorker.emitAndForget("init", { libPath: context.libPath, driversPath: context.driversPath, platform: context.platform });

    }, WORKER_URL_DEVICE_POLL);
  };

  input.contents.spawnD = ctypes.FunctionType(ctypes.default_abi, ctypes.int).ptr(spawnDfn);



  let pipe = ctypes.ArrayType(ctypes.int, 2)();
  I.use("socket_pipe")(pipe);
  worker.emitAndForget("kill-server-fd", { fd: pipe[0] });

  input.contents.exit_fd = pipe[1];
  // NOTE: this will loop forever (until signal-ed)
  let x = main(input);
  debug("Main returned; " + x);
  return { ret: x };
});

worker.listen("cleanup", function() {
  debug("Cleaning up");
  if (libadb) {
    libadb.close();
  }
});

