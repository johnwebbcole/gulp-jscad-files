module.exports = {
  env: {
    es6: true,
    node: true
  },
  extends: ["eslint:recommended", "plugin:ava/recommended"],
  parserOptions: {
    ecmaVersion: 2017
  },
  plugins: ["ava"],
  rules: {
    "no-console": [
      "error",
      {
        allow: ["warn", "error"]
      }
    ],
    "linebreak-style": [2, "unix"],
    quotes: [2, "single"],
    semi: [2, "always"]
  }
};
