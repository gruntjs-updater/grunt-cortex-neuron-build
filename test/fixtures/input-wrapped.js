define("test-module@0.1.0", ["a@0.0.1", "b@0.0.2", "./c", "./d"], function(require, exports, module) {
var a = require("a");
var b = require("b");
var c = require("./c");
var d = require("./d");
}, {
    "asyncDeps": [
        "c@0.0.3"
    ]
});