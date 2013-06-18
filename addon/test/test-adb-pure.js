const adb = require("adb-pure");
const timer = require("timer");
const Promise = require("sdk/core/promise");
const { Cu } = require("chrome");
/* const OS = */ Cu.import("resource://gre/modules/osfile.jsm");
const { rootURI: ROOT_URI } = require('@loader/options');
const TEST_URI = ROOT_URI + "resources/r2d2b2g/tests/";
const URL = require("url");

const file = require("sdk/io/file");

let isPhonePluggedIn = null;

// Before all
adb.startAdbInBackground(function(data) {
  if (data.topic === "adb-device-disconnected") {
    isPhonePluggedIn = false;
  } else if (data.topic === "adb-device-connected") {
    isPhonePluggedIn = true;
  } else {
    throw "Strange topic in device tracker";
  }
});

console.log();
console.log("***************************************");
console.log("***************************************");
console.log("*   START TEST WITH PHONE UNPLUGGED   *");
console.log("***************************************");
console.log("***************************************");
console.log();

exports["test a list devices"] = function(assert, done) {
  // Give adb 2 seconds to startup
  timer.setTimeout(function() {
    adb.listDevices().then(
      function success(e) {
        isPhonePluggedIn = (e.length > 0);
        if (isPhonePluggedIn) {
          assert.ok(false, "Unplug your phone before starting the test bench");
          done();
          return;
        }
        assert.ok(true, "Devices: " + JSON.stringify(e));
        done();
      },
      function fail(e) {
        assert.ok(false, "Failed to list devices: " + JSON.stringify(e));
        done();
      });
  }, 2000);
};

exports["test b adb.shell, no phone"] = function (assert, done) {
  let command = "ls";
  adb.shell(command).then(
      function success(output) {
        assert.ok(false, "Should reject promise when phone unplugged");
        done();
      },
      function fail(e) {
        assert.ok(e, adb.DEVICE_NOT_CONNECTED, "Error wasn't DEVICE_NOT_CONNECTED");
        done();
      });
};

exports["test c adb push, no phone"] = function (assert, done) {
  let str = "astring" + Math.random();
  let filename = "no-test.txt";
  let pathToFile = URL.toFilename(TEST_URI + "/" + filename);
  let writer = file.open(pathToFile, "w");
  writer.write(str);
  writer.close();

  adb.pushFile(pathToFile,
               "/sdcard/test.txt").then(
    function success(e) {
      assert.ok(false, "Should reject promise when phone unplugged");
      done();
    },
    function fail(e) {
      assert.ok(e, adb.DEVICE_NOT_CONNECTED, "Error wasn't DEVICE_NOT_CONNECTED");
      done();
    });
};

exports["test d plug phone back in"] = function(assert, done) {
  console.log();
  console.log("***************************************");
  console.log("***************************************");
  console.log("**********   PLUG IN PHONE   **********");
  console.log("***************************************");
  console.log("***************************************");
  console.log();

  /*let i = 0;
  (function loop() {
    timer.setTimeout(function() {
      console.log(i++);
      if (i >= 5) {
        assert.ok(true, "hack plugged");
        done();
      } else {
        loop();
      }
    }, 1000);
  })();*/
 (function loop() {
    timer.setTimeout(function() {
      if (!isPhonePluggedIn) {
        loop();
      } else {
        assert.ok(true, "Plugged in phone");
        done();
      }
    }, 50);
  })();
};

exports["test e adb shell, with phone"] = function (assert, done) {
  let command = "ls";
  console.log("Running adb shell");
  adb.shell(command).then(
    function success(output) {
      assert.ok(output.split('\n').length > 7, "Recieved `ls` output");
      done();
    },
    function fail(e) {
      assert.ok(false, "Shell failed: " + JSON.stringify(e));
      done();
    });
};

exports["test f adb push, with phone"] = function (assert, done) {
  let str = "astring" + Math.random();
  let filename = "no-test.txt";
  let pathToFile = URL.toFilename(TEST_URI + "/" + filename);
  let writer = file.open(pathToFile, "w");
  writer.write(str);
  writer.close();

  adb.pushFile(pathToFile,
               "/sdcard/test.txt").then(
    function success(e) {
      adb.shell("cat /sdcard/test.txt").then(
        function success(e) {
          assert.equal(e, str, "Contents of file on host: " + e + " should be same on device: " + str);
          done();
        },
        function fail(e) {
          console.log("Error: " + e);
          assert.ok(false, "Error catting");
          done();
        });
    },
    function fail(e) {
      assert.ok(false, "Error pushing: " + e);
      done();
    });
};

exports["test zz after"] = function(assert, done) {
  console.log("AFTER!");
  adb.close(function() {
    assert.ok(true, "Done!");
    done();
  });
};

require("test").run(exports);

