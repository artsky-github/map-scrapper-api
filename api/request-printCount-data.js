const axios = require("axios");
const fs = require("fs");
const { convert } = require("html-to-text");
const htmlparser2 = require("htmlparser2");
let hosts = require("../data/cupps-hosts.json");
let mapCounts = require("../data/map-print-count.json");
const { postArrayData } = require("../mongo/mongo-client");
const { hasPrinterSuccessMessage } = require("../parser/log-dom-handler");

// tester host, removing this will have query configurations to all CUPPS hosts.
//hosts = { "10.220.20.195": "SRQ1G15E" };

const mapFileName = "../data/map-print-count.json";
const bpTotalPaper = 2000;
const btTotalPaper = 200;

async function delayer(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function pollPrintCountData() {
  while (true) {
    mapCounts["TIMESTAMP"] = { _id: "TIMESTAMP", date: new Date().toString() };
    axios
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
                  bpCurrentCount: null,
                  bpTotalCount: null,
                  bpDifference: null,
                  bpRemaining: null,
                  btCurrentCount: null,
                  btTotalCount: null,
                  btRemaining: null,
                  btDifference: null,
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
                    bpCurrentCount: 0,
                    bpTotalCount: 0,
                    bpDifference: 0,
                    bpRemaining: bpTotalPaper,
                    btCurrentCount: 0,
                    btTotalCount: 0,
                    btDifference: 0,
                    btRemaining: btTotalPaper,
                  };
                }

                if (mapCounts[responseHost].reqSuccess === false) {
                  mapCounts[responseHost].reqSuccess = true;
                }

                if (mapCounts[responseHost].bpRemaining > 0) {
                  const bpLogCount = htmlparser2.DomUtils.find(
                    (elem) => {
                      return (
                        elem.name === "aeaText" &&
                        hasPrinterSuccessMessage(elem.children[0].data, "BP")
                      );
                    },
                    dom,
                    { recurse: true }
                  ).length;

                  if (
                    mapCounts[responseHost].bpCurrentCount >
                      bpLogCount + mapCounts[responseHost].bpDifference &&
                    bpLogCount + mapCounts[responseHost].bpDifference !== 0
                  ) {
                    mapCounts[responseHost].bpDifference =
                      mapCounts[responseHost].bpDifference +
                      (mapCounts[responseHost].bpCurrentCount - bpLogCount);
                  }

                  if (
                    mapCounts[responseHost].bpCurrentCount <=
                    bpLogCount + mapCounts[responseHost].bpDifference
                  ) {
                    mapCounts[responseHost].bpCurrentCount =
                      bpLogCount + mapCounts[responseHost].bpDifference;
                  } else {
                    mapCounts[responseHost].bpTotalCount =
                      mapCounts[responseHost].bpTotalCount +
                      mapCounts[responseHost].bpCurrentCount;
                    mapCounts[responseHost].bpCurrentCount =
                      bpLogCount + mapCounts[responseHost].bpDifference;
                    mapCounts[responseHost].bpDifference = 0;
                  }

                  mapCounts[responseHost].bpRemaining =
                    bpTotalPaper -
                    (mapCounts[responseHost].bpCurrentCount +
                      mapCounts[responseHost].bpTotalCount);
                }

                if (mapCounts[responseHost].btRemaining > 0) {
                  const btLogCount = htmlparser2.DomUtils.find(
                    (elem) => {
                      return (
                        elem.name === "aeaText" &&
                        hasPrinterSuccessMessage(elem.children[0].data, "BT")
                      );
                    },
                    dom,
                    { recurse: true }
                  ).length;

                  if (
                    mapCounts[responseHost].btCurrentCount >
                      btLogCount + mapCounts[responseHost].btDifference &&
                    btLogCount + mapCounts[responseHost].btDifference !== 0
                  ) {
                    mapCounts[responseHost].btDifference =
                      mapCounts[responseHost].btDifference +
                      (mapCounts[responseHost].btCurrentCount - btLogCount);
                  }

                  if (
                    mapCounts[responseHost].btCurrentCount <=
                    btLogCount + mapCounts[responseHost].btDifference
                  ) {
                    mapCounts[responseHost].btCurrentCount =
                      btLogCount + mapCounts[responseHost].btDifference;
                  } else {
                    mapCounts[responseHost].btTotalCount =
                      mapCounts[responseHost].btTotalCount +
                      mapCounts[responseHost].btCurrentCount;
                    mapCounts[responseHost].btCurrentCount =
                      btLogCount + mapCounts[responseHost].btDifference;
                    mapCounts[responseHost].btDifference = 0;
                  }

                  mapCounts[responseHost].btRemaining =
                    btTotalPaper -
                    (mapCounts[responseHost].btCurrentCount +
                      mapCounts[responseHost].btTotalCount);
                }
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

        fs.writeFile(mapFileName, JSON.stringify(mapCounts, null, 4), (err) => {
          if (err) {
            console.error(err);
          }
        });

        let mapCountsArray = Object.values(mapCounts);

        postArrayData(mapCountsArray, "mapCounts");
      });
    await delayer(30000);
  }
}

pollPrintCountData();
