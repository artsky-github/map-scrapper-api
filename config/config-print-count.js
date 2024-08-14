const fs = require("fs");

const filePath = "../data/map-print-count.json";

setInterval(() => {
  if (!fs.existsSync(filePath)) {
    fs.writeFile(filePath, JSON.stringify({}), (err) => {
      if (err) {
        console.error(err);
      }
    });
  } else {
    console.log(`${filePath} exists...`);
  }
}, 15000);
