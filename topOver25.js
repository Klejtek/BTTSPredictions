// topOver25.js
(function() {
  // Definiowanie URL API
  const API_URL = "https://api-football-v1.p.rapidapi.com/v3";
  const API_KEY = "920e9e7016msh6a7c550ac16acd3p1ddb1bjsned3cd4586e1d"; // Wstaw tutaj swój klucz API
  const API_HOST = "api-football-v1.p.rapidapi.com";

  // Elementy interfejsu
  const topOver25TableBody = document.getElementById('topOver25TableBody');
  const loader = document.getElementById('loader');

  // Funkcja do pobierania dzisiejszej daty w formacie YYYY-MM-DD
  function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Funkcja do pobierania Top 15 Over 2.5 z dzisiejszych meczów
  async function fetchTopOver25() {
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
        topOver25TableBody.innerHTML = '<tr><td colspan="5">Brak dostępnych meczów z szansami Over 2.5 na dzisiaj.</td></tr>';
        return;
      }

      // Obliczamy procenty Over 2.5 na podstawie danych historycznych i kursów
      const topOver25 = [];
      for (let match of matchesData.response) {
        try {
          const result = await calculateOver25Percentage(match.teams.home.id, match.teams.away.id, match.fixture.id);
          match.over25Percentage = result.over25Percentage;
          match.over25Odds = result.over25Odds;
          topOver25.push(match);
        } catch (error) {
          console.error(`Błąd podczas obliczania Over 2.5 dla meczu ${match.fixture.id}:`, error);
          continue;
        }
      }

      // Sortujemy wyniki po najwyższym procencie Over 2.5
      topOver25.sort((a, b) => b.over25Percentage - a.over25Percentage);

      topOver25TableBody.innerHTML = ''; // Czyścimy poprzednie dane

      // Wyświetlamy top 15 wyników
      topOver25.slice(0, 15).forEach(match => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${match.teams.home.name}</td>
          <td>${match.teams.away.name}</td>
          <td>${match.over25Percentage ? match.over25Percentage.toFixed(2) : 'N/A'}%</td>
          <td>${match.over25Odds ? match.over25Odds : 'N/A'}</td>
        `;
        row.addEventListener('click', () => displayMatchDetailsOver25(match));
        topOver25TableBody.appendChild(row);
      });

      if (topOver25.length < 15) {
        console.warn(`Znaleziono tylko ${topOver25.length} meczów z dostępnymi danymi Over 2.5.`);
      }
    } catch (error) {
      console.error("Błąd w fetchTopOver25:", error);
      topOver25TableBody.innerHTML = '<tr><td colspan="5">Wystąpił problem z pobieraniem danych Over 2.5.</td></tr>';
    } finally {
      if (loader) {
        loader.classList.add('hidden');
      }
    }
  }

  // Zaktualizowana funkcja do obliczania procentu Over 2.5, zwracająca obiekt z wynikami
  async function calculateOver25Percentage(homeTeamId, awayTeamId, fixtureId) {
    console.log(`Wywołanie calculateOver25Percentage dla drużyn ${homeTeamId} i ${awayTeamId}`);
    try {
      // Pobieranie kursów na zwycięstwo gospodarzy i gości
      const oddsResponse = await fetch(`${API_URL}/odds?fixture=${fixtureId}&bookmaker=8`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-key': API_KEY,
          'x-rapidapi-host': API_HOST,
        }
      });

      const oddsData = await oddsResponse.json();

      if (!oddsData.response || oddsData.response.length === 0) {
        console.error("Brak dostępnych kursów na ten mecz.");
        return { over25Percentage: 0, over25Odds: 'N/A' };
      }

      const bookmaker = oddsData.response[0];
      const oddsMarkets = bookmaker.bookmakers[0].bets.find(bet => bet.name === "Match Winner");

      if (!oddsMarkets) {
        console.error("Brak kursów na zwycięstwo gospodarzy i gości.");
        return { over25Percentage: 0, over25Odds: 'N/A' };
      }

      const homeWinOdds = oddsMarkets.values.find(value => value.value === "Home");
      const awayWinOdds = oddsMarkets.values.find(value => value.value === "Away");

      if (!homeWinOdds || !awayWinOdds) {
        console.error("Brak pełnych kursów na zwycięstwo gospodarzy lub gości.");
        return { over25Percentage: 0, over25Odds: 'N/A' };
      }

      // Pobieranie danych historycznych drużyn
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

      const homeMatchesData = await homeMatchesResponse.json();
      const awayMatchesData = await awayMatchesResponse.json();
      const h2hMatchesData = await h2hMatchesResponse.json();

      if (!homeMatchesData.response || !awayMatchesData.response) {
        console.error('Błąd: Nie udało się pobrać danych meczów.');
        return { over25Percentage: 0, over25Odds: 'N/A' };
      }

      // Obliczanie Over 2.5 dla drużyny gospodarzy
      const homeOver25Count = homeMatchesData.response.filter(match => (match.goals.home + match.goals.away) > 2.5).length;
      const homeOver25Percentage = (homeOver25Count / homeMatchesData.response.length) * 100;

      // Obliczanie Over 2.5 dla drużyny gości
      const awayOver25Count = awayMatchesData.response.filter(match => (match.goals.home + match.goals.away) > 2.5).length;
      const awayOver25Percentage = (awayOver25Count / awayMatchesData.response.length) * 100;

      // Obliczanie Over 2.5 dla meczów H2H
      let h2hOver25Percentage = null;
      if (h2hMatchesData.response && h2hMatchesData.response.length > 0) {
        const h2hMatches = h2hMatchesData.response;
        const h2hOver25Count = h2hMatches.filter(match => (match.goals.home + match.goals.away) > 2.5).length;
        h2hOver25Percentage = (h2hOver25Count / h2hMatches.length) * 100;
      }

      // Pobieranie kursów na Over 2.5
      let over25Odds = null;
      let impliedProbabilityOver25 = null;
      const overUnderMarkets = bookmaker.bookmakers[0].bets.find(bet => bet.name === "Goals Over/Under");
      if (overUnderMarkets) {
        const over25Market = overUnderMarkets.values.find(value => value.value === "Over 2.5");
        if (over25Market) {
          over25Odds = parseFloat(over25Market.odd);
          impliedProbabilityOver25 = (1 / over25Odds) * 100;
        }
      }

      // Obliczanie średniego procentu Over 2.5
      let averageOver25Percentage;
      if (h2hOver25Percentage !== null) {
        // Jeśli mamy mecze H2H, obliczamy średnią ważoną
        const homeWeight = 0.3;
        const awayWeight = 0.3;
        const h2hWeight = 0.2;
        const oddsWeight = 0.2;

        averageOver25Percentage =
          (homeOver25Percentage * homeWeight) +
          (awayOver25Percentage * awayWeight) +
          (h2hOver25Percentage * h2hWeight) +
          (impliedProbabilityOver25 ? impliedProbabilityOver25 * oddsWeight : 0);
      } else {
        // Jeśli brak meczów H2H, obliczamy średnią ważoną bez H2H
        const homeWeight = 0.4;
        const awayWeight = 0.4;
        const oddsWeight = 0.2;

        averageOver25Percentage =
          (homeOver25Percentage * homeWeight) +
          (awayOver25Percentage * awayWeight) +
          (impliedProbabilityOver25 ? impliedProbabilityOver25 * oddsWeight : 0);
      }

      console.log(`Procent Over 2.5 dla gospodarzy: ${homeOver25Percentage.toFixed(2)}%`);
      console.log(`Procent Over 2.5 dla gości: ${awayOver25Percentage.toFixed(2)}%`);
      if (h2hOver25Percentage !== null) {
        console.log(`Procent Over 2.5 dla H2H: ${h2hOver25Percentage.toFixed(2)}%`);
      }
      if (impliedProbabilityOver25 !== null) {
        console.log(`Implikowane prawdopodobieństwo Over 2.5 z kursów: ${impliedProbabilityOver25.toFixed(2)}%`);
      }
      console.log(`Średni procent Over 2.5: ${averageOver25Percentage.toFixed(2)}%`);

      return {
        over25Percentage: averageOver25Percentage,
        over25Odds: over25Odds || 'N/A',
      };
    } catch (error) {
      console.error("Błąd podczas obliczania procentu Over 2.5:", error);
      return {
        over25Percentage: 0,
        over25Odds: 'N/A',
      };
    }
  }

  // Funkcja do wyświetlania szczegółów meczu Over 2.5 (opcjonalnie)
  function displayMatchDetailsOver25(match) {
    // Implementacja wyświetlania szczegółów meczu
    alert(`Szczegóły meczu: ${match.teams.home.name} vs ${match.teams.away.name}`);
  }

  // Event listener dla kafelka "Top 15 Over 2.5"
  document.addEventListener('DOMContentLoaded', () => {
    const topOver25Tile = document.getElementById('topOver25Tile');
    const backFromTopOver25 = document.getElementById('backFromTopOver25');
    const mainMenu = document.getElementById('mainMenu');
    const topOver25Section = document.getElementById('topOver25Section');

    // Funkcja do wyświetlania sekcji
    function showSection(section) {
      mainMenu.style.display = 'none';
      topOver25Section.style.display = 'none';
      section.style.display = 'block';
    }

    topOver25Tile.addEventListener('click', async () => {
      showSection(topOver25Section);
      backFromTopOver25.style.display = 'inline-block';
      await fetchTopOver25();
    });

    backFromTopOver25.addEventListener('click', () => {
      topOver25Section.style.display = 'none';
      mainMenu.style.display = 'flex';
    });
  });
})();
