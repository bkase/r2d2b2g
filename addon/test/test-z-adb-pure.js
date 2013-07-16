const adb = require("adb-pure/adb-pure");
const timer = require("timer");
const Promise = require("sdk/core/promise");
const { Cu, Ci } = require("chrome");
/* const OS = */ Cu.import("resource://gre/modules/osfile.jsm");
const { rootURI: ROOT_URI } = require('@loader/options');
const TEST_URI = ROOT_URI + "resources/r2d2b2g/tests/";
const URL = require("url");

const file = require("sdk/io/file");

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

let isPhonePluggedIn = null;

let observer = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                         Ci.nsISupportsWeakReference]),
  observe: function observe(subject, topic, data) {
    console.log("simulator.observe: " + topic);
    switch (topic) {
      case "adb-ready":
        console.log("Observed!");
        break;
      case "adb-device-connected":
        console.log("Observed!");
        isPhonePluggedIn = true;
        break;
      case "adb-device-disconnected":
        console.log("Observed!");
        isPhonePluggedIn = false;
        break;
    }
  }
};

Services.obs.addObserver(observer, "adb-device-connected", true);
Services.obs.addObserver(observer, "adb-device-disconnected", true);

// Before all
adb._startAdbInBackground();

function dumpBanner(msg) {
  let starCount = msg.length + 8;
  let starLine = '';
  for (let i = 0; i < starCount; i++) {
    starLine += '*';
  }
  let msgLine = '*   ' + msg + '   *';

  console.log();
  console.log(starLine);
  console.log(starLine);
  console.log(msgLine);
  console.log(starLine);
  console.log(starLine);
  console.log();
}

function waitUntil(trigger, andThen) {
  timer.setTimeout(function() {
    if (!trigger()) {
      waitUntil(trigger, andThen);
    } else {
      andThen();
    }
  }, 50);
}

exports["test a list devices"] = function(assert, done) {
  // Give adb 2 seconds to startup
  timer.setTimeout(function listDevices() {
    adb.listDevices().then(
      function success(e) {
        if (e[0]) {
          let [, status] = e[0];
          if (status === "offline") {
            isPhonePluggedIn = false;
            dumpBanner("DEVICE OFFLINE");
            assert.fail("device is offline");
            done();
            return;
          }
        }

        if (isPhonePluggedIn) {
          assert.pass("Devices: " + JSON.stringify(e));
          dumpBanner("DEVICE IS PLUGGED IN");
          done();
        } else {
          assert.pass("Devices: " + JSON.stringify(e));
          dumpBanner("DEVICE IS NOT PLUGGED IN");
          done();
        }
      },
      function fail(e) {
        assert.fail("Failed to list devices: " + JSON.stringify(e));
        done();
      });
  }, 2000);
};

exports["test b adb.shell, no phone"] = function (assert, done) {
  if (isPhonePluggedIn) {
    assert.pass("Skipping test");
    done();
    return;
  }

  let command = "ls";
  adb.shell(command).then(
      function success(output) {
        assert.fail("Should reject promise when phone unplugged");
        done();
      },
      function fail(e) {
        assert.ok(e, adb.DEVICE_NOT_CONNECTED, "Error wasn't DEVICE_NOT_CONNECTED");
        done();
      });
};

exports["test c adb push, no phone"] = function (assert, done) {
  if (isPhonePluggedIn) {
    assert.pass("Skipping test");
    done();
    return;
  }

  let str = "astring" + Math.random();
  let filename = "no-test.txt";
  let pathToFile = URL.toFilename(TEST_URI + "/" + filename);
  let writer = file.open(pathToFile, "w");
  writer.write(str);
  writer.close();

  adb.pushFile(pathToFile,
               "/sdcard/test.txt").then(
    function success(e) {
      assert.fail("Should reject promise when phone unplugged");
      done();
    },
    function fail(e) {
      assert.ok(e, adb.DEVICE_NOT_CONNECTED, "Error wasn't DEVICE_NOT_CONNECTED");
      done();
    });
};

exports["test d adb shell, with phone"] = function (assert, done) {
  if (!isPhonePluggedIn) {
    assert.pass("Skipping test");
    done();
    return;
  }

  let command = "ls";
  console.log("Running adb shell");
  adb.shell(command).then(
    function success(output) {
      assert.ok(output.split('\n').length > 7, "Recieved `ls` output");
      done();
    },
    function fail(e) {
      assert.fail("Shell failed: " + JSON.stringify(e));
      done();
    });
};

exports["test e adb push, with phone"] = function (assert, done) {
  if (!isPhonePluggedIn) {
    assert.pass("Skipping test");
    done();
    return;
  }

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
          assert.fail("Error catting");
          done();
        });
    },
    function fail(e) {
      assert.fail("Error pushing: " + e);
      done();
    });
};

// Uncomment to test proper disconnecting and connecting of devices
// Requires manual intervention
/*
exports["test f device tracking, with phone"] = function(assert, done) {
  if (!isPhonePluggedIn) {
    assert.pass("Skipping test");
    done();
    return;
  }

  dumpBanner("UNPLUG YOUR DEVICE");

  waitUntil(function() !isPhonePluggedIn, function andThen() {
    assert.pass("Tracker caught disconnection successfully");
    dumpBanner("PLUG IN YOUR DEVICE");
    waitUntil(function() isPhonePluggedIn, function andThen() {
      assert.pass("Tracker caught connection successfully");
      done();
    });
  });
};
*/

exports["test zz after"] = function(assert, done) {
  adb.close();
  assert.pass("Done!");
  done();
};

require("test").run(exports);

