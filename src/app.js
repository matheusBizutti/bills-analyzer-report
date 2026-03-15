require("dotenv").config();

const express = require("express");
const cors = require("cors");
const router = require("./routes");

const app = express();
const port = Number(process.env.PORT || 3001);

// CORS (permite chamadas do Lovable)
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// rotas
app.use("/", router);

app.listen(port, () => {
  console.log(`Bill Analyzer Engine running on port ${port}`);
});