require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Connect to MongoDB Atlas
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

const db = mongoose.connection;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer Configuration
const storage = multer.diskStorage({
  destination: "uploads/", // Temp storage
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// Basic route
app.get("/", (req, res) => {
  res.send("Hello World!");
});

// **Upload Route using Cloudinary SDK**
app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const { description, userInfo } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Upload to Cloudinary
    const cloudinaryResponse = await cloudinary.uploader.upload(req.file.path, {
      folder: "uploads", // Store in a specific Cloudinary folder
    });

    // Delete file from local temp storage
    fs.unlinkSync(req.file.path);
    console.log(JSON.parse(userInfo))
    user = JSON.parse(userInfo)
    // Save metadata in MongoDB
    await db.collection(`${user.nickname}posts`).insertOne({
      imageUrl: cloudinaryResponse.secure_url,
      description,
      userInfo: JSON.parse(userInfo),
      createdAt: new Date(),
    });

    console.log("Uploaded to Cloudinary:", cloudinaryResponse.secure_url);
    res.status(201).json({
      message: "Upload successful",
      imageUrl: cloudinaryResponse.secure_url,
    });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start server
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port} and accessible from anywhere`);
});
