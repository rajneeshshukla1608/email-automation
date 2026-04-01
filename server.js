const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { google } = require("googleapis");
const path = require("path");

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

// Load SignalHire API key from Railway environment variable
const SIGNALHIRE_API_KEY = process.env.SIGNALHIRE_API_KEY;

// Google Sheet setup
const SPREADSHEET_ID = "18Wo8xZj0kFgEr0DVoBhIT5DSWB2qWIpwq98ZlXJjsCw";
const SHEET_NAME = "Rishabh Email Trigger";

const auth = new google.auth.GoogleAuth({
  keyFile: "service-account.json", // ensure this file is uploaded in Railway
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

const sheets = google.sheets({ version: "v4", auth });

// ============================
// Endpoint to trigger SignalHire lookup
// ============================
app.post("/lookup", async (req, res) => {
  try {
    const { linkedinUrl } = req.body;

    if (!linkedinUrl) {
      return res.status(400).json({ error: "LinkedIn URL is required" });
    }

    // Call SignalHire API with stored API key and your webhook URL
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

// ============================
// Webhook to receive SignalHire enriched data
// ============================
app.post("/webhook", async (req, res) => {
  try {
    console.log("Webhook received:", JSON.stringify(req.body, null, 2));

    // SignalHire may wrap candidate data under "candidate"
    const candidate = req.body.candidate || req.body;
    const name = candidate.name || "";
    const email = candidate.email || "";
    const role = candidate.title || "";       // maps to your 'role' column
    const company = candidate.company || "";

    // Append row to Google Sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:E`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[name, email, role, company, "NEW"]]
      }
    });

    console.log(`✅ Added row: ${name}, ${email}, ${role}, ${company}`);
    res.sendStatus(200);
  } catch (error) {
    console.error("Error writing to sheet:", error);
    res.sendStatus(500);
  }
});

// ============================
// Start server
// ============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
