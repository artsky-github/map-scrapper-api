const { exec } = require("child_process");
const fs = require("fs");

// nbtscan must be installed for this to work.
exec('nbtscan', (error, stdout) => {
    if (stdout.includes("NBTscan")) {

        const IpData = new Promise((resolve, reject) => {
            exec("nbtscan 10.220.20.0/24 | sort -k2 | awk '{print $1}'", (error, stdout) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout.trim());
                }
            });
        });

        const HostData = new Promise((resolve, reject) => {
            exec("nbtscan 10.220.20.0/24 | sort -k2 | awk '{print $2}'", (error, stdout) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout.trim());
                }
            });
        });

        async function getHosts() {
            let hostsMap = {};
            const ips = await IpData; 
            const hostNames = await HostData; 
        
            let ipArray = ips.split("\n");
            let hostArray = hostNames.split("\n");
            ipArray = ipArray.slice(ipArray.indexOf("Doing") + 1);
            hostArray = hostArray.slice(hostArray.indexOf("NBT") + 1);
        
            for (let i = 0; i < ipArray.length; i++) {
                hostsMap[ipArray[i]] = hostArray[i];
            }
            return hostsMap;
        }

        getHosts().then((response) => {
            fs.writeFile("../data/cupps-hosts.json", JSON.stringify(response, null, 4), (err) => {
                if (err) {
                  console.error(err);
                } else {
                  console.log("JSON Host Configuration Established");
                }
              });
        });

    } else {
        console.error(error);
    }
});