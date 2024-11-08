const axios = require('axios');
const Match = require('../models/Match');

// Funkcja do obliczania BTTS i Over/Under
exports.calculateCombinedOdds = async (homeTeamId, awayTeamId) => {
  // Implementacja logiki podobna do frontendowej
  // Pobierz H2H, ostatnie mecze itp.
  // Zwróć obliczone statystyki
  // Możesz skorzystać z kodu z frontendowego app.js i dostosować go tutaj
  // ...
  return {
    bttsOdds: 56,
    overUnderOdds: {
      "2.5": 60,
      "3.5": 40
      // ...
    },
    h2hStats: {
      homeWins: 2,
      draws: 1,
      awayWins: 3
    }
  };
};

// Funkcja do przetwarzania kursów
exports.getOddsFromAPI = (oddsData) => {
  // Implementacja podobna do frontendowej
  // Przetwarzanie kursów Over/Under i BTTS
  // ...
  return { overUnderOddsAPI: {}, bttsOddsAPI: {} };
};
