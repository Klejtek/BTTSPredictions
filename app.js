
// Definiowanie URL API
const API_URL = "https://api-football-v1.p.rapidapi.com/v3";
const API_KEY = "920e9e7016msh6a7c550ac16acd3p1ddb1bjsned3cd4586e1d"; // Upewnij się, że tutaj wstawisz swój rzeczywisty klucz API
const API_HOST = "api-football-v1.p.rapidapi.com";

// Element kontenera dla meczów
const matchesContainer = document.getElementById('matchesContainer');

// Zmienna globalna do przechowywania wszystkich meczów pobranych z API
let allMatches = [];

// Funkcja do pobierania dzisiejszej daty w formacie YYYY-MM-DD
function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Funkcja do pobierania wszystkich meczów na podstawie daty z API
async function fetchMatches(date = getTodayDate()) {
  try {
    const loader = document.getElementById('loader');
    if (loader) {
      loader.classList.remove('hidden');
    }

    const response = await fetch(`${API_URL}/fixtures?date=${date}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': API_HOST,
      }
    });

    const data = await response.json();

    if (data && data.response && data.response.length > 0) {
      allMatches = data.response; // Zapisujemy pobrane mecze w zmiennej globalnej

      // Logowanie pełnych danych każdego meczu, aby zobaczyć ich strukturę
      allMatches.forEach((match, index) => {
        console.log(`Dane meczu ${index + 1}:`, match);
      });

      groupByCountryAndLeague(allMatches);
    } else {
      matchesContainer.innerHTML = "<p>Brak dostępnych meczów na wybraną datę.</p>";
    }
  } catch (error) {
    console.error("Błąd:", error);
    matchesContainer.innerHTML = "<p>Nie udało się załadować danych.</p>";
  } finally {
    const loader = document.getElementById('loader');
    if (loader) {
      loader.classList.add('hidden');
    }
  }
}

// Funkcja do pobierania kursów BTTS dla danego meczu z bukmachera ID 8
async function fetchBttsOddsForMatch(fixtureId) {
  const apiURL = `${API_URL}/odds?fixture=${fixtureId}&bookmaker=8`;

  try {
    const response = await fetch(apiURL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': API_HOST,
      }
    });

    if (!response.ok) {
      console.warn(`Nie udało się pobrać kursów dla meczu ${fixtureId}. Status: ${response.status}`);
      return null; // Zwracamy null, jeśli nie udało się pobrać kursów
    }

    const oddsData = await response.json();

    if (!oddsData || !oddsData.response || !Array.isArray(oddsData.response)) {
      console.warn(`Odpowiedź dla kursów meczu ${fixtureId} nie jest w oczekiwanym formacie:`, oddsData);
      return null; // Zwracamy null, jeśli odpowiedź jest w nieoczekiwanym formacie
    }

    // Przeszukiwanie odpowiedniej struktury danych, aby znaleźć kursy na BTTS
    let bttsYes = null;

    oddsData.response.forEach(responseEntry => {
      responseEntry.bookmakers.forEach(bookmaker => {
        if (bookmaker && bookmaker.bets) {
          bookmaker.bets.forEach(bet => {
            if (bet.name === "Both Teams Score") {
              bet.values.forEach(value => {
                if (value.value === "Yes") {
                  bttsYes = parseFloat(value.odd);
                }
              });
            }
          });
        }
      });
    });

    console.log(`Kurs BTTS (Yes) dla meczu ${fixtureId}: ${bttsYes}`);
    return bttsYes;

  } catch (error) {
    console.error(`Błąd podczas pobierania kursów dla meczu ${fixtureId}:`, error);
    return null;
  }
}

// Funkcja do pobierania Top 10 BTTS z dzisiejszych meczów
async function fetchTopBtts() {
  try {
    const loader = document.getElementById('loader');
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

    const matches = await response.json();
    if (!matches || !matches.response || matches.response.length === 0) {
      document.getElementById('topBttsTableBody').innerHTML = '<tr><td colspan="4">Brak dostępnych meczów z szansami BTTS na dzisiaj.</td></tr>';
      return;
    }

    // Obliczamy procenty BTTS na podstawie danych historycznych oraz kursów bukmacherskich
    const topBtts = [];
    for (let match of matches.response) {
      try {
        // Pobieranie kursów BTTS dla każdego meczu bezpośrednio z API
        const bttsOdds = await fetchBttsOddsForMatch(match.fixture.id);

        // Pomijamy mecz, jeśli nie ma kursów na BTTS
        if (bttsOdds === null) {
          console.warn(`Pomijamy mecz ${match.teams.home.name} vs ${match.teams.away.name} z powodu braku kursów na BTTS.`);
          continue; // Przechodzimy do następnego meczu
        }

        const bttsPercentage = await calculateBttsPercentage(match.teams.home.id, match.teams.away.id);
        match.bttsPercentage = bttsPercentage;
        match.bttsOdds = bttsOdds;
        topBtts.push(match);
      } catch (oddsError) {
        console.error(`Błąd podczas pobierania kursów dla meczu ${match.fixture.id}:`, oddsError);
        continue; // Przechodzimy do następnego meczu
      }
    }

    // Sortujemy wyniki po najwyższym procencie BTTS
    topBtts.sort((a, b) => b.bttsPercentage - a.bttsPercentage);

    const topBttsTableBody = document.getElementById('topBttsTableBody');
    if (!topBttsTableBody) {
      console.error("Element o ID 'topBttsTableBody' nie istnieje.");
      return;
    }
    topBttsTableBody.innerHTML = ''; // Czyścimy poprzednie dane

    // Wyświetlamy top 10 wyników
    topBtts.slice(0, 10).forEach(match => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${match.teams.home.name}</td>
        <td>${match.teams.away.name}</td>
        <td>${match.bttsPercentage ? match.bttsPercentage.toFixed(2) : 'N/A'}%</td>
        <td>${match.bttsOdds ? match.bttsOdds.toFixed(2) : 'N/A'}</td>
      `;
      row.addEventListener('click', () => displayMatchDetails(match));
      topBttsTableBody.appendChild(row);
    });

    if (topBtts.length < 10) {
      console.warn(`Znaleziono tylko ${topBtts.length} meczów z dostępnymi kursami BTTS.`);
    }
  } catch (error) {
    console.error("Błąd w fetchTopBtts:", error);
    const topBttsTableBody = document.getElementById('topBttsTableBody');
    if (topBttsTableBody) {
      topBttsTableBody.innerHTML = '<tr><td colspan="4">Wystąpił problem z pobieraniem danych BTTS.</td></tr>';
    }
  } finally {
    const loader = document.getElementById('loader');
    if (loader) {
      loader.classList.add('hidden');
    }
  }
}

// Funkcja do obliczania procentu BTTS (Obie drużyny strzelą)
async function calculateBttsPercentage(homeTeamId, awayTeamId, odds) {
  console.log(`Wywołanie calculateBttsPercentage dla drużyn ${homeTeamId} i ${awayTeamId}`);
  try {
    // Pobieranie danych historycznych bezpośrednio z API
    const homeMatchesResponse = await fetch(`${API_URL}/fixtures?team=${homeTeamId}&last=5`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': API_HOST,
      }
    });

    const awayMatchesResponse = await fetch(`${API_URL}/fixtures?team=${awayTeamId}&last=5`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': API_HOST,
      }
    });

    const h2hResponse = await fetch(`${API_URL}/fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': API_HOST,
      }
    });

    const homeMatches = await homeMatchesResponse.json();
    const awayMatches = await awayMatchesResponse.json();
    const h2hMatches = await h2hResponse.json();

    if (!homeMatches.response || !awayMatches.response || !h2hMatches.response) {
      console.error('Błąd: Nie udało się pobrać jednego lub więcej zestawów danych.');
      return 0;
    }

    const allMatches = [...homeMatches.response, ...awayMatches.response, ...h2hMatches.response];
    const totalMatches = allMatches.length;
    const bttsCount = allMatches.filter(match => match.goals.home > 0 && match.goals.away > 0).length;

    let bttsPercentage = totalMatches > 0 ? (bttsCount / totalMatches) * 100 : 0;

    // Pobieranie kursów na zwycięstwo drużyn
    const homeWinOdds = odds?.homeWin || null;
    const awayWinOdds = odds?.awayWin || null;

    console.log(`Kursy na zwycięstwo gospodarzy: ${homeWinOdds}`);
    console.log(`Kursy na zwycięstwo gości: ${awayWinOdds}`);

    if (homeWinOdds && awayWinOdds) {
      // Przeliczanie kursów na szanse wyrażone w procentach
      const homeWinProbability = 1 / homeWinOdds * 100;
      const awayWinProbability = 1 / awayWinOdds * 100;

      console.log(`Szansa na zwycięstwo gospodarzy: ${homeWinProbability.toFixed(2)}%`);
      console.log(`Szansa na zwycięstwo gości: ${awayWinProbability.toFixed(2)}%`);

      // Sprawdzenie, czy mamy znaczne różnice w kursach (dominacja jednej z drużyn)
      if (homeWinProbability > 80 || awayWinProbability > 80) {
        bttsPercentage *= 0.6; // Zmniejszenie o 40% przy bardzo dużej różnicy w kursach
        console.log(`Zmniejszenie procentu BTTS do ${bttsPercentage.toFixed(2)}% z powodu dużych różnic w kursach.`);
      } else if (homeWinProbability > 70 || awayWinProbability > 70) {
        bttsPercentage *= 0.75; // Zmniejszenie o 25% przy umiarkowanej różnicy w kursach
        console.log(`Zmniejszenie procentu BTTS do ${bttsPercentage.toFixed(2)}% z powodu umiarkowanej różnicy w kursach.`);
      }
    } else {
      console.log("Nie udało się pobrać kursów, brak zmiany procentu BTTS.");
    }

    console.log(`Obliczony procent BTTS po uwzględnieniu kursów: ${bttsPercentage.toFixed(2)}%`);

    return Number(bttsPercentage.toFixed(2));
  } catch (error) {
    console.error("Błąd podczas obliczania procentu BTTS:", error);
    return 0;
  }
}

// Funkcja do grupowania meczów według kraju i ligi
function groupByCountryAndLeague(matches) {
  const countries = {};

  matches.forEach(match => {
    const country = match.league?.country || "Nieznany kraj";
    const league = match.league?.name || "Nieznana liga";

    if (!countries[country]) countries[country] = {};
    if (!countries[country][league]) countries[country][league] = [];
    countries[country][league].push(match);
  });

  displayCountries(countries);
}

// **Zaktualizowana funkcja displayCountries z sortowaniem alfabetycznym**
function displayCountries(countries) {
  matchesContainer.innerHTML = ''; // Czyścimy kontener z meczami

  // Pobranie posortowanej listy krajów
  const sortedCountries = Object.keys(countries).sort((a, b) => a.localeCompare(b));

  sortedCountries.forEach(country => {
    // Tworzenie elementu <details> dla kraju
    const countryDetails = document.createElement('details');
    countryDetails.className = 'country-details';

    // Tworzenie elementu <summary> dla kraju
    const countrySummary = document.createElement('summary');
    countrySummary.textContent = country;
    countryDetails.appendChild(countrySummary);

    // Pobranie posortowanej listy lig dla danego kraju
    const sortedLeagues = Object.keys(countries[country]).sort((a, b) => a.localeCompare(b));

    sortedLeagues.forEach(league => {
      // Tworzenie elementu <details> dla ligi wewnątrz kraju
      const leagueDetails = document.createElement('details');
      leagueDetails.className = 'league-details';

      // Tworzenie elementu <summary> dla ligi
      const leagueSummary = document.createElement('summary');
      leagueSummary.textContent = league;
      leagueDetails.appendChild(leagueSummary);

      // Tworzenie listy meczów w lidze
      const matchesList = document.createElement('ul');
      matchesList.className = 'matches-list';

      // Opcjonalnie: Sortowanie meczów w lidze alfabetycznie według nazwy drużyn
      const sortedMatches = countries[country][league].sort((a, b) => {
        const matchA = `${a.teams.home.name} vs ${a.teams.away.name}`;
        const matchB = `${b.teams.home.name} vs ${b.teams.away.name}`;
        return matchA.localeCompare(matchB);
      });

      sortedMatches.forEach(match => {
        const matchItem = document.createElement('li');
        matchItem.textContent = `${match.teams.home.name} vs ${match.teams.away.name}`;
        matchItem.addEventListener('click', () => displayMatchDetails(match));
        matchesList.appendChild(matchItem);
      });

      leagueDetails.appendChild(matchesList);
      countryDetails.appendChild(leagueDetails);
    });

    matchesContainer.appendChild(countryDetails);
  });
}

// Funkcja do wyświetlania szczegółów meczu
async function displayMatchDetails(match) {
  matchesContainer.innerHTML = ""; // Czyści główny kontener

  // Dodanie przycisku powrotu
  const backButton = document.createElement("button");
  backButton.innerHTML = "&larr; Powrót";
  backButton.className = "back-button";
  backButton.onclick = () => {
    hideAllSections();
    mainMenu.style.display = 'flex';
  };
  matchesContainer.appendChild(backButton);

  try {
    // Znajdujemy szczegóły dla wybranego meczu na podstawie jego ID
    const detailedMatch = allMatches.find(m => m.fixture?.id === match.fixture?.id);

    if (!detailedMatch) {
      matchesContainer.innerHTML += "<p>Nie znaleziono szczegółów meczu.</p>";
      return;
    }

    // Użycie bezpiecznego dostępu do właściwości oraz wartości domyślnych w przypadku braku danych
    const homeTeamName = detailedMatch.teams?.home?.name || "Unknown Home Team";
    const awayTeamName = detailedMatch.teams?.away?.name || "Unknown Away Team";
    const homeTeamLogo = detailedMatch.teams?.home?.logo || "assets/images/placeholder_team_logo.png";
    const awayTeamLogo = detailedMatch.teams?.away?.logo || "assets/images/placeholder_team_logo.png";
    const matchDate = detailedMatch.fixture?.date ? new Date(detailedMatch.fixture.date).toLocaleString() : "Unknown Date";

    const hasResult = detailedMatch.goals && detailedMatch.goals.home !== null && detailedMatch.goals.away !== null;
    const scoreDisplay = hasResult ? `<div>Wynik: ${detailedMatch.goals.home} - ${detailedMatch.goals.away}</div>` : "<div>Wynik: -</div>";

    console.log(`Wyświetlanie szczegółów dla meczu ${homeTeamName} vs ${awayTeamName}`);

    // Obliczanie BTTS na podstawie funkcji calculateBttsPercentage
    const bttsPercentage = await calculateBttsPercentage(detailedMatch.teams.home.id, detailedMatch.teams.away.id);
    console.log(`Wynik procentowy BTTS: ${bttsPercentage}%`);
    const formattedBttsPercentage = isNaN(bttsPercentage) ? 'N/A' : Number(bttsPercentage).toFixed(2);

    // Wyciągnięcie danych formy drużyn oraz statystyk head-to-head
    const { overUnderPercentages, h2hStats = {}, homeForm = {}, awayForm = {} } = detailedMatch;

    // Sekcja statystyk i wyników meczu
    const matchDetails = document.createElement("div");
    matchDetails.className = "match-details";
    matchDetails.innerHTML = `
      <h2>Szczegóły meczu</h2>
      <div class="teams">
        <img src="${homeTeamLogo}" class="team-logo" alt="${homeTeamName} logo">
        <span>${homeTeamName} vs ${awayTeamName}</span>
        <img src="${awayTeamLogo}" class="team-logo" alt="${awayTeamName} logo">
      </div>
      <div>Data: ${matchDate}</div>
      ${scoreDisplay}
    `;

    matchesContainer.appendChild(matchDetails);

    // Pobieranie kursów dla meczu
    let odds = {};
    try {
      const oddsResponse = await fetch(`${API_URL}/odds?fixture=${fixtureId}&bookmaker=8`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-key': API_KEY,
          'x-rapidapi-host': API_HOST,
        }
      });
      if (oddsResponse.ok) {
        const oddsData = await oddsResponse.json();
        if (oddsData && oddsData.response && oddsData.response.length > 0) {
          odds = oddsData.response[0];
        } else {
          console.warn(`Nie znaleziono kursów dla meczu ${detailedMatch.fixture.id}`);
        }
      } else {
        console.warn(`Nie udało się pobrać kursów dla meczu ${detailedMatch.fixture.id}`);
      }
    } catch (error) {
      console.error(`Błąd podczas pobierania kursów dla meczu ${detailedMatch.fixture.id}:`, error);
    }

    // Sekcja Over/Under z szansami procentowymi
    if (overUnderPercentages) {
      const overUnderSection = document.createElement("div");
      overUnderSection.className = "expandable-section over-under-section";
      overUnderSection.innerHTML = `
        <h3>Procentowe szanse Over/Under</h3>
        <table class="over-under-table">
          <tr>
            <th>Liczba goli</th>
            <th>Procent szans Over</th>
            <th>Procent szans Under</th>
            <th>Kurs Over</th>
            <th>Kurs Under</th>
          </tr>
          ${generateOverUnderTable(overUnderPercentages, odds)}
        </table>
      `;
      matchesContainer.appendChild(overUnderSection);
    }

    // Sekcja BTTS (Both Teams to Score) z procentem szans
    const bttsSection = document.createElement("div");
    bttsSection.className = "expandable-section btts-section";
    bttsSection.innerHTML = `
      <h3>Procent szans BTTS (Obie drużyny strzelą)</h3>
      <p>Szansa na BTTS: ${formattedBttsPercentage}%</p>
      <table class="btts-table">
        <tr>
          <th>Opcja</th>
          <th>Kurs</th>
          <th>Bukmacher</th>
        </tr>
        ${generateBttsTable(odds)}
      </table>
    `;
    matchesContainer.appendChild(bttsSection);

    // Sekcja formy drużyn z procentowymi szansami
    const formSection = document.createElement("div");
    formSection.className = "expandable-section form-section";
    formSection.innerHTML = `
      <h3>Forma Drużyn i Szanse na Wynik</h3>
      <div>
        <strong>${homeTeamName}</strong> - Forma: W:${homeForm.wins || 0}, D:${homeForm.draws || 0}, L:${homeForm.losses || 0}
      </div>
      <div>
        <strong>${awayTeamName}</strong> - Forma: W:${awayForm.wins || 0}, D:${awayForm.draws || 0}, L:${awayForm.losses || 0}
      </div>
    `;
    matchesContainer.appendChild(formSection);

  } catch (error) {
    console.error("Błąd podczas pobierania danych szczegółów meczu:", error);
    matchesContainer.innerHTML += "<p>Wystąpił problem z ładowaniem szczegółów meczu.</p>";
  }
}

// Funkcja generująca tabelę Over/Under
function generateOverUnderTable(overUnderPercentages, odds) {
  let html = '';
  const lines = Object.keys(overUnderPercentages || {}).sort((a, b) => parseFloat(a) - parseFloat(b));

  lines.forEach(line => {
    const percentageOver = overUnderPercentages[line] || 0;
    const percentageUnder = (100 - percentageOver).toFixed(2);
    const oddsForLine = odds && odds.find(o => o.line === line) || {};
    const overOdd = oddsForLine.Over ? parseFloat(oddsForLine.Over).toFixed(2) : 'N/A';
    const underOdd = oddsForLine.Under ? parseFloat(oddsForLine.Under).toFixed(2) : 'N/A';

    html += `
      <tr>
        <td>${line}</td>
        <td>${percentageOver}%</td>
        <td>${percentageUnder}%</td>
        <td>${overOdd}</td>
        <td>${underOdd}</td>
      </tr>
    `;
  });

  return html;
}

// Funkcja generująca tabelę BTTS
function generateBttsTable(odds) {
  // Sprawdzenie, czy odds jest obiektem i czy zawiera bookmakers
  if (!odds || typeof odds !== 'object' || !Array.isArray(odds.bookmakers)) {
    return '<tr><td colspan="3">Brak dostępnych kursów na BTTS</td></tr>';
  }

  let bttsRows = '';

  // Iteracja przez bukmacherów i wyszukiwanie BTTS
  odds.bookmakers.forEach(bookmaker => {
    if (Array.isArray(bookmaker.bets)) {
      bookmaker.bets.forEach(bet => {
        if (bet.name === 'Both Teams Score' && Array.isArray(bet.values)) {
          bet.values.forEach(value => {
            bttsRows += `
              <tr>
                <td>${value.value}</td>
                <td>${value.odd}</td>
                <td>${bookmaker.name}</td>
              </tr>
            `;
          });
        }
      });
    }
  });

  // Zwracanie wierszy lub informacji, że brak kursów na BTTS
  return bttsRows || '<tr><td colspan="3">Brak dostępnych kursów na BTTS</td></tr>';
}

// Funkcja do zarządzania widocznością rozwijalnych sekcji
function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.classList.toggle("hidden");
  }
}

// Funkcja do ukrywania wszystkich sekcji
function hideAllSections() {
  const overviewSection = document.getElementById('overviewSection');
  const topBttsSection = document.getElementById('topBttsSection');
  overviewSection.style.display = 'none';
  topBttsSection.style.display = 'none';
  const mainMenu = document.getElementById('mainMenu');
  mainMenu.style.display = 'flex';
}

// Inicjalizacja funkcji do pobierania meczów
document.addEventListener('DOMContentLoaded', () => {
  // Event listeners dla kafelków i przycisków powrotu

  const mainMenu = document.getElementById('mainMenu');
  const overviewSection = document.getElementById('overviewSection');
  const topBttsSection = document.getElementById('topBttsSection');
  const overviewTile = document.getElementById('overviewTile');
  const topBttsTile = document.getElementById('topBttsTile');
  const backFromOverview = document.getElementById('backFromOverview');
  const backFromTopBtts = document.getElementById('backFromTopBtts');
  const fetchDateButton = document.getElementById('fetchDateButton');
  const dateInput = document.getElementById('dateInput');

  // Funkcja do wyświetlania sekcji
  function showSection(section) {
    mainMenu.style.display = 'none';
    overviewSection.style.display = 'none';
    topBttsSection.style.display = 'none';
    section.style.display = 'block';
  }

  // Obsługa kliknięcia na kafelek "Przegląd meczów"
  overviewTile.addEventListener('click', async () => {
    showSection(overviewSection);
    backFromOverview.style.display = 'inline-block';
    // Wywołaj funkcję fetchMatches() z domyślną datą
    await fetchMatches();
  });

  // Obsługa kliknięcia na kafelek "Najlepsze BTTS"
  topBttsTile.addEventListener('click', async () => {
    showSection(topBttsSection);
    backFromTopBtts.style.display = 'inline-block';
    // Wywołaj funkcję fetchTopBtts()
    await fetchTopBtts();
  });

  // Obsługa przycisku "Powrót" z sekcji przeglądu meczów
  backFromOverview.addEventListener('click', () => {
    hideAllSections();
  });

  // Obsługa przycisku "Powrót" z sekcji najlepszych BTTS
  backFromTopBtts.addEventListener('click', () => {
    hideAllSections();
  });

  // Obsługa przycisku "Pobierz mecze" z formularza wyboru daty
  fetchDateButton.addEventListener('click', async () => {
    const selectedDate = dateInput.value;
    if (selectedDate) {
      showSection(overviewSection);
      backFromOverview.style.display = 'inline-block';
      await fetchMatches(selectedDate);
    } else {
      alert("Proszę wybrać datę.");
    }
  });
});
