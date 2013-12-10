/*
 * grunt-cortex-neuron-build
 * https://github.com/supersheep/grunt-cortex-neuron-build
 *
 * Copyright (c) 2013 supersheep
 * Licensed under the MIT license.
 */

'use strict';

var fs          = require('fs-sync');
var async       = require('async');
var node_path   = require('path');
var modulePromise = require("../lib/module-promise").promise;
var messages    = require("../lib/messages");

require("colors");

/**
 * options:
 * entries {k:v}
 * targetVersion
 * cwd
 * define
 */
module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('cortex_neuron_build', 'Your task description goes here.', function() {
    // this is an async task
    var task_done = this.async();

    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
      cwd: process.cwd(), // if cwd is not pass in, we just use process.cwd()
      define: 'define',
      entries:{}
    });

    var pkg = fs.readJSON( node_path.join(options.cwd,"package.json") );

    // set target version;
    var targetVersion = options.targetVersion || pkg.version;

    var entries = options.entries;

    function moduleGenerator(src,dest){
        src = node_path.resolve( node_path.join(options.cwd,src) );
        dest = node_path.resolve( node_path.join(options.cwd,dest) );
        var modules = [];
        return function(done){
            async.waterfall([function(done){
                modulePromise({
                    file:src,
                    entry:src,
                    pkg:pkg,
                    targetVersion:targetVersion
                }).then(function(results){
                    done(results.sort(function(item){
                        return item.file === src ? 1 : -1;
                    }).map(function(item){
                        return item.output;
                    }).join("\n"));
                });
            }],function(content){
                fs.write(dest,content);
                grunt.log.writeln('File "' + dest + '" created.');
                done();
            });
        };
    }


    var tasks = [];
    for(var k in entries){
        tasks.push(moduleGenerator(k,entries[k]));
    }

    async.series(tasks,task_done);

  });
};