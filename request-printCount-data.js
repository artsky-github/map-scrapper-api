const axios = require("axios");
const fs = require("fs");
const { convert } = require("html-to-text");
const htmlparser2 = require("htmlparser2");
const hosts = require("./cupps-hosts.json");
let mapCounts = require("./map-print-count.json");
const { postArrayData } = require("./mongo-client");

// tester host, removing this will have query configurations to all CUPPS hosts.
//hosts = { "10.220.20.195": "SRQ1G15E" };

function hasPrinterSuccessMessage(currentMessage, typeOf) {
  const bpSuccessMessages = [
    "T//CIPROK#100#201#300#VSR#01W",
    "CHECPROK#100#201#300#VSR#01S",
    "ATBCPROK#101#200#300#VSR",
    "CPROK#101#200#300#VSR",
    "CPROK#100#201#300#VSR",
    "C?ACIPROK#101#200#300#VSR",
    "CHECKPROK^100^201^300^VSR",
    "CHKINPROK_100_201_300_VSR",
  ];

  const btSuccessMessages = ["HDCPROK101", "GONOWPROK101", "MUSEPROK101"];

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

const mapFileName = "map-print-count.json";
const bpTotalPaper = 2000;
const btTotalPaper = 200;

setInterval(() => {
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
                bpRemaining: null,
                btCurrentCount: null,
                btTotalCount: null,
                btRemaining: null,
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
                  bpRemaining: bpTotalPaper,
                  btCurrentCount: 0,
                  btTotalCount: 0,
                  btRemaining: btTotalPaper,
                };
              }

              if (mapCounts[responseHost].reqSuccess === false) {
                mapCounts[responseHost].reqSuccess = true;
              }

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

              if (mapCounts[responseHost].bpRemaining !== 0) {
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

                if (mapCounts[responseHost].bpCurrentCount <= bpLogCount) {
                  mapCounts[responseHost].bpCurrentCount = bpLogCount;
                } else {
                  mapCounts[responseHost].bpTotalCount =
                    mapCounts[responseHost].bpTotalCount +
                    mapCounts[responseHost].bpCurrentCount;
                  mapCounts[responseHost].bpCurrentCount = btLogCount;
                }

                mapCounts[responseHost].bpRemaining =
                  bpTotalPaper -
                  (mapCounts[responseHost].bpCurrentCount +
                    mapCounts[responseHost].bpTotalCount);
              }

              if (mapCounts[responseHost].btRemaining !== 0) {
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

                if (mapCounts[responseHost].btCurrentCount <= btLogCount) {
                  mapCounts[responseHost].btCurrentCount = btLogCount;
                } else {
                  mapCounts[responseHost].btTotalCount =
                    mapCounts[responseHost].btTotalCount +
                    mapCounts[responseHost].btCurrentCount;
                  mapCounts[responseHost].btCurrentCount = btLogCount;
                }

                mapCounts[responseHost].btRemaining =
                  btTotalPaper -
                  (mapCounts[responseHost].btCurrentCount +
                    mapCounts[responseHost].btTotalCount);
              }
            }
          });
          const parser = new htmlparser2.Parser(domhandler, { xmlMode: true });
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
}, 60000);
