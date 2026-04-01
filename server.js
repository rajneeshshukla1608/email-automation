const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { google } = require("googleapis");
const path = require("path");

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

// Google Sheet setup
const SPREADSHEET_ID = "18Wo8xZj0kFgEr0DVoBhIT5DSWB2qWIpwq98ZlXJjsCw";
const SHEET_NAME = "Rishabh Email Trigger";

const auth = new google.auth.GoogleAuth({
  keyFile: "service-account.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

const sheets = google.sheets({ version: "v4", auth });

// Endpoint to receive LinkedIn URL from mini app
app.post("/lookup", async (req, res) => {
  try {
    const { linkedinUrl } = req.body; // only URL now

    // Call SignalHire API using stored API Key
    await axios.post("https://www.signalhire.com/api/v1/candidate/search", {
      api_key: SIGNALHIRE_API_KEY,
      profiles: [linkedinUrl],
      callback_url: "https://email-automation-production-82fd.up.railway.app/webhook"
    });

    res.json({ status: "Lookup triggered. Data will arrive in Google Sheet via webhook." });

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Error calling SignalHire API" });
  }
});

// Webhook to receive SignalHire data
app.post("/webhook", async (req, res) => {
  try {
    const { name, email, company, title } = req.body;

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_NAME,
      valueInputOption: "RAW",
      requestBody: {
        values: [[name, email, company, title]]
      }
    });

    console.log(`Added: ${name}, ${email}`);
    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
