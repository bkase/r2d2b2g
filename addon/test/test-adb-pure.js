const adb = require("adb-pure");
const timer = require("timer");

exports["test adb"] = function (assert, done) {
  adb.startAdbInBackground();
  console.log("Started!");
  timer.setTimeout(function() {
    console.log(adb.getDevices().readString());
    assert.pass("Devices");
    adb.close(function() {
      done();
    });
  }, 3000);
  console.log("after settimeout");
}

/*exports["test adb test"] = function (assert, done) {
  adb.startAdbInBackground();
  timer.setTimeout(function() {
    adb.close();
    assert.pass("timeout");
    done();
  }, 3000);
}*/

require("test").run(exports);

