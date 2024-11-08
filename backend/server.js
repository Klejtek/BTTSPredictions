// backend/server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const matchRoutes = require('./routes/matches');
const topBttsRoutes = require('./routes/topBtts');
const { scheduleFetchMatches, fetchAndStoreMatchesWithLogging, fetchLast5Matches, fetchH2HMatches } = require('./services/fetchMatches');
const axios = require('axios');
require('dotenv').config();

const app = express();

// Middleware do parsowania JSON
app.use(express.json());

// Konfiguracja CORS
const corsOptions = {
  origin: ['http://localhost:5500', 'null'],
  methods: ['GET', 'POST'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Połączenie z MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Uruchomienie harmonogramu pobierania i zapisywania meczów
    scheduleFetchMatches();
    
    // Ręczne uruchomienie funkcji pobierania danych w celu zapisania ich do bazy
    console.log("Wywoływanie fetchAndStoreMatchesWithLogging() ręcznie...");
    await fetchAndStoreMatchesWithLogging();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Rejestracja tras
app.use('/api/matches', matchRoutes);
app.use('/api/top-btts', topBttsRoutes);

// Nowy endpoint do pobierania kursów dla meczu
const API_KEY = process.env.API_KEY;
const API_HOST = process.env.API_HOST;
const API_URL = process.env.API_URL;

app.get('/api/match/:id/odds', async (req, res) => {
  const fixtureId = req.params.id;

  try {
    const response = await axios.get(`${API_URL}/odds?fixture=${fixtureId}`, {
      headers: {
        'X-RapidAPI-Key': API_KEY,
        'X-RapidAPI-Host': API_HOST,
      },
    });

    const oddsData = response.data.response;
    if (oddsData.length > 0) {
      const odds = oddsData[0].bookmakers;
      res.json(odds);
    } else {
      res.status(404).json({ message: 'No odds found for this match.' });
    }
  } catch (error) {
    console.error('Error fetching odds:', error.message);
    res.status(500).json({ message: 'Error fetching odds.' });
  }
});

// Endpoint do pobierania ostatnich 5 meczów drużyny z API
app.get('/api/team/:id/last-5', async (req, res) => {
  const teamId = req.params.id;

  try {
    // Pobierz dane bezpośrednio z API zamiast z MongoDB
    const response = await axios.get(`${API_URL}/fixtures?team=${teamId}&last=5`, {
      headers: {
        'X-RapidAPI-Key': API_KEY,
        'X-RapidAPI-Host': API_HOST,
      },
    });

    const matches = response.data.response;
    res.json(matches);
  } catch (error) {
    console.error('Error fetching last 5 matches:', error.message);
    res.status(500).json({ message: 'Error fetching last 5 matches.' });
  }
});

// Endpoint do pobierania meczów H2H z API
app.get('/api/h2h/:teamId1/:teamId2', async (req, res) => {
  const { teamId1, teamId2 } = req.params;

  try {
    // Pobierz dane bezpośrednio z API zamiast z MongoDB
    const response = await axios.get(`${API_URL}/fixtures/headtohead?h2h=${teamId1}-${teamId2}`, {
      headers: {
        'X-RapidAPI-Key': API_KEY,
        'X-RapidAPI-Host': API_HOST,
      },
    });

    const h2hMatches = response.data.response;
    res.json(h2hMatches);
  } catch (error) {
    console.error('Error fetching H2H matches:', error.message);
    res.status(500).json({ message: 'Error fetching H2H matches.' });
  }
});

// Funkcja obliczająca procent BTTS na podstawie meczów
async function calculateBttsPercentage(homeTeamId, awayTeamId, leagueId) {
  const last5HomeMatches = await fetchLast5Matches(homeTeamId);
  const last5AwayMatches = await fetchLast5Matches(awayTeamId);
  const h2hMatches = await fetchH2HMatches(homeTeamId, awayTeamId);

  const allMatches = [...last5HomeMatches, ...last5AwayMatches, ...h2hMatches];
  
  // Logika do obliczania procentu BTTS, uwzględniając wagę ligi
  const leagueWeights = {
    'Premier League': 1.5,
    'La Liga': 1.4,
    'Bundesliga': 1.3,
    // Dodaj inne ligi z ich wagami
  };

  const weight = leagueWeights[leagueId] || 1; // Domyślna waga to 1

  let bttsCount = 0;
  allMatches.forEach(match => {
    if (match.goals.home > 0 && match.goals.away > 0) {
      bttsCount++;
    }
  });

  const bttsPercentage = (bttsCount / allMatches.length) * 100 * weight;

  return bttsPercentage.toFixed(2); // Zwróć z dwiema cyframi po przecinku
}

// Nowy endpoint do pobierania top 10 meczów BTTS z API dla wszystkich meczów dzisiejszych
app.get('/api/top-btts-with-api', async (req, res) => {
  try {
    // Pobierz dzisiejsze mecze z MongoDB
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const matches = await Match.find({ date: { $gte: startOfDay, $lt: endOfDay } });

    // Obsługa przypadku braku meczów
    if (matches.length === 0) {
      return res.status(404).json({ message: 'No matches found for today.' });
    }

    // Oblicz procent BTTS dla każdego meczu korzystając z API
    const bttsMatches = await Promise.all(matches.slice(0, 10).map(async match => { // Przetwórz tylko 10 meczów na początek
      try {
        console.log(`Fetching details for match ${match.fixtureId}...`);
        // Pobierz dane szczegółowe dla danego meczu z API
        const response = await axios.get(`${API_URL}/fixtures?id=${match.fixtureId}`, {
          headers: {
            'X-RapidAPI-Key': API_KEY,
            'X-RapidAPI-Host': API_HOST,
          },
        });

        const detailedMatch = response.data.response[0];
        if (!detailedMatch) {
          console.error(`No detailed data found for match ${match.fixtureId}`);
          return null;
        }

        const goals = detailedMatch.goals;
        console.log(`Goals for match ${match.fixtureId}: Home - ${goals.home}, Away - ${goals.away}`);

        // Oblicz procent BTTS na podstawie szczegółowych danych
        const bttsPercentage = (goals.home > 0 && goals.away > 0) ? 100 : 0;

        return {
          ...match.toObject(),
          bttsPercentage: parseFloat(bttsPercentage),
        };
      } catch (error) {
        console.error(`Error fetching details for match ${match.fixtureId}:`, error.message);
        return null;
      }
    }));

    // Filtrowanie nulli z ewentualnych błędów API
    const validBttsMatches = bttsMatches.filter(match => match !== null);

    // Posortuj mecze według procentu BTTS i wybierz top 10
    const top10BttsMatches = validBttsMatches.sort((a, b) => b.bttsPercentage - a.bttsPercentage).slice(0, 10);

    res.json(top10BttsMatches);
  } catch (error) {
    console.error('Error fetching top 10 BTTS matches from API:', error.message);
    res.status(500).json({ message: 'Error fetching top 10 BTTS matches from API.' });
  }
});

// Endpoint domyślny
app.get('/', (req, res) => {
  res.send('Backend działa poprawnie.');
});

// Start serwera
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
