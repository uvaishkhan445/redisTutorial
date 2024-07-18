const express = require("express");
const mysql = require("mysql2");
const redis = require("redis");
const { Parser } = require("json2csv");
const fs = require("fs");
const path = require("path");
const pdf = require("html-pdf");
const app = express();
const port = 5000;

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

// Route to generate CSV
app.get("/download-csv", (req, res) => {
  db.query("SELECT * FROM contact_us", (err, results, fields) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(results);

    fs.writeFile("data.csv", csv, (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.download("data.csv", "data.csv", (err) => {
        if (err) {
          console.error("Error downloading the file:", err);
          return res.status(500).json({ error: err.message });
        }

        // Optionally delete the file after download
        fs.unlink("data.csv", (err) => {
          if (err) {
            console.error("Error deleting the file:", err);
          }
        });
      });
    });
  });
});

// Route to generate PDF
app.get("/download-pdf3", (req, res) => {
  db.query("SELECT * FROM contact_us", (err, results, fields) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const html = generateHtml(results);
    const filePath = path.join(__dirname, "data.pdf");

    pdf.create(html, { format: "A4" }).toFile(filePath, (err, result) => {
      if (err) {
        console.error("Error generating the PDF:", err);
        return res.status(500).json({ error: err.message });
      }

      res.download(filePath, "data.pdf", (err) => {
        if (err) {
          console.error("Error downloading the file:", err);
          return res.status(500).json({ error: err.message });
        }

        // Optionally delete the file after download
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error("Error deleting the file:", err);
          }
        });
      });
    });
  });
});

// Generate HTML with data
function generateHtml(data) {
  const rows = data
    .map(
      (row) => `
      <tr>
        <td>${row.id}</td>
        <td>${row.admin_id}</td>
        <td>${row.name}</td>
        <td>${row.mobile_no}</td>
        <td>${row.email_id}</td>
        <td>${row.message}</td>
        <td>${row.date}</td>
        <td>${row.status}</td>
      </tr>
    `
    )
    .join("");

  return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>MySQL Data</h1>
          <table>
            <thead>
              <tr>
               <th>ID</th>
                <th>Admin Id</th>
                <th>Name</th>
                <th>Mobile No.</th>
                <th>Email</th>
                <th>Message</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `;
}
// Start the Express server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
