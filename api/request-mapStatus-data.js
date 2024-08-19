const axios = require("axios");
const htmlparser2 = require("htmlparser2");
const { sendToDB } = require("../mongo/mongo-client");
const hosts = require("../data/cupps-hosts.json");

// tester host, removing this will have query configurations to all CUPPS hosts.
//hosts = { "10.220.20.195": "SRQ1G15E" };

async function delayer(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function pollStatusData() {
  while (true) {
    let mapStatuses = [{ _id: "TIMESTAMP", date: new Date().toString() }];
    axios
      .all(
        Object.keys(hosts).map((ip) =>
          axios.get(`http://${ip}`, { timeout: 5000 }).catch((error) => {
            if (error.address) {
              mapStatuses.push({
                _id: hosts[error.address],
                ip: error.address,
                reqSuccess: false,
                bpStatus: "",
                bpMedia: "",
                bpState: "",
                btStatus: "",
                btMedia: "",
                btState: "",
              });
            }
            return null;
          })
        )
      )
      .then((responses) => {
        responses.forEach((response) => {
          const domhandler = new htmlparser2.DomHandler((err, dom) => {
            if (err) {
              console.log("An error has occurred obtaining the DOM");
            } else {
              let statusCell;
              const rowBP = htmlparser2.DomUtils.find(
                (elem) => {
                  return elem.name === "a" && elem.attribs.href === "BP1";
                },
                dom,
                true
              )[0].parent.parent;
              const rowBT = htmlparser2.DomUtils.find(
                (elem) => {
                  return elem.name === "a" && elem.attribs.href === "BT1";
                },
                dom,
                true
              )[0].parent.parent;

              bpStatusCell = rowBP.children[7];
              bpMediaCell = rowBP.children[9];
              bpStateCell = rowBP.children[11];

              btStatusCell = rowBT.children[7];
              btMediaCell = rowBT.children[9];
              btStateCell = rowBT.children[11];

              for (let i = 0; i < 2; i++) {
                bpStatusCell = bpStatusCell.children[0];
                bpMediaCell = bpMediaCell.children[0];
                bpStateCell = bpStateCell.children[0];

                btStatusCell = btStatusCell.children[0];
                btMediaCell = btMediaCell.children[0];
                btStateCell = btStateCell.children[0];
              }

              let bpMediaMessage;
              let btMediaMessage;

              if (!bpMediaCell.children.length) {
                bpMediaMessage = "";
              } else {
                bpMediaMessage = bpMediaCell.children[0].data;
              }

              if (!btMediaCell.children.length) {
                btMediaMessage = "";
              } else {
                btMediaMessage = btMediaCell.children[0].data;
              }

              mapStatuses.push({
                _id: hosts[response.request.host],
                ip: response.config.url.substring(7),
                reqSuccess: true,
                bpStatus: bpStatusCell.children[0].data,
                bpMedia: bpMediaMessage,
                bpState: bpStateCell.children[0].data,
                btStatus: btStatusCell.children[0].data,
                btMedia: btMediaMessage,
                btState: btStateCell.children[0].data,
              });
            }
          });
          const parser = new htmlparser2.Parser(domhandler);

          if (response !== null) {
            parser.write(response.data);
            parser.end();
            parser.reset();
          }
        });
        sendToDB(mapStatuses, "statuses");
      });
    await delayer(30000);
  }
}

pollStatusData();
