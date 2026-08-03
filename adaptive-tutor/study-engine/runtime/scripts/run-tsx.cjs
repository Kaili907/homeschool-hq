const { resolve } = require("node:path");

require("./windows-uid.cjs");
const preload = resolve(__dirname, "windows-uid.cjs").replaceAll("\\", "/");
const inherited = process.env.NODE_OPTIONS ?? "";
process.env.NODE_OPTIONS = `${inherited} --require="${preload}"`.trim();

import("../node_modules/tsx/dist/cli.mjs");
