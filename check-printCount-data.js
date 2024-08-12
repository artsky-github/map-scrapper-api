const fs = require("fs");

const fileName = "map-print-count.json";

setInterval(() => {
  if (!fs.existsSync(`./${fileName}`)) {
    fs.writeFile(fileName, JSON.stringify({}), (err) => {
      if (err) {
        console.error(err);
      }
    });
  } else {
    console.log(`${fileName} exists...`);
  }
}, 60000);
