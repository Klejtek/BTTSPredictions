// backend/routes/matchDetails.js

const express = require('express');
const axios = require('axios');
const router = express.Router();
require('dotenv').config();

const API_KEY = process.env.API_KEY;
const API_HOST = process.env.API_HOST;
const API_URL = process.env.API_URL;

// Endpoint do pobierania szczegółowych kursów dla konkretnego meczu
router.get('/:id/odds', async (req, res) => {
    const fixtureId = req.params.id;

    try {
        // Fetch odds from the external API
        const response = await axios.get(`${API_URL}/odds?fixture=${fixtureId}`, {
            headers: {
                'X-RapidAPI-Key': API_KEY,
                'X-RapidAPI-Host': API_HOST,
            },
        });

        const oddsData = response.data.response;
        if (oddsData.length > 0) {
            const odds = oddsData[0].bookmakers; // Assuming you want the first bookmaker's odds
            res.json(odds);
        } else {
            res.status(404).json({ message: 'No odds found for this match.' });
        }
    } catch (error) {
        console.error('Error fetching odds:', error.message);
        res.status(500).json({ message: 'Error fetching odds.' });
    }
});

module.exports = router;
