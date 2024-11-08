// backend/models/Match.js

const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  fixtureId: { type: Number, required: true, unique: true },
  date: { type: Date, required: true },
  homeTeam: {
    id: { type: Number, required: true },
    name: { type: String, required: true },
    logo: { type: String, default: '' },
  },
  awayTeam: {
    id: { type: Number, required: true },
    name: { type: String, required: true },
    logo: { type: String, default: '' },
  },
  league: {
    id: { type: Number, required: true },
    name: { type: String, required: true },
    country: { type: String, required: true },
    logo: { type: String, default: '' },
  },
  goals: {
    home: { type: Number, default: 0 },
    away: { type: Number, default: 0 },
  },
}, { timestamps: true });

module.exports = mongoose.model('Match', matchSchema);
