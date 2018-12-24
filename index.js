var through = require("through2"),
  fs = require("fs"),
  path = require("path"),
  gutil = require("gulp-util");
var debug = require("debug")("gulp-jscad-files");
var verbose = require("debug")("gulp-jscad-files:verbose");
var silly = require("debug")("gulp-jscad-files:silly");

/**
 * Opens a package.json file and returns the `dependencies`
 * as an array.  Does not look at the version information.
 * @param {string} packagename
 */
function getDependencies(packagename) {
  var packageJson = JSON.parse(
    fs.readFileSync("node_modules/" + packagename + "/package.json")
  );

  return Object.keys(packageJson.dependencies || {});
}

/**
 * Recursivly returns all dependencies for a given package name.
 * @param {string} p  package name
 */
function getAllDependencies(p) {
  var files = [];
  var cache = {};
  function bar(name) {
    if (!files.includes(name)) {
      files.push(name);

      var d = getDependencies(name);

      cache[name] = d;

      d.forEach(n => {
        bar(n);
      });
    }
  }

  bar(p);

  return { files, cache };
}

/**
 * Flattens an array of {files, cache} objects into a single
 * {files, cache} object.
 * @param {array} d
 */
function flatten(d) {
  return d.reduce(
    (acc, v) => {
      v.files.forEach(name => {
        if (!acc.files.includes(name)) acc.files.push(name);
      });

      Object.entries(v.cache).forEach(([key, value]) => {
        if (!acc.cache[key]) acc.cache[key] = value;
      });
      return acc;
    },
    { files: [], cache: {} }
  );
}

/**
 * Sorts the list of library files in dependency order.
 * If a circular dependency is found, it throws an error.
 * @param {object} param
 * @param {array} param.files
 * @param {object} param.cache
 */
function sort({ files, cache }) {
  var dependencies = [];
  var recheck = [];
  var remaining = files.map(f => f); // copy files
  var rlength = remaining.length;
  var passcount = 0;

  while (remaining.length > 0 && passcount < 10) {
    passcount++;
    remaining.forEach(name => {
      /**
       * push libraries with no dependencies on the front
       */
      if (cache[name].length == 0) {
        dependencies.unshift(name);
      } else {
        /**
         * find the highest index of a libraries dependenciy
         */
        var indexes = cache[name].map(lib => {
          debug("lib", name, lib);
          return dependencies.indexOf(lib);
        });
        debug("sort indexes", name, indexes);
        if (indexes.includes(-1)) {
          // some libraries were not found yet, recheck
          recheck.unshift(name);
        } else {
          debug("all indexes found", name, indexes);
          dependencies.push(name);
        }
      }
    });

    remaining = files.filter(name => !dependencies.includes(name));

    if (remaining.length == rlength) {
      debug("Circular dependencies found", rlength, remaining, passcount);
      throw new Error("Possible circular dependencies", remaining);
    } else {
      debug("new remaining", remaining.length, rlength);
      rlength = remaining.length;
    }
    debug("remaining", remaining);
  }
  return dependencies;
}

/**
 * Gets the jscad dependent libraries from a gulp stream.  Assumes the stream
 * is a package.json file of a jscad project.
 * @param {*} file
 * @param {*} stream
 * @param {*} loaded
 * @param {*} depth
 */
function getPackage(file, stream, loaded, depth) {
  silly("getPackage", file);
  depth = depth || 0;
  if (depth > 1) {
    throw new Error("getPackage depth exceeded");
  }

  verbose("contents", file.path, file.contents.toString());
  var pkg = JSON.parse(file.contents.toString());
  var dependencyFiles = Object.keys(pkg.dependencies).map(p => {
    var d = getAllDependencies(p);
    debug("p", { p, d });
    return d;
  });

  debug("dependencyFiles", dependencyFiles);
  var flat = flatten(dependencyFiles);
  debug("flatten", flat);

  var sorted = sort(flat);
  debug("sort", sorted);
  return sorted;
}

/**
 * Returns an array of gulp file objects from a given jscad library
 * name.  Assumes that there is a `jscad.json` file with a `files`
 * list of dependent files.
 * @param {string} jscadlib name of a node_modules jscad library
 */
function getJscadFiles(jscadlib) {
  silly("getJscadFiles", jscadlib);
  var jscad = JSON.parse(
    fs.readFileSync("node_modules/" + jscadlib + "/jscad.json")
  );

  var files = Array.isArray(jscad.files) ? jscad.files : [jscad.files];

  return files.map(filename => {
    var deppath = path.resolve("node_modules/" + jscadlib, filename);
    silly("getJscadFiles filename", { filename, deppath });
    var depfile = new gutil.File({
      path: deppath,
      contents: fs.readFileSync(deppath)
    });
    silly("getJscadFiles depfile", { filename, depfile });
    return depfile;
  });
}

module.exports = function() {
  return through.obj(function(file, encoding, callback) {
    var self = this;

    getPackage(file, self, {})
      .map(f => {
        verbose("* getPackage file:", f);
        return f;
      })
      .filter(f => {
        return fs.existsSync("node_modules/" + f + "/jscad.json");
      })
      .forEach(jscadlib => {
        getJscadFiles(jscadlib).forEach(libfile => {
          silly("libfile", libfile);
          self.push(libfile);
        });
      });

    // console.warn('cb');
    callback();
  });
};
