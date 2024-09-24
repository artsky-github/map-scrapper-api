const axios = require("axios");
const fs = require("fs");
const { convert } = require("html-to-text");
const htmlparser2 = require("htmlparser2");
let hosts = require("../data/cupps-hosts.json");
const { sendToDB, getFromDB } = require("../mongo/mongo-client");
const { hasPrinterSuccessMessage } = require("../parser/log-dom-handler");

// tester host, removing this will have query configurations to all CUPPS hosts.
//hosts = { "10.220.20.195": "SRQ1G15E" };

const bpTotalPaper = 2000;
const btTotalPaper = 200;

async function delayer(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function arrayToObject(array) {
  const encapsulator = {};
  for (let obj of array) {
    encapsulator[obj._id] = obj;
  }
  return encapsulator;
}

async function pollCountData() {
  while (true) {
    mapCounts = arrayToObject(await getFromDB("counts"));
    mapCounts["TIMESTAMP"] = { _id: "TIMESTAMP", date: new Date().toString() };
    await axios
      .all(
        Object.keys(hosts).map((ip) =>
          axios.get(`http://${ip}/DEBUG`, { timeout: 5000 }).catch((error) => {
            const errorIP = error.address;
            const errorHost = hosts[error.address];
            if (errorIP) {
              if (errorHost in mapCounts) {
                mapCounts[errorHost].reqSuccess = false;
              } else {
                mapCounts[errorHost] = {
                  _id: errorHost,
                  ip: errorIP,
                  reqSuccess: false,
                  bpTotalCount: null,
                  bpCurrentTimestamp: null, 
                  bpRemaining: null,
                  bpRemainingPercent: null,
                  btTotalCount: null,
                  btCurrentTimestamp: null,
                  btRemaining: null,
                  btRemainingPercent: null
                };
              }
            }
            return null;
          })
        )
      )
      .then((responses) => {
        responses.forEach((response) => {
          if (response) {
            const responseHost = hosts[`${response.request.host}`];
            const domhandler = new htmlparser2.DomHandler((err, dom) => {
              if (err) {
                console.error(err);
              } else {
                if (!(responseHost in mapCounts)) {
                  mapCounts[responseHost] = {
                    _id: responseHost,
                    ip: response.request.host,
                    reqSuccess: true,
                    bpTotalCount: 0,
                    bpCurrentTimestamp: 0,
                    bpRemaining: bpTotalPaper,
                    bpRemainingPercent: 100,
                    btTotalCount: 0,
                    btCurrentTimestamp: 0,
                    btRemaining: btTotalPaper,
                    btRemainingPercent: 100,
                  };
                }

                if (mapCounts[responseHost].reqSuccess === false) {
                  mapCounts[responseHost].reqSuccess = true;
                }

                const bpLogCountArray = htmlparser2.DomUtils.find(
                  (elem) => {
                    return (
                      elem.name === "aeaText" &&
                      hasPrinterSuccessMessage(elem.children[0].data, "BP")
                    );
                  },
                  dom,
                  { recurse: true }
                );

                const btLogCountArray = htmlparser2.DomUtils.find(
                  (elem) => {
                    return (
                      elem.name === "aeaText" &&
                      hasPrinterSuccessMessage(elem.children[0].data, "BT")
                    );
                  },
                  dom,
                  { recurse: true }
                );

                for (let bpLogCount of bpLogCountArray.reverse()) {
                  const bpLogCountTimestamp = Date.parse(bpLogCount.parent.parent.parent.attribs.timeStamp);
                   if (mapCounts[responseHost].bpCurrentTimestamp < bpLogCountTimestamp && mapCounts[responseHost].bpTotalCount < bpTotalPaper) {
                     mapCounts[responseHost].bpTotalCount++;
                     mapCounts[responseHost].bpCurrentTimestamp = bpLogCountTimestamp;
                   }
                }

                for (let btLogCount of btLogCountArray.reverse()) {
                  const btLogCountTimestamp = Date.parse(btLogCount.parent.parent.parent.attribs.timeStamp);
                   if (mapCounts[responseHost].btCurrentTimestamp < btLogCountTimestamp && mapCounts[responseHost].btTotalCount < btTotalPaper) {
                     mapCounts[responseHost].btTotalCount++;
                     mapCounts[responseHost].btCurrentTimestamp = btLogCountTimestamp;
                   }
                }

                mapCounts[responseHost].bpRemaining = bpTotalPaper - mapCounts[responseHost].bpTotalCount; 
                mapCounts[responseHost].btRemaining = btTotalPaper - mapCounts[responseHost].btTotalCount;

                mapCounts[responseHost].bpRemainingPercent = Math.round(mapCounts[responseHost].bpRemaining / bpTotalPaper * 100);
                mapCounts[responseHost].btRemainingPercent = Math.round(mapCounts[responseHost].btRemaining / btTotalPaper * 100);

              }
            });
            const parser = new htmlparser2.Parser(domhandler, {
              xmlMode: true,
            });
            if (response !== null) {
              parser.write(convert(response.data));
              parser.end();
              parser.reset();
            }
          }
        });

        Object.values(mapCounts).forEach((mapCount) => {
          if (!Object.hasOwn(hosts, mapCount.ip) && mapCount.ip) {
            delete mapCounts[`${mapCount._id}`];
          }
        });

        let mapCountsArray = Object.values(mapCounts);

        sendToDB(mapCountsArray, "counts");
      });
    await delayer(15000);
  }
}

pollCountData();
