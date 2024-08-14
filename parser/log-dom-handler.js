const bpSuccessMessages = require("../data/bp-success-messages.json");
const btSuccessMessages = require("../data/bt-success-messages.json");

function hasPrinterSuccessMessage(currentMessage, typeOf) {
  if (typeOf === "BP") {
    for (let message of bpSuccessMessages) {
      if (currentMessage === message) {
        return true;
      }
    }
  }
  if (typeOf === "BT") {
    for (let message of btSuccessMessages) {
      if (currentMessage === message) {
        return true;
      }
    }
  }
}

module.exports = { hasPrinterSuccessMessage };
