const adb = require("adb-pure");
const timer = require("timer");
const Promise = require("sdk/core/promise");
const { Cu } = require("chrome");
/* const OS = */ Cu.import("resource://gre/modules/osfile.jsm");
const { rootURI: ROOT_URI } = require('@loader/options');
const TEST_URI = ROOT_URI + "resources/r2d2b2g/tests/";
const URL = require("url");

// Before all
adb.startAdbInBackground();

/*exports["test adb"] = function (assert, done) {
  adb.startAdbInBackground();
  console.log("Started!");
  timer.setTimeout(function() {
    adb.getDevices(function(devices) {
      console.log(devices);
      assert.pass("Devices");
      adb.close(function() {
        done();
      });
    });
  }, 3000);
  console.log("after settimeout");
}*/

exports["test tracking devices"] = function (assert, done) {
  console.log("Started!");
  timer.setTimeout(function() {
    adb.trackDevices(function() {
      adb.stopTrackingDevices();
      assert.pass("timeout");
      done();
    });
  }, 2000);
}

exports["test adb push"] = function (assert, done) {
  timer.setTimeout(function() {
    let filename = "no-test.txt";
    let file = URL.toFilename(TEST_URI + "/" + filename);
    adb.pushFile(file,
                 "/sdcard/test.txt").then(
      function success(e) {
        assert.pass("pushed");
        done();
      },
      function fail(e) {
        console.log("Fail: " + e);
      });
    console.log("adb.pushFile called");
  }, 2000);
}

exports["after"] = function(assert, done) {
  adb.close(function() {
    done();
  });
};

require("test").run(exports);

