const test = require("ava");
const mockfs = require("mock-fs");
const File = require("vinyl");
const gulpJscadFiles = require("./index");

const debug = require("debug")("gulp-jscad-files:test");

test.beforeEach("mocking fs", t =>
  mockfs({
    "node_modules/jscad-utils": {
      "package.json": JSON.stringify({ dependencies: {} }),
      "jscad.json": JSON.stringify({
        files: ["dist/utils.jscad"]
      }),
      dist: {
        "utils.jscad": "// mock jscad utils"
      }
    },
    "node_modules/dep-on-jscad-utils": {
      "package.json": JSON.stringify({
        dependencies: {
          "jscad-utils": "*"
        }
      }),
      "jscad.json": JSON.stringify({
        files: ["dist/test.jscad"]
      }),
      dist: {
        "test.jscad": "// test.jscad: jscad-utils should appear before"
      }
    },
    "node_modules/dep-on-dep": {
      "package.json": JSON.stringify({
        dependencies: {
          "dep-on-jscad-utils": "*"
        }
      }),
      "jscad.json": JSON.stringify({
        files: ["dist/foo.jscad"]
      }),
      dist: {
        "foo.jscad":
          "// foo.jscad: test.jscad and jscad-utils should appear before"
      }
    },
    "node_modules/lots-of-deps": {
      "package.json": JSON.stringify({
        dependencies: {
          "dep-on-jscad-utils": "*",
          "jscad-utils": "*"
        }
      }),
      "jscad.json": JSON.stringify({
        files: ["dist/lots-of-deps.jscad"]
      }),
      dist: {
        "lots-of-deps.jscad":
          "// lots-of-deps.jscad: test.jscad and jscad-utils should appear before"
      }
    },
    "node_modules/circular1": {
      "package.json": JSON.stringify({
        dependencies: {
          "dep-on-jscad-utils": "*",
          "jscad-utils": "*",
          circular2: "*"
        }
      }),
      "jscad.json": JSON.stringify({
        files: ["dist/circular1.jscad"]
      }),
      dist: {
        "circular1.jscad": "// circular1.jscad"
      }
    },
    "node_modules/circular2": {
      "package.json": JSON.stringify({
        dependencies: {
          "dep-on-jscad-utils": "*",
          "jscad-utils": "*",
          circular1: "*"
        }
      }),
      "jscad.json": JSON.stringify({
        files: ["dist/circular2.jscad"]
      }),
      dist: {
        "circular2.jscad": "// circular2.jscad"
      }
    }
  })
);
test.afterEach.always("unmocking fs", t => mockfs.restore());

test.cb("no dependencies", testPackage, { dependencies: {} }, []);

test.cb(
  "jscad-utils dependencies",
  testPackage,
  { dependencies: { "jscad-utils": "*" } },
  ["// mock jscad utils"]
);

test.cb(
  "lib that depends on jscad-utils",
  testPackage,
  { dependencies: { "dep-on-jscad-utils": "*" } },
  ["// mock jscad utils", "// test.jscad: jscad-utils should appear before"]
);

test.cb(
  "multiple dependencies levels",
  testPackage,
  { dependencies: { "dep-on-dep": "*" } },
  [
    "// mock jscad utils",
    "// test.jscad: jscad-utils should appear before",
    "// foo.jscad: test.jscad and jscad-utils should appear before"
  ]
);

test.cb(
  "lots of dependencies",
  testPackage,
  { dependencies: { "lots-of-deps": "*" } },
  [
    "// mock jscad utils",
    "// test.jscad: jscad-utils should appear before",
    "// lots-of-deps.jscad: test.jscad and jscad-utils should appear before"
  ]
);

test.cb(
  "lots of direct dependencies",
  testPackage,
  { dependencies: { "lots-of-deps": "*", "jscad-utils": "*" } },
  [
    "// mock jscad utils",
    "// test.jscad: jscad-utils should appear before",
    "// lots-of-deps.jscad: test.jscad and jscad-utils should appear before"
  ]
);

test.cb("circular dependencies", t => {
  const error = t.throws(() => {
    testPackage(
      t,
      { dependencies: { circular1: "*", "jscad-utils": "*" } },
      []
    );
  }, Error);

  t.is(error.message, "Possible circular dependencies");
});

test.cb("dependency not found", t => {
  const error = t.throws(() => {
    testPackage(t, { dependencies: { unknown: "*", "jscad-utils": "*" } }, []);
  }, Error);

  t.is(
    error.message,
    "ENOENT, no such file or directory 'node_modules/unknown/package.json'"
  );
});

function testPackage(t, input, expected) {
  const stream = gulpJscadFiles();
  var files = [];
  stream.on("data", file => {
    files.push(file.contents.toString());
  });

  stream.on("end", () => {
    debug("files", files.join("\n"));
    t.deepEqual(files, expected);
    t.end();
  });

  stream.on("error", err => {
    debug("testPackage error", err);
  });

  try {
    stream.end(
      new File({
        path: "package.json",
        // contents: intoStream(JSON.stringify({ dependencies: [] }))
        contents: Buffer.from(JSON.stringify(input))
      })
    );
  } catch (err) {
    // debug("testPackage error catch", err);

    t.end();
    throw err;
  }
}
