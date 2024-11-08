// backend/routes/matches.js

const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');

/**
 * Endpoint: GET /api/matches
 * Description: Retrieve all matches, optionally filtered by date
 */
router.get('/', matchController.getAllMatches);

/**
 * Endpoint: GET /api/matches/:fixtureId
 * Description: Retrieve detailed match data by fixtureId
 */
router.get('/:fixtureId', matchController.getMatchDetails);

/**
 * Endpoint: POST /api/matches
 * Description: Add a new match to the database
 */
router.post('/', matchController.createMatch);

/**
 * Endpoint: PUT /api/matches/:fixtureId
 * Description: Update an existing match by fixtureId
 */
router.put('/:fixtureId', matchController.updateMatch);

/**
 * Endpoint: DELETE /api/matches/:fixtureId
 * Description: Delete a match by fixtureId
 */
router.delete('/:fixtureId', matchController.deleteMatch);

module.exports = router;
