var wrapper = require("module-wrapper");
var lang = require("./lang");
var Q = require("q");
var _ = require("lodash");
var node_path = require("path");
var promiseList = require("./promise-helpers").list;

function isRelativePath(str){
    return str.indexOf('../') === 0 || str.indexOf('./') === 0;
}

// @returns {string} resolved dependencies
var resolveDependency = exports.resolveDependency = function(dep, opts) {
    // suppose: 
    //      ['./a', '../../b']
    // `dep` may be relative item, validate it
    var resolved = dep;
    if(!isRelativePath(dep)){
        var version = opts.pkg_dependencies[dep];
        if(!version){
            throw lang.template( 'Exact version of dependency "{mod}" has not defined in package.json. Use "ctx install {mod } --save".', {
                mod: dep
            });
        }

        resolved = dep + '@' + version;
    }
    return resolved;
};



var moduleRenderFuncFactory = exports.moduleRenderFuncFactory = function (pkg, targetVersion){  
    return function moduleRenderFunc(options){
        var deps = options.deps.map(function(dep){
            dep = resolveDependency(dep,{
                pkg_dependencies:pkg.cortex.dependencies
            });
            return dep;
        });

        var id = targetVersion ? options.id.replace(/\d+\.\d+\.\d+/,targetVersion) : options.id;
        var code = options.code;
        var output = lang.template("define({id}[{deps}], function(require, exports, module) {\n" +
            "{code}\n" +
        "});", {
            id:id ? ("\"" + id + "\", ") : "",
            deps:deps.length ? "\"" + deps.join("\", \"") + "\"" : '',
            code:code.replace(/\r|\n/g, '\n')
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
    var file = node_path.resolve(options.file).trim();
    var main_file = node_path.resolve(options.main_file).trim();
    var main_dir = node_path.dirname(main_file);
    var main_id = options.main_id;

    if(file === main_file){
        id = main_id;
    }else{
        var relative_path = node_path.relative(main_dir, file);

        // -> 'folder/foo'
        var relative_id = relative_path.replace(/\.js$/, '');

        // -> 'module@0.0.1/folder/foo'
        id = node_path.join(main_id, relative_id);
    }

    return id;
};

var resolveDepToFile = exports.resolveDepToFile = function(entry,dep){
    entry = node_path.resolve(entry);
    var dir_name = node_path.dirname(entry);

    var file = node_path.join(dir_name,dep + ".js");
    return file;
};

var modulePromise = exports.promise = function(opt){
    var file = node_path.resolve(opt.file);
    var pkg = opt.pkg;
    var entry = opt.entry;
    var targetVersion = opt.targetVersion;

    var deferred = Q.defer();


    var identifier = [pkg.name,pkg.version].join("@");
    var id_gen_options = {
        file:file,
        main_file:entry,
        main_id:identifier
    };


    var wrap_options = {
        id:generateIdentifier(id_gen_options),
        render: moduleRenderFuncFactory(pkg, targetVersion)
    };

    wrapper.wrap(file,wrap_options,function(err,result){
        var deps;
        if(err){
            deferred.reject(err);
        }else{
            deps = result.deps.filter(isRelativePath);
            result = [lang.mix({file:file},result)];
            if(!deps.length){
                deferred.resolve(result);
            }else{
                promiseList(deps.map(function(dep){
                    return modulePromise({
                        file: resolveDepToFile(entry,dep),
                        pkg: pkg,
                        entry:entry,
                        targetVersion:targetVersion
                    });
                })).then(function(listResult){
                    var resolve = _.flatten(listResult.concat(result));
                    resolve = _.unique(resolve,function(obj){
                        return obj.file;
                    });
                    // console.log(resolve);
                    deferred.resolve(resolve);
                }).fail(function(err){
                    deferred.reject(err);
                });
            }
        }
    });

    return deferred.promise;
};