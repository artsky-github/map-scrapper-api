require("dotenv").config({ path: "../.env" });
const { MongoClient } = require("mongodb");
const hosts = require("../data/cupps-hosts.json");

const dbURI = `mongodb://${process.env.DB_IP}:${process.env.DB_PORT}`;

let mongoClient;
try {
  mongoClient = new MongoClient(dbURI).db("MapMonitor");
} catch (error) {
  console.log(error);
}

function sendToDB(mapArray, collectionName) {
  let activeHosts = Object.values(hosts);
  activeHosts.push("TIMESTAMP");

  let bulkData = mapArray.map((mapPrinter) => ({
    replaceOne: {
      upsert: true,
      filter: {
        _id: mapPrinter._id,
      },
      replacement: mapPrinter,
    },
  }));

  bulkData.push({
    deleteMany: {
      filter: {
        _id: { $nin: activeHosts },
      },
    },
  });

  mongoClient.collection(collectionName).bulkWrite(bulkData);
  console.log(
    `Successfully inserted ${
      activeHosts.length
    } records at ${new Date().toString()}`
  );
}

async function getFromDB(collectionName) {
  const collectionArray = await mongoClient
    .collection(collectionName)
    .find()
    .toArray();
  return collectionArray;
}

module.exports = { sendToDB, getFromDB };
