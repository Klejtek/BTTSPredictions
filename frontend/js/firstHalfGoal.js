// topFirstHalfGoal.js
(function() {
  // Definiowanie URL API
  const API_URL = "https://api-football-v1.p.rapidapi.com/v3";
  const API_KEY = "920e9e7016msh6a7c550ac16acd3p1ddb1bjsned3cd4586e1d"; // Wstaw tutaj swój klucz API
  const API_HOST = "api-football-v1.p.rapidapi.com";

  // Elementy interfejsu
  const firstHalfGoalTableBody = document.getElementById('firstHalfGoalTableBody');
  const loader = document.getElementById('loader');

  // Funkcja do pobierania dzisiejszej daty w formacie YYYY-MM-DD
  function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Funkcja do pobierania Top 15 meczów z szansą na bramkę w pierwszej połowie
  async function fetchFirstHalfGoals() {
    try {
      if (loader) {
        loader.classList.remove('hidden');
      }

      // Pobieramy wszystkie mecze z dzisiejszej daty
      const response = await fetch(`${API_URL}/fixtures?date=${getTodayDate()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-key': API_KEY,
          'x-rapidapi-host': API_HOST,
        }
      });

      const matchesData = await response.json();
      if (!matchesData || !matchesData.response || matchesData.response.length === 0) {
        firstHalfGoalTableBody.innerHTML = '<tr><td colspan="5">Brak dostępnych meczów.</td></tr>';
        return;
      }

      // Obliczamy prawdopodobieństwa
      const topFirstHalfGoals = [];
      for (let match of matchesData.response) {
        try {
          const result = await calculateFirstHalfGoalProbability(match.teams.home.id, match.teams.away.id, match.fixture.id);

          // Dodajemy mecz tylko jeśli kursy są dostępne
          if (result.over05Odds !== 'N/A') {
            match.firstHalfGoalProbability = result.probability;
            match.firstHalfOver05Odds = result.over05Odds;
            match.bookmakerName = result.bookmakerName;
            topFirstHalfGoals.push(match);
          } else {
            console.log(`Pomijanie meczu ${match.fixture.id} z powodu braku kursów.`);
          }
        } catch (error) {
          console.error(`Błąd podczas obliczania prawdopodobieństwa dla meczu ${match.fixture.id}:`, error);
          continue;
        }
      }

      // Sortujemy wyniki po najwyższym prawdopodobieństwie
      topFirstHalfGoals.sort((a, b) => b.firstHalfGoalProbability - a.firstHalfGoalProbability);

      firstHalfGoalTableBody.innerHTML = ''; // Czyścimy poprzednie dane

      // Wyświetlamy top 15 wyników
      topFirstHalfGoals.slice(0, 15).forEach(match => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${match.teams.home.name}</td>
          <td>${match.teams.away.name}</td>
          <td>${match.firstHalfGoalProbability ? match.firstHalfGoalProbability.toFixed(2) : 'N/A'}%</td>
          <td>${match.firstHalfOver05Odds}</td>
        `;
        row.addEventListener('click', () => displayMatchDetailsFirstHalfGoal(match));
        firstHalfGoalTableBody.appendChild(row);
      });

      if (topFirstHalfGoals.length < 15) {
        console.warn(`Znaleziono tylko ${topFirstHalfGoals.length} meczów z dostępnymi kursami.`);
      }
    } catch (error) {
      console.error("Błąd w fetchFirstHalfGoals:", error);
      firstHalfGoalTableBody.innerHTML = '<tr><td colspan="5">Wystąpił problem z pobieraniem danych.</td></tr>';
    } finally {
      if (loader) {
        loader.classList.add('hidden');
      }
    }
  }

  // Funkcja do obliczania prawdopodobieństwa bramki w pierwszej połowie
  async function calculateFirstHalfGoalProbability(homeTeamId, awayTeamId, fixtureId) {
    try {
      // Pobieranie danych meczów drużyn
      const homeMatchesResponse = await fetch(`${API_URL}/fixtures?team=${homeTeamId}&last=10`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-key': API_KEY,
          'x-rapidapi-host': API_HOST,
        }
      });

      const awayMatchesResponse = await fetch(`${API_URL}/fixtures?team=${awayTeamId}&last=10`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-key': API_KEY,
          'x-rapidapi-host': API_HOST,
        }
      });

      const h2hMatchesResponse = await fetch(`${API_URL}/fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}&last=5`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-key': API_KEY,
          'x-rapidapi-host': API_HOST,
        }
      });

      // Zaktualizowany parametr bukmachera na id=8 (Bet365)
      const oddsResponse = await fetch(`${API_URL}/odds?fixture=${fixtureId}&bookmaker=8`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-key': API_KEY,
          'x-rapidapi-host': API_HOST,
        }
      });

      const homeMatchesData = await homeMatchesResponse.json();
      const awayMatchesData = await awayMatchesResponse.json();
      const h2hMatchesData = await h2hMatchesResponse.json();
      const oddsData = await oddsResponse.json();

      // Logowanie struktury oddsData do diagnostyki
      console.log(`Odds data structure for fixture ${fixtureId}:`, oddsData);

      // Obliczanie procentu meczów z bramką w pierwszej połowie dla gospodarzy
      const homeFirstHalfGoalCount = homeMatchesData.response.filter(match => match.score.halftime.home + match.score.halftime.away > 0).length;
      const homeFirstHalfGoalPercentage = (homeFirstHalfGoalCount / homeMatchesData.response.length) * 100;

      // Obliczanie procentu meczów z bramką w pierwszej połowie dla gości
      const awayFirstHalfGoalCount = awayMatchesData.response.filter(match => match.score.halftime.home + match.score.halftime.away > 0).length;
      const awayFirstHalfGoalPercentage = (awayFirstHalfGoalCount / awayMatchesData.response.length) * 100;

      // Obliczanie procentu meczów H2H z bramką w pierwszej połowie
      let h2hFirstHalfGoalPercentage = null;
      if (h2hMatchesData.response && h2hMatchesData.response.length > 0) {
        const h2hMatches = h2hMatchesData.response;
        const h2hFirstHalfGoalCount = h2hMatches.filter(match => match.score.halftime.home + match.score.halftime.away > 0).length;
        h2hFirstHalfGoalPercentage = (h2hFirstHalfGoalCount / h2hMatches.length) * 100;
      }

      // Pobieranie kursów na Over 0.5 gola w pierwszej połowie
      let over05Odds = null;
      let impliedProbabilityOver05 = null;
      let oddsBookmakerName = null;

      if (oddsData.response && oddsData.response.length > 0) {
        const fixtureOdds = oddsData.response[0];
        if (fixtureOdds.bookmakers && fixtureOdds.bookmakers.length > 0) {
          const bookmaker = fixtureOdds.bookmakers[0]; // Bet365
          oddsBookmakerName = bookmaker.name || 'N/A';
          if (bookmaker.bets && bookmaker.bets.length > 0) {
            // Logowanie dostępnych nazw zakładów
            console.log(`Dostępne nazwy zakładów dla meczu ${fixtureId}:`, bookmaker.bets.map(bet => bet.name));

            // Szukamy zakładu na "Goals Over/Under First Half"
            const overUnderBet = bookmaker.bets.find(bet => bet.name === "Goals Over/Under First Half");
            if (overUnderBet && overUnderBet.values && overUnderBet.values.length > 0) {
              // Logowanie wartości zakładów
              console.log(`Wartości zakładów dla meczu ${fixtureId}:`, overUnderBet.values);

              // Sprawdzenie dostępnych wartości
              const over05Value = overUnderBet.values.find(value => {
                const normalizedValue = value.value.toLowerCase();
                console.log(`Analiza wartości value:`, normalizedValue);
                return normalizedValue.includes("over") && normalizedValue.includes("0.5");
              });

              if (over05Value && over05Value.odd) {
                over05Odds = parseFloat(over05Value.odd);
                impliedProbabilityOver05 = (1 / over05Odds) * 100;
              }
            }
          }
        }
      }

      // Jeśli kursy nie są dostępne, ustawiamy 'N/A'
      if (!over05Odds) {
        over05Odds = 'N/A';
      }

      // Obliczanie średniego prawdopodobieństwa
      let averageFirstHalfGoalProbability;
      if (h2hFirstHalfGoalPercentage !== null) {
        // Jeśli mamy dane H2H
        const homeWeight = 0.3;
        const awayWeight = 0.3;
        const h2hWeight = 0.2;
        const oddsWeight = 0.2;

        averageFirstHalfGoalProbability =
          (homeFirstHalfGoalPercentage * homeWeight) +
          (awayFirstHalfGoalPercentage * awayWeight) +
          (h2hFirstHalfGoalPercentage * h2hWeight) +
          (impliedProbabilityOver05 ? impliedProbabilityOver05 * oddsWeight : 0);
      } else {
        // Jeśli brak danych H2H
        const homeWeight = 0.4;
        const awayWeight = 0.4;
        const oddsWeight = 0.2;

        averageFirstHalfGoalProbability =
          (homeFirstHalfGoalPercentage * homeWeight) +
          (awayFirstHalfGoalPercentage * awayWeight) +
          (impliedProbabilityOver05 ? impliedProbabilityOver05 * oddsWeight : 0);
      }

      return {
        probability: averageFirstHalfGoalProbability,
        over05Odds: over05Odds,
        bookmakerName: oddsBookmakerName
      };
    } catch (error) {
      console.error("Błąd podczas obliczania prawdopodobieństwa:", error);
      return {
        probability: 0,
        over05Odds: 'N/A',
        bookmakerName: 'N/A'
      };
    }
  }

  // Funkcja do wyświetlania szczegółów meczu (opcjonalnie)
  function displayMatchDetailsFirstHalfGoal(match) {
    // Implementacja wyświetlania szczegółów meczu
    alert(`Szczegóły meczu: ${match.teams.home.name} vs ${match.teams.away.name}`);
  }

  // Event listener dla kafelka "Bramka w 1. połowie"
  document.addEventListener('DOMContentLoaded', () => {
    const firstHalfGoalTile = document.getElementById('firstHalfGoalTile');
    const backFromFirstHalfGoal = document.getElementById('backFromFirstHalfGoal');
    const mainMenu = document.getElementById('mainMenu');
    const firstHalfGoalSection = document.getElementById('firstHalfGoalSection');

    // Funkcja do wyświetlania sekcji
    function showSection(section) {
      mainMenu.style.display = 'none';
      firstHalfGoalSection.style.display = 'none';
      section.style.display = 'block';
    }

    firstHalfGoalTile.addEventListener('click', async () => {
      showSection(firstHalfGoalSection);
      backFromFirstHalfGoal.style.display = 'inline-block';
      await fetchFirstHalfGoals();
    });

    backFromFirstHalfGoal.addEventListener('click', () => {
      firstHalfGoalSection.style.display = 'none';
      mainMenu.style.display = 'flex';
    });
  });
})();
