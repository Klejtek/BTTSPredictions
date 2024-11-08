// backend/controllers/matchController.js

const axios = require('axios');
const Match = require('../models/Match');
const cron = require('node-cron');

/**
 * Pobierz wszystkie mecze, opcjonalnie filtrowane po dacie
 * GET /api/matches?date=YYYY-MM-DD
 */
exports.getAllMatches = async (req, res) => {
  const { date } = req.query; // Pobiera parametr 'date' z zapytania

  try {
    let filter = {};
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: start, $lt: end };
    }

    const matches = await Match.find(filter);
    res.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Pobierz szczegółowe dane meczu po fixtureId
 * GET /api/matches/:fixtureId
 */
exports.getMatchDetails = async (req, res) => {
  const { fixtureId } = req.params;

  try {
    const match = await Match.findOne({ fixtureId });
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }
    res.json(match);
  } catch (error) {
    console.error('Error fetching match details:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Pobierz Top 10 meczów BTTS
 * GET /api/top-btts
 */
exports.getTopBtts = async (req, res) => {
  try {
    const topBtts = await Match.find({ bttsPercentage: { $gt: 0 } })
      .sort({ bttsPercentage: -1 })
      .limit(10);
    res.json(topBtts);
  } catch (error) {
    console.error('Error fetching Top BTTS:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Dodaj nowy mecz do bazy danych
 * POST /api/matches
 */
exports.createMatch = async (req, res) => {
  const newMatch = new Match(req.body);

  try {
    const savedMatch = await newMatch.save();
    res.status(201).json(savedMatch);
  } catch (error) {
    console.error('Error creating match:', error);
    res.status(400).json({ error: 'Bad Request', details: error.message });
  }
};

/**
 * Aktualizuj istniejący mecz po fixtureId
 * PUT /api/matches/:fixtureId
 */
exports.updateMatch = async (req, res) => {
  const { fixtureId } = req.params;

  try {
    const updatedMatch = await Match.findOneAndUpdate(
      { fixtureId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedMatch) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json(updatedMatch);
  } catch (error) {
    console.error('Error updating match:', error);
    res.status(400).json({ error: 'Bad Request', details: error.message });
  }
};

/**
 * Usuń mecz po fixtureId
 * DELETE /api/matches/:fixtureId
 */
exports.deleteMatch = async (req, res) => {
  const { fixtureId } = req.params;

  try {
    const deletedMatch = await Match.findOneAndDelete({ fixtureId });

    if (!deletedMatch) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({ message: 'Match deleted successfully' });
  } catch (error) {
    console.error('Error deleting match:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Funkcja do pobierania meczów z RapidAPI i zapisywania ich w bazie danych
 */
exports.fetchAndStoreMatches = async () => {
  try {
    const API_KEY = process.env.API_KEY; // Twój klucz API z RapidAPI
    const API_HOST = 'YOUR_RAPIDAPI_HOST'; // Zmień na host Twojego API z RapidAPI
    const API_URL = 'YOUR_RAPIDAPI_ENDPOINT'; // Zmień na endpoint Twojego API

    // Obliczenie dzisiejszej daty w formacie YYYY-MM-DD
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

    // Przykładowe zapytanie do RapidAPI
    const response = await axios.get(`${API_URL}?date=${formattedDate}`, {
      headers: {
        'X-RapidAPI-Key': API_KEY,
        'X-RapidAPI-Host': API_HOST,
      },
    });

    const events = response.data.events; // Dostosuj do struktury odpowiedzi API

    if (!events || events.length === 0) {
      console.log(`Brak meczów do zapisania na dzień: ${formattedDate}`);
      return;
    }

    for (const event of events) {
      // Sprawdzenie, czy mecz już istnieje w bazie
      const existingMatch = await Match.findOne({ fixtureId: event.idEvent });

      if (existingMatch) {
        console.log(`Mecz o fixtureId ${event.idEvent} już istnieje.`);
        continue; // Przejdź do następnego meczu
      }

      // Tworzenie nowego obiektu meczu
      const newMatch = new Match({
        fixtureId: event.idEvent,
        date: new Date(event.dateEvent + 'T' + event.strTime + 'Z'), // Dostosuj do formatu daty z API
        homeTeam: {
          id: event.idHomeTeam,
          name: event.strHomeTeam,
          logo: event.strHomeTeamBadge || '', // Jeśli API dostarcza logo
        },
        awayTeam: {
          id: event.idAwayTeam,
          name: event.strAwayTeam,
          logo: event.strAwayTeamBadge || '',
        },
        bttsPercentage: event.bttsPercentage || 0, // Dostosuj do dostępnych danych
        odds: event.odds || [],
        overUnderPercentages: event.overUnderPercentages || {},
        h2hStats: event.h2hStats || {},
        standings: event.standings || [],
        homeForm: event.homeForm || {},
        awayForm: event.awayForm || {},
        goals: event.goals || { home: 0, away: 0 },
      });

      await newMatch.save();
      console.log(`Dodano mecz: ${event.strHomeTeam} vs ${event.strAwayTeam}`);
    }
  } catch (error) {
    console.error('Błąd podczas pobierania lub zapisywania meczów:', error.message);
  }
};

/**
 * Harmonogram zadania do pobierania meczów codziennie o określonej godzinie
 * Przykład: codziennie o 2:00 AM
 */
exports.scheduleFetchMatches = () => {
  cron.schedule('0 2 * * *', () => {
    console.log('Rozpoczynanie pobierania meczów dnia...');
    exports.fetchAndStoreMatches();
  }, {
    timezone: 'Europe/Warsaw' // Ustawienie strefy czasowej
  });

  console.log('Harmonogram pobierania meczów ustawiony na codziennie o 2:00 AM');
};
