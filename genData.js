const backend = require("./backend.js")

let config = backend.loadConfig("config.yaml");
require("dotenv").config()
if (process.env["PERSISTENT_ROOT"] == undefined) {
    process.env["PERSISTENT_ROOT"] = ""
}
backend.updateQuestions(config);
console.log("Questions downloaded!");