require("dotenv").config();

const express = require("express");
const router = require("./routes");

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(express.json());
app.use("/", router);

app.listen(port, () => {
  console.log(`Bill Analyzer Engine running on http://localhost:${port}`);
});