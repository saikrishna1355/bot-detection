// Simple demo server using the local package build output
const path = require("node:path");
const express = require("express");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");

// Require from built dist when running from repo root
const bot = require("../../dist").server;

const app = express();
app.use(cookieParser());
app.use(bodyParser.json({ limit: "200kb" }));

const { middleware, router, telemetryPath } = bot.createBotDetector({
  telemetryPath: "/_bot/telemetry",
  ml: { enabled: true },
});

app.use(middleware);
app.post(telemetryPath, router);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/protected", (req, res) => {
  const result = req.botDetection;
  if (result?.isBot) return res.status(403).send("Bots not allowed");
  res.send("Hello human");
});

app.use("/static", express.static(path.join(__dirname, "static")));

const port = process.env.PORT || 3008;
app.listen(port, () => console.log(`Demo at http://localhost:${port}`));
