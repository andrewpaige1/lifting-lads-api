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


// Search users by nickname
app.get("/search-users", async (req, res) => {
  try {
      const { query } = req.query;
      console.log(query)

      const escapeRegex = (str) => str.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const safeQuery = escapeRegex(String(query).trim());
      // Case-insensitive search for nickname
      const users = await db.collection("users").find().toArray();
      const filteredUsers = []

      for (let user of users) {
        console.log(user.nickname);
        if (user.nickname && user.nickname.toLowerCase().includes(query.toLowerCase())) {
          filteredUsers.push(user);
        }
      }
      
      res.status(200).json(filteredUsers);
  } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
});

// Save user to MongoDB
app.post("/save-user", async (req, res) => {
  try {
    const { userInfo } = req.body;

    if (!userInfo) {
      return res.status(400).json({ error: "User info is required" });
    }

    // Parse userInfo if it's a string
    const user = typeof userInfo === "string" ? JSON.parse(userInfo) : userInfo;

    // Check if user already exists
    const existingUser = await db.collection("users").findOne({ sub: user.sub });

    if (existingUser) {
      return res.status(200).json({ message: "User already exists", user: existingUser });
    }

    // Insert new user
    const result = await db.collection("users").insertOne({
      ...user,
      createdAt: new Date(),
    });

    res.status(201).json({ message: "User saved successfully", user: result.ops[0] });
  } catch (error) {
    console.error("Error saving user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
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
   // console.log(JSON.parse(userInfo))
    user = JSON.parse(userInfo)
    // Save metadata in MongoDB
    await db.collection(`${user.nickname}posts`).insertOne({
      imageUrl: cloudinaryResponse.secure_url,
      description,
      userInfo: JSON.parse(userInfo),
      createdAt: new Date(),
      postType: "lift"
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

// Video Upload Route using Cloudinary
app.post("/upload-video", upload.single("video"), async (req, res) => {
  const { description, userInfo } = req.body;
console.log(userInfo)
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No video file uploaded" });
    }

    // Upload video to Cloudinary
    const cloudinaryResponse = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "video",
      folder: "videos", // Store in a specific Cloudinary folder
    });

    // Delete the file from local storage
    fs.unlinkSync(req.file.path);
    user = JSON.parse(userInfo)
    console.log("Uploaded video to Cloudinary:", cloudinaryResponse.secure_url);
    await db.collection(`${user.nickname}posts`).insertOne({
      imageUrl: cloudinaryResponse.secure_url,
      description,
      userInfo: JSON.parse(userInfo),
      createdAt: new Date(),
      postType: "pr"
    });
    res.status(201).json({
      message: "Video uploaded successfully",
      videoUrl: cloudinaryResponse.secure_url,
    });
  } catch (error) {
    console.error("Error uploading video:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// Get user data by ID
app.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Find the user by their ID
    const user = await db.collection("users").findOne({ _id: new mongoose.Types.ObjectId(userId) });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Fetch user's posts from their collection (assuming posts are stored separately)
    const postsCollection = `${user.nickname}posts`;
    const posts = await db.collection(postsCollection).find().toArray();

    res.status(200).json({
      _id: user._id,
      nickname: user.nickname,
      bio: user.bio || "",
      posts: posts.map((post) => ({
        id: post._id.toString(), // Convert ObjectId to string
        type: post.type || "live", // Default to "live" if type is missing
        content: post.description || "",
        tags: post.tags || [],
        imageUrl: post.imageUrl || "", // Include image if available
      })),
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



// Start server
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port} and accessible from anywhere`);
});