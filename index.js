require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// Enable CORS for all origins
app.use(cors());

// Connect to MongoDB Atlas
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

const db = mongoose.connection;

// Basic route
app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Listen on all network interfaces
app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port} and accessible from anywhere`);
});
