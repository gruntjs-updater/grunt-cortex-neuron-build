var wrapper = require("module-wrapper");
var lang = require("./lang");
var Q = require("q");
var _ = require("lodash");
var node_path = require("path");

function isRelativePath(str){
    return str.indexOf('../') === 0 || str.indexOf('./') === 0;
}

function isEmptyObject(json){
    return JSON.stringify(json) === "{}";
}

// @returns {string} resolved dependencies
var resolveDependency = exports.resolveDependency = function(dep, opts) {
    // suppose:
    //      ['./a', '../../b']
    // `dep` may be relative item, validate it
    var resolved = dep;
    if(!isRelativePath(dep)){
        var version = opts.deps[dep];
        if(!version){
            throw new Error(lang.template( 'Explicit version of dependency "{mod}" has not defined in package.json. Use "cortex install {mod} --save\nfile: {file}".', {
                mod: dep,
                file:opts.file
            }));
        }

        resolved = dep + '@' + version;
    }
    return resolved;
};



var moduleRenderFuncFactory = exports.moduleRenderFuncFactory = function (pkg, targetVersion, render_options){
    return function moduleRenderFunc(options){
        var depResolveMapFuncFactory = function(deps){
            return function(dep){
                return resolveDependency(dep,{
                    deps:deps,
                    file:options.file
                });
            };
        }
        var deps = options.deps.map(depResolveMapFuncFactory(pkg.dependencies || {}));
        var id = targetVersion ? options.id.replace(/\d+\.\d+\.\d+/,targetVersion) : options.id;

        var code = options.code;
        var asyncDeps = pkg.asyncDependencies || {};
        var module_options = {};

        asyncDeps = Object.keys(asyncDeps).map(depResolveMapFuncFactory(asyncDeps));
        if(asyncDeps.length){
            module_options.asyncDeps = asyncDeps;
        }

        lang.mix(module_options, render_options);

        var output = lang.template("define({id}[{deps}], function(require, exports, module) {\n" +
            "{code}\n" +
        "}{module_options});", {
            id:id ? ("\"" + id + "\", ") : "",
            deps:deps.length ? "\"" + deps.join("\", \"") + "\"" : '',
            code:code.replace(/\r|\n/g, '\n'),
            module_options: isEmptyObject(module_options) ? "" : (", " + JSON.stringify(module_options,null,4))
        });
        return output;
    };
};



// generate the standard identifier of the current file
// @param {Object} options
// - file: {string} the pathname of the current file
// - main_file: {string} absolute url of the `main` property in package.json
// - main_id: {string} the standard identifier of the main module
var generateIdentifier = exports.generateIdentifier = function(options) {
    // the exact identifier
    var id;
    var file = options.file;
    var main_file = options.main_file;
    var cwd = options.cwd;
    var main_id = options.main_id;

    if(!cwd){
        throw "option `cwd` is required";
    }

        var relative_path = node_path.relative(cwd, file);

        // -> 'folder/foo'
        var relative_id = relative_path.replace(/\.js$/, '');

        // -> 'module@0.0.1/folder/foo'
        id = node_path.join(main_id, relative_id);
    return id;
};

var resolveDepToFile = exports.resolveDepToFile = function(file,dep){
    file = node_path.resolve(file);
    var dir_name = node_path.dirname(file);

    var file = node_path.join(dir_name,dep + ".js");
    return file;
};

var modulePromise = exports.promise = function(opt){
    var parentFile = opt.parentFile || null;
    var file = node_path.resolve(opt.file);
    var pkg = opt.pkg;
    var targetVersion = opt.targetVersion;
    var deferred = Q.defer();
    var cwd = opt.cwd;
    var identifier = [pkg.name,pkg.version].join("@");
    var mainEntry = opt.mainEntry;

    var id_gen_options = {
        cwd:cwd,
        file:file,
        main_file: mainEntry,
        main_id:identifier
    };

    var render_options = {};

    var isMain = mainEntry == opt.file;

    if ( !opt.isNoEntry ) {
        if ( isMain ) {
            render_options.main = true;
        } else {
            render_options.entry = true;
        }
    }

    var wrap_options = {
        id:generateIdentifier(id_gen_options),
        render: moduleRenderFuncFactory(pkg, targetVersion, render_options)
    };

    wrapper.wrap(file,wrap_options,function(err,result){
        var deps;
        if(err){
            err.parentFile = parentFile;
            deferred.reject(err);
        }else{
            deps = result.deps.filter(isRelativePath);

            result = [lang.mix({file:file},result)];
            if(!deps.length){
                deferred.resolve(result);
            }else{
                Q.all(deps.map(function(dep){
                    return modulePromise({
                        mainEntry: mainEntry,
                        parentFile:file,
                        cwd:cwd,
                        file: resolveDepToFile(file,dep),
                        pkg: pkg,
                        targetVersion:targetVersion,

                        // So, will not saved as `options.main=true` or `options.entry=true` 
                        isNoEntry: true
                    });
                })).then(function(listResult){
                    var resolve = _.flatten(listResult.concat(result));
                    resolve = _.unique(resolve,function(obj){
                        return obj.file;
                    }).sort(function(a,b){
                        return a.file < b.file ? -1 : 1;
                    });
                    deferred.resolve(resolve);
                }).fail(function(err){
                    deferred.reject(err);
                });
            }
        }
    });

    return deferred.promise;
};