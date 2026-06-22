import babelParser from "@babel/eslint-parser";

export default [
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      parser: babelParser,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        requireConfigFile: false,
        babelOptions: { presets: ["@babel/preset-react"] },
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: "readonly", document: "readonly", navigator: "readonly",
        localStorage: "readonly", sessionStorage: "readonly", crypto: "readonly",
        console: "readonly", fetch: "readonly", FileReader: "readonly",
        indexedDB: "readonly", IDBKeyRange: "readonly", Image: "readonly",
        Blob: "readonly", File: "readonly", FormData: "readonly", URL: "readonly",
        alert: "readonly", confirm: "readonly", prompt: "readonly",
        btoa: "readonly", atob: "readonly", structuredClone: "readonly",
        setTimeout: "readonly", clearTimeout: "readonly",
        setInterval: "readonly", clearInterval: "readonly",
        requestAnimationFrame: "readonly", cancelAnimationFrame: "readonly",
        Promise: "readonly", Set: "readonly", Map: "readonly", JSON: "readonly",
        Math: "readonly", Date: "readonly", Number: "readonly", String: "readonly",
        Array: "readonly", Object: "readonly", parseInt: "readonly",
        parseFloat: "readonly", isNaN: "readonly", encodeURIComponent: "readonly",
        decodeURIComponent: "readonly", React: "readonly", process: "readonly",
        TextEncoder: "readonly", TextDecoder: "readonly", Intl: "readonly",
        AbortController: "readonly", HTMLElement: "readonly", Event: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
    },
  },
];
