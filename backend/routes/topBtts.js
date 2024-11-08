// backend/routes/topBtts.js

const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');

// Endpoint: GET /api/top-btts
router.get('/', matchController.getTopBtts);

module.exports = router;
