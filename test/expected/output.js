define("test-module@latest/c", ["./d"], function(require, exports, module) {
require("./d");
require.async("./d");
}, {
    "asyncDeps": [
        "c@0.0.3"
    ]
});
define("test-module@latest/d", [], function(require, exports, module) {
module.exports = function(){
	console.log("I'm d");
};
}, {
    "asyncDeps": [
        "c@0.0.3"
    ]
});
define("test-module@latest", ["a@0.0.1", "b@0.0.2", "./c", "./d"], function(require, exports, module) {
var a = require("a");
var b = require("b");
var c = require("./c");
var d = require("./d");
}, {
    "asyncDeps": [
        "c@0.0.3"
    ]
});