const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    let uri = process.env.MONGO_URI || "mongodb://localhost:27017/civicalert";
    if (process.env.NODE_ENV === "test") {
      if (uri.includes("?")) {
        const parts = uri.split("?");
        const urlPart = parts[0];
        const queryPart = parts[1];
        const lastSlash = urlPart.lastIndexOf("/");
        const baseUrl = urlPart.substring(0, lastSlash + 1);
        uri = `${baseUrl}civicalert_test?${queryPart}`;
      } else {
        uri = uri.endsWith("/") ? `${uri}civicalert_test` : `${uri}/civicalert_test`;
      }
    }
    const conn = await mongoose.connect(uri);

    console.log(`MongoDB Connected: ${conn.connection.host} (URI: ${uri.replace(/\/\/.*@/, "//<credentials>@")})`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
};

module.exports = connectDB;