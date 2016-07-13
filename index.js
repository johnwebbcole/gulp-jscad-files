var through = require('through2'),
    fs = require('fs'),
    path = require('path'),
    globby = require('globby');

module.exports = function () {
    return through.obj(function (file, encoding, callback) {
        var jscad = JSON.parse(file.contents.toString());

        if (jscad.files) {
            jscad.files.forEach((f) => {
                var n = file.clone();
                n.path = path.resolve(path.dirname(file.path), f);

                if (fs.existsSync(n.path)) {
                    n.contents = fs.readFileSync(n.path);
                } else {
                    // try direct path
                    n.contents = fs.readFileSync(f);
                }
                this.push(n);
            });

            var pkg = JSON.parse(fs.readFileSync(path.resolve(path.dirname(file.path), 'package.json')));

            if (pkg && pkg.dependencies) {
                Object.keys(pkg.dependencies).forEach((key) => {
                    globby(['node_modules/' + key + '/package.json']).then(paths => {
                        // console.log('globby', key, paths);
                        var deppkg = JSON.parse(fs.readFileSync(paths[0]));
                        var d = file.clone();
                        d.path = path.resolve(path.dirname(paths), deppkg.main);
                        d.contents = fs.readFileSync(d.path);
                        // If the main file is `index.js`, change it to the package name, so we don't get a bunch of `index.js` overwrites
                        if (path.basename(d.path) === 'index.js') d.path = path.resolve(path.dirname(paths), key + '.js');
                        this.push(d);
                    });
                });
            }
        }
        callback();
    });
};
