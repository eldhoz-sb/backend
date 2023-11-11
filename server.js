require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { OAuth2Client } = require("google-auth-library");
const { MongoClient, ServerApiVersion } = require("mongodb");

const CLIENT_ID = process.env.CLIENT_ID; // Get Client ID from local environment
const MONGODB_URI = process.env.MONGODB_URI; // Use the MongoDB Atlas connection string from environment variables
const DATABASE_NAME = "my_google_login_app";
const COLLECTION_NAME = "google_users";
const oAuth2Client = new OAuth2Client(CLIENT_ID);

const app = express();

app.use(express.json());

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5371']; // Default to localhost:3000 if not specified

// Use CORS
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Set up MongoDB Atlas
const client = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
client.connect();

const database = client.db(DATABASE_NAME);
const collection = database.collection(COLLECTION_NAME);

app.post("/handleAccessToken", async (req, res) => {
  try {
    const { credentials } = req.body; // Get credentials from the client.

    // Verify Client Token using oAuth2Client
    const ticket = await oAuth2Client.verifyIdToken({
      idToken: credentials,
      audience: CLIENT_ID,
    });

    // Get details of the user using the verified ticket
    const payload = ticket.getPayload();

    const userId = payload.sub;

    const existingUser = await collection.findOne({ _id: userId }); // Check if user details already available in the database, if yes update details, if not add a new user to the database

    if (!existingUser) {
      await collection.insertOne({ _id: userId, ...payload });
      console.log("Inserted document with _id:", userId);
    } else {
      await collection.updateOne({ _id: userId }, { $set: { ...payload } });
      console.log(
        "User already exists with _id:",
        userId,
        "Updated all user information."
      );
    }

    // Send back the username, picture URL, and email of the user to the client.
    res.json({
      message: "User Data Response from the server",
      userName: payload.name,
      userPicture: payload.picture,
      userEmail: payload.email,
    });
  } catch (error) {
    console.error("Error handling access token:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
