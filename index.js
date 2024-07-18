const express = require("express");
const mysql = require("mysql2");
const redis = require("redis");

const app = express();
const port = 3000;

// Create MySQL connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "oyly",
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error("MySQL connection error:", err);
  } else {
    console.log("Connected to MySQL");
  }
});

// Create Redis client
const redisClient = redis.createClient({
  host: "127.0.0.1", // Redis server host
  port: 6379, // Redis server port
});

// Handle Redis connection errors
redisClient.on("error", (err) => {
  console.error("Redis error:", err);
});

// Connect to Redis
redisClient.connect();

// Confirm Redis connection
redisClient.on("connect", () => {
  console.log("Connected to Redis");
});

// Define a route to fetch data from MySQL
app.get("/mysql-data", (req, res) => {
  const query = "SELECT * FROM contact_us";
  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send("MySQL query error: " + err);
    } else {
      res.json(results);
    }
  });
});

// Define a route to fetch data from Redis
app.get("/redis-data", async (req, res) => {
  try {
    const data = await redisClient.get("khan");
    res.json({ data });
  } catch (err) {
    res.status(500).send("Redis query error: " + err);
  }
});

// Define a route to fetch data from MySQL and check Redis
app.get("/data", async (req, res) => {
  const query = "SELECT * FROM cust_feedback";
  const redisKey = "mysql_data_cust_feedback";

  try {
    const cachedData = await redisClient.get(redisKey);

    if (cachedData) {
      // Data found in Redis, print it
      console.log("Data found in Redis.");
      res.json(JSON.parse(cachedData));
    } else {
      // Data not found in Redis, fetch from MySQL
      db.query(query, async (err, results) => {
        if (err) {
          res.status(500).send("MySQL query error: " + err);
        } else {
          // Print and return MySQL data
          console.log("Data not found in Redis, fetching from MySQL.");
          res.json(results);

          // Set data in Redis for future requests
          try {
            await redisClient.set(redisKey, JSON.stringify(results));
            console.log("Data set in Redis");
          } catch (redisErr) {
            console.error("Error setting data in Redis:", redisErr);
          }
        }
      });
    }
  } catch (redisErr) {
    res.status(500).send("Redis query error: " + redisErr);
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
