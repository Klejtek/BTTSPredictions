// backend/services/fetchMatches.js

const axios = require('axios');
const Match = require('../models/Match');
const cron = require('node-cron');

/**
 * Helper function for parsing the date
 * @param {string} dateStr - Date in string format
 * @returns {Date|null} - Date object or null if parsing failed
 */
const parseFixtureDate = (dateStr) => {
  const date = new Date(dateStr);
  if (!isNaN(date)) return date;
  console.error(`Invalid date format: ${dateStr}`);
  return null;
};

/**
 * Function to calculate BTTS percentage based on the last 5 matches and H2H
 */
const calculateBttsPercentage = async (homeTeamId, awayTeamId) => {
  try {
    console.log(`Wywołanie calculateBttsPercentage dla drużyn ${homeTeamId} i ${awayTeamId}`);
    
    const homeMatches = await fetchLast5Matches(homeTeamId);
    const awayMatches = await fetchLast5Matches(awayTeamId);
    const h2hMatches = await fetchH2HMatches(homeTeamId, awayTeamId);

    console.log(`Liczba meczów dla home team: ${homeMatches.length}`);
    console.log(`Liczba meczów dla away team: ${awayMatches.length}`);
    console.log(`Liczba meczów H2H: ${h2hMatches.length}`);

    const allMatches = h2hMatches.length > 0 ? [...homeMatches, ...awayMatches, ...h2hMatches] : [...homeMatches, ...awayMatches];
    if (allMatches.length === 0) return 0;

    const bttsCount = allMatches.filter(match => match.goals.home > 0 && match.goals.away > 0).length;
    const bttsPercentage = (bttsCount / allMatches.length) * 100;

    console.log(`Obliczony procent BTTS dla ${homeTeamId} vs ${awayTeamId}: ${bttsPercentage.toFixed(2)}%`);
    return Number(bttsPercentage.toFixed(2));
  } catch (error) {
    console.error('Error calculating BTTS percentage:', error);
    return 0;
  }
};

/**
 * Fetch last 5 matches for a team directly from the external API
 */
const fetchLast5Matches = async (teamId) => {
  try {
    const API_KEY = process.env.API_KEY;
    const API_HOST = process.env.API_HOST;
    const API_URL = process.env.API_URL;

    console.log(`Fetching last 5 matches for team ID ${teamId} from API...`);

    const response = await axios.get(`${API_URL}/fixtures?team=${teamId}&last=5`, {
      headers: {
        'X-RapidAPI-Key': API_KEY,
        'X-RapidAPI-Host': API_HOST,
      },
    });

    console.log(`Response for team ${teamId} - Status: ${response.status}`);
    console.log(`Full response data for team ${teamId}:`, JSON.stringify(response.data, null, 2));

    if (response.status === 200 && Array.isArray(response.data.response)) {
      console.log(`Fetched ${response.data.response.length} matches for team ID ${teamId}`);
      return response.data.response;
    } else {
      console.error(`Invalid API response for teamId ${teamId}:`, response.data);
      return [];
    }
  } catch (error) {
    console.error(`Error fetching last 5 matches for team ${teamId}:`, error);
    return [];
  }
};

/**
 * Fetch H2H matches between two teams directly from the external API
 */
const fetchH2HMatches = async (homeTeamId, awayTeamId) => {
  try {
    const API_KEY = process.env.API_KEY;
    const API_HOST = process.env.API_HOST;
    const API_URL = process.env.API_URL;

    console.log(`Fetching H2H matches for teams ${homeTeamId} and ${awayTeamId}...`);

    const response = await axios.get(`${API_URL}/fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}`, {
      headers: {
        'X-RapidAPI-Key': API_KEY,
        'X-RapidAPI-Host': API_HOST,
      },
    });

    console.log(`Response for H2H ${homeTeamId}-${awayTeamId} - Status: ${response.status}`);
    console.log(`Full H2H response data:`, JSON.stringify(response.data, null, 2));

    if (response.status === 200 && Array.isArray(response.data.response)) {
      console.log(`Fetched ${response.data.response.length} H2H matches for teams ${homeTeamId} and ${awayTeamId}`);
      return response.data.response;
    } else {
      console.error(`Invalid API response for H2H ${homeTeamId}-${awayTeamId}:`, response.data);
      return [];
    }
  } catch (error) {
    console.error(`Error fetching H2H matches between ${homeTeamId} and ${awayTeamId}:`, error);
    return [];
  }
};

/**
 * Main function to fetch matches from the API and store them in the database
 */
const fetchAndStoreMatchesWithLogging = async () => {
  try {
    console.log("Fetching match data from API with full logging...");

    const API_KEY = process.env.API_KEY;
    const API_HOST = process.env.API_HOST;
    const API_URL = process.env.API_URL;

    const today = new Date();
    const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    console.log(`Requesting fixture data for date: ${formattedDate}`);
    const response = await axios.get(`${API_URL}/fixtures?date=${formattedDate}`, {
      headers: {
        'X-RapidAPI-Key': API_KEY,
        'X-RapidAPI-Host': API_HOST,
      },
    });

    console.log(`Received fixture data: Status ${response.status}`);
    const events = response.data.response;
    if (!events || events.length === 0) {
      console.log(`No matches to save for date: ${formattedDate}`);
      return;
    }

    for (const event of events) {
      const existingMatch = await Match.findOne({ fixtureId: event.fixture.id });
      if (existingMatch) {
        console.log(`Match with fixtureId ${event.fixture.id} already exists.`);
        continue;
      }

      const fixtureDate = parseFixtureDate(event.fixture.date);
      if (!fixtureDate) {
        console.error(`Invalid fixture date for fixtureId ${event.fixture.id}`);
        continue;
      }

      const homeTeamId = event.teams.home.id;
      const awayTeamId = event.teams.away.id;

      const newMatch = new Match({
        fixtureId: event.fixture.id,
        date: fixtureDate,
        league: {
          id: event.league.id,
          name: event.league.name || 'Unknown League',
          country: event.league.country || 'Unknown Country',
          logo: event.league.logo || '',
        },
        homeTeam: {
          id: homeTeamId,
          name: event.teams.home.name,
          logo: event.teams.home.logo || '',
        },
        awayTeam: {
          id: awayTeamId,
          name: event.teams.away.name,
          logo: event.teams.away.logo || '',
        },
        goals: event.goals || { home: 0, away: 0 },
      });

      try {
        console.log(`Saving match to database: ${JSON.stringify(newMatch, null, 2)}`);
        await newMatch.save();
        console.log(`Added match: ${event.teams.home.name} vs ${event.teams.away.name}`);
      } catch (saveError) {
        console.error(`Error saving match fixtureId ${event.fixture.id}:`, saveError.message);
      }
    }
  } catch (error) {
    console.error('Error fetching or saving matches:', error.message);
  }
};

/**
 * Schedule task to fetch matches every day at 2:00 AM
 */
const scheduleFetchMatches = () => {
  cron.schedule('0 2 * * *', () => {
    console.log('Starting daily match fetch...');
    fetchAndStoreMatchesWithLogging();
  }, {
    timezone: 'Europe/Warsaw'
  });

  console.log('Match fetch schedule set for daily at 2:00 AM');
};

module.exports = { fetchAndStoreMatchesWithLogging, scheduleFetchMatches, calculateBttsPercentage, fetchLast5Matches, fetchH2HMatches };

// Optionally: Allow manual function execution
if (require.main === module) {
  fetchAndStoreMatchesWithLogging()
    .then(() => {
      console.log('Finished fetching and logging matches.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error during manual run:', err);
      process.exit(1);
    });
}
