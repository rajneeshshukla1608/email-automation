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
const SHEET_NAME = "email";

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
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
    await axios.post(
      "https://www.signalhire.com/api/v1/candidate/search",
      {
        items: [linkedinUrl],
        callbackUrl: "https://email-automation-production-82fd.up.railway.app/webhook"
      },
      {
        headers: {
          apikey: SIGNALHIRE_API_KEY
        }
      }
    );
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
  console.log("📬 Webhook received:", JSON.stringify(req.body, null, 2));

  try {
    const data = req.body;

    // Make sure data is an array (SignalHire sends array of candidates)
    const candidateData = data[0]?.candidate || {};
    if (!candidateData) {
      console.log("No candidate data found in webhook.");
      return res.sendStatus(200);
    }

    const row = [
      candidateData.fullName || "",
      candidateData.photo?.url || "",
      candidateData.locations?.map(l => l.name).join(", ") || "",
      candidateData.skills?.join(", ") || "",
      candidateData.education?.map(e => e.university).join(", ") || "",
      "NEW"
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!A:F`,
      valueInputOption: "RAW",
      requestBody: { values: [row] }
    });

    console.log(`✅ Added to sheet: ${row.join(" | ")}`);
    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error writing to sheet:", error);
    res.status(500).json({ error: error.message });
  }
});
// ============================
// Start server
// ============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
