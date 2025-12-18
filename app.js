require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const controller = require("./controllers/controller");
const { connect } = require("./helpers/rabbitmq");

const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "News API Server",
    status: "running",
  });
});

app.get("/api/news", controller.getNews);
app.post("/api/news", controller.postNews);
app.get("/api/search", controller.searchNews);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ status: "error", message });
});

// Connect to RabbitMQ on startup
connect()
  .then(() => {
    console.log("✓ RabbitMQ connection established");
  })
  .catch((err) => {
    console.warn("⚠️  RabbitMQ connection failed, will retry:", err.message);
  });

// Start server
app.listen(port, () => {
  console.log(`🚀 API Server running on port ${port}`);
  console.log(`📍 http://localhost:${port}`);
});
