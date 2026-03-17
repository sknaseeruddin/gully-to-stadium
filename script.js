const button = document.getElementById("loadMatches");
const upcomingButton = document.getElementById("loadUpcoming");
const refreshLiveButton = document.getElementById("refreshLive");
const clearSearchButton = document.getElementById("clearSearch");

const matchesDiv = document.getElementById("matches");
const upcomingDiv = document.getElementById("upcomingMatches");
const matchTypeFilter = document.getElementById("matchTypeFilter");
const seriesFilter = document.getElementById("seriesFilter");
const searchInput = document.getElementById("searchTeam");
const message = document.getElementById("message");
const lastUpdated = document.getElementById("lastUpdated");
const themeToggle = document.getElementById("themeToggle");

const matchModal = document.getElementById("matchModal");
const modalBody = document.getElementById("modalBody");
const closeModal = document.getElementById("closeModal");

const liveCount = document.getElementById("liveCount");
const upcomingCount = document.getElementById("upcomingCount");
const searchCount = document.getElementById("searchCount");

/* IMPORTANT: replace with your NEW regenerated key */
const API_KEY = "2668d747-961c-47dc-94bf-e75d419e8baf";
// SAMPLE DATA (used when API fails)

const sampleLiveMatches = [
  {
    id: "sample1",
    team1: "India",
    team2: "Australia",
    teams: "India vs Australia",
    logo1: "https://flagcdn.com/w80/in.png",
    logo2: "https://flagcdn.com/w80/au.png",
    score: "India 182/4 (19.2 ov)",
    status: "India needs 10 runs in 4 balls",
    venue: "Mumbai",
    series: "Sample T20 Series",
    date: "Today",
    matchType: "t20",
    isLive: true
  }
];

const sampleUpcomingMatches = [
  {
    id: "sample2",
    team1: "Pakistan",
    team2: "England",
    teams: "Pakistan vs England",
    logo1: "https://flagcdn.com/w80/pk.png",
    logo2: "https://flagcdn.com/w80/gb.png",
    score: "Starts at 7:30 PM",
    status: "Match not started",
    venue: "Lahore",
    series: "Sample ODI Series",
    date: "Tomorrow",
    matchType: "odi",
    isLive: false
  }
];

/* currentMatches = current/live matches */
const LIVE_API_URL = `https://api.cricapi.com/v1/currentMatches?apikey=${API_KEY}&offset=0`;

/* cricScore = +/-7 days fixtures/live/results */
const UPCOMING_API_URL = `https://api.cricapi.com/v1/cricScore?apikey=${API_KEY}`;

let liveMatchesCache = [];
let upcomingMatchesCache = [];
let liveRefreshInterval = null;
let isLoadingLive = false;
let isLoadingUpcoming = false;

const FALLBACK_LOGO = "https://img.icons8.com/color/96/trophy.png";

const flagMap = {
  india: "https://flagcdn.com/w80/in.png",
  australia: "https://flagcdn.com/w80/au.png",
  england: "https://flagcdn.com/w80/gb.png",
  pakistan: "https://flagcdn.com/w80/pk.png",
  "south africa": "https://flagcdn.com/w80/za.png",
  "new zealand": "https://flagcdn.com/w80/nz.png",
  "sri lanka": "https://flagcdn.com/w80/lk.png",
  bangladesh: "https://flagcdn.com/w80/bd.png",
  afghanistan: "https://flagcdn.com/w80/af.png",
  ireland: "https://flagcdn.com/w80/ie.png",
  zimbabwe: "https://flagcdn.com/w80/zw.png",
  "west indies": "https://flagcdn.com/w80/jm.png"
};

function setMessage(text) {
  message.textContent = text;
}

function updateTimestamp() {
  lastUpdated.textContent = `Last updated: ${new Date().toLocaleString()}`;
}

function showLoading(targetDiv, text) {
  targetDiv.innerHTML = `
    <div class="loading-box">
      <div class="spinner"></div>
      <p>${text}</p>
    </div>
  `;
}

function safeText(value, fallback = "N/A") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function formatDate(dateValue) {
  if (!dateValue) return "Date not available";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue);

  return date.toLocaleString();
}

function getUniqueSeriesNames() {
  const allMatches = [...liveMatchesCache, ...upcomingMatchesCache];

  return [
    ...new Set(
      allMatches
        .map((match) => safeText(match.series, "").trim())
        .filter(
          (series) =>
            series &&
            series.toLowerCase() !== "series not available" &&
            series.toLowerCase() !== "n/a"
        )
    )
  ].sort((a, b) => a.localeCompare(b));
}

function populateSeriesFilter() {
  const currentValue = seriesFilter.value;
  const uniqueSeries = getUniqueSeriesNames();

  seriesFilter.innerHTML = `<option value="">All Series</option>`;

  uniqueSeries.forEach((series) => {
    seriesFilter.innerHTML += `<option value="${series.toLowerCase()}">${series}</option>`;
  });

  const stillExists = uniqueSeries.some(
    (series) => series.toLowerCase() === currentValue
  );

  seriesFilter.value = stillExists ? currentValue : "";
}

function getFilteredMatches(matchList) {
  const searchValue = searchInput.value.toLowerCase().trim();
  const typeValue = matchTypeFilter.value.toLowerCase().trim();
  const seriesValue = seriesFilter.value.toLowerCase().trim();

  return matchList.filter((match) => {
    const teams = safeText(match.teams, "").toLowerCase();
    const matchType = safeText(match.matchType, "").toLowerCase();
    const series = safeText(match.series, "").toLowerCase();

    const teamMatch = !searchValue || teams.includes(searchValue);
    const typeMatch = !typeValue || matchType === typeValue;
    const seriesMatch = !seriesValue || series === seriesValue;

    return teamMatch && typeMatch && seriesMatch;
  });
}

function updateCounters() {
  const filteredLive = getFilteredMatches(liveMatchesCache);
  const filteredUpcoming = getFilteredMatches(upcomingMatchesCache);

  liveCount.textContent = filteredLive.length;
  upcomingCount.textContent = filteredUpcoming.length;
  searchCount.textContent = filteredLive.length + filteredUpcoming.length;
}

function getTeamLogo(teamName) {
  if (!teamName) return FALLBACK_LOGO;

  const lower = teamName.toLowerCase();
  for (const key in flagMap) {
    if (lower.includes(key)) return flagMap[key];
  }

  return FALLBACK_LOGO;
}

function getFirstInningsRuns(match) {
  if (!match || !match.score) return 0;

  const scoreText = String(match.score || "");
  const firstRunsMatch = scoreText.match(/(\d+)\/\d+/);
  return firstRunsMatch ? Number(firstRunsMatch[1]) : 0;
}

function getProgressWidth(match) {
  const runs = getFirstInningsRuns(match);
  if (!runs) return 0;

  const type = String(match.matchType || "").toLowerCase();
  let maxRuns = 400;

  if (type === "t20") maxRuns = 250;
  else if (type === "odi") maxRuns = 400;
  else if (type === "test") maxRuns = 500;

  return Math.min((runs / maxRuns) * 100, 100);
}

function getLiveBadgeHtml(match) {
  if (!match.isLive) return "";

  return `
    <div class="live-pill">
      <span class="live-pulse"></span>
      LIVE
    </div>
  `;
}

function getProgressBarHtml(match) {
  if (!match.isLive) return "";

  const progress = getProgressWidth(match);
  if (!progress) return "";

  return `
    <div class="progress-wrap">
      <div class="progress-label">Score Progress</div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progress}%"></div>
      </div>
    </div>
  `;
}

function showEmpty(targetDiv, text) {
  targetDiv.innerHTML = `<p class="empty-message">${text}</p>`;
}

function openMatchModal(match) {
  const isWin = safeText(match.status, "").toLowerCase().includes("won");

  modalBody.innerHTML = `
    <h2 class="modal-title">${safeText(match.teams)}</h2>

    <div class="modal-teams">
      <div class="modal-team">
        <img src="${match.logo1}" alt="${match.team1}" onerror="this.src='${FALLBACK_LOGO}'">
        <span>${safeText(match.team1)}</span>
      </div>

      <span class="modal-vs">VS</span>

      <div class="modal-team">
        <img src="${match.logo2}" alt="${match.team2}" onerror="this.src='${FALLBACK_LOGO}'">
        <span>${safeText(match.team2)}</span>
      </div>
    </div>

    <div class="modal-details">
      <p><strong>Series:</strong> ${safeText(match.series)}</p>
      <p><strong>Venue:</strong> ${safeText(match.venue)}</p>
      <p><strong>Date:</strong> ${safeText(match.date)}</p>
      <p><strong>Match Type:</strong> ${safeText(match.matchType)}</p>
      <p><strong>Score / Time:</strong> ${safeText(match.score)}</p>
    </div>

    ${match.isLive ? `
      <div style="display:flex;justify-content:center;margin-top:10px;">
        <div class="live-pill">
          <span class="live-pulse"></span>
          LIVE
        </div>
      </div>
    ` : ""}

    ${match.isLive && getProgressWidth(match) > 0 ? `
      <div class="progress-wrap" style="margin-top:14px;">
        <div class="progress-label">Score Progress</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${getProgressWidth(match)}%"></div>
        </div>
      </div>
    ` : ""}

    <p class="modal-status ${isWin ? "status-win" : ""}">
      ${safeText(match.status)}
    </p>
  `;

  matchModal.classList.remove("hidden");
}

function closeMatchModal() {
  matchModal.classList.add("hidden");
}

function normalizeMatch(apiMatch, type = "live") {
  const teamInfo = Array.isArray(apiMatch.teamInfo) ? apiMatch.teamInfo : [];
  const teams = Array.isArray(apiMatch.teams) ? apiMatch.teams : [];

  const team1 = teamInfo[0]?.name || teams[0] || "Team 1";
  const team2 = teamInfo[1]?.name || teams[1] || "Team 2";

  let scoreText = "Score not available";

  if (type === "upcoming") {
    scoreText = formatDate(apiMatch.dateTimeGMT || apiMatch.date);
  } else if (Array.isArray(apiMatch.score) && apiMatch.score.length > 0) {
    scoreText = apiMatch.score
      .map((inning) => {
        const inningName = inning.inning ? `${inning.inning}: ` : "";
        const runs = inning.r ?? "-";
        const wickets = inning.w ?? "-";
        const overs = inning.o ?? "-";
        return `${inningName}${runs}/${wickets} (${overs} ov)`;
      })
      .join(" | ");
  } else if (typeof apiMatch.score === "string" && apiMatch.score.trim()) {
    scoreText = apiMatch.score;
  }

  return {
    id: apiMatch.id || `${team1}-${team2}-${type}`,
    team1,
    team2,
    teams: `${team1} vs ${team2}`,
    logo1: teamInfo[0]?.img || getTeamLogo(team1),
    logo2: teamInfo[1]?.img || getTeamLogo(team2),
    score: scoreText,
    status: apiMatch.status || (type === "upcoming" ? "Upcoming Match" : "Live"),
    badge: apiMatch.matchType
      ? `${String(apiMatch.matchType).toUpperCase()} Match`
      : type === "upcoming"
      ? "Upcoming Match"
      : "Live Match",
    venue: safeText(apiMatch.venue, "Venue not available"),
    series: safeText(apiMatch.series, "Series not available"),
    date: formatDate(apiMatch.dateTimeGMT || apiMatch.date),
    matchType: safeText(apiMatch.matchType, "N/A"),
    isLive: type === "live"
  };
}

function createMatchCard(match, type = "live") {
  const liveClass = type === "live" ? "live-card" : "";
  const statusClass =
    safeText(match.status, "").toLowerCase().includes("won") ? "status-win" : "";

  const liveStatusHtml =
    type === "live"
      ? `<p class="status live-status ${statusClass}"><span class="live-dot"></span> ${safeText(match.status)}</p>`
      : `<p class="status ${statusClass}">${safeText(match.status)}</p>`;

  return `
    <div class="card ${liveClass} clickable-card" data-match-id="${match.id}" data-type="${type}">
      <div class="teams">
        <div class="team-block">
          <img src="${match.logo1}" alt="${match.team1}" onerror="this.src='${FALLBACK_LOGO}'">
          <span class="team-name">${safeText(match.team1)}</span>
        </div>

        <span class="vs">VS</span>

        <div class="team-block">
          <img src="${match.logo2}" alt="${match.team2}" onerror="this.src='${FALLBACK_LOGO}'">
          <span class="team-name">${safeText(match.team2)}</span>
        </div>
      </div>

      <h3>${safeText(match.teams)}</h3>
      <p class="meta"><strong>Series:</strong> ${safeText(match.series)}</p>
      <p class="meta"><strong>Venue:</strong> ${safeText(match.venue)}</p>
      <p class="meta"><strong>Date:</strong> ${safeText(match.date)}</p>
      <p class="meta"><strong>Type:</strong> ${safeText(match.matchType)}</p>
      <p><span class="score-label">Score / Time:</span> ${safeText(match.score)}</p>
      ${liveStatusHtml}
      ${getLiveBadgeHtml(match)}
      ${getProgressBarHtml(match)}

      <div class="card-footer">
        <span class="live-badge">${safeText(match.badge)}</span>
      </div>
    </div>
  `;
}

function attachCardClickEvents() {
  const cards = document.querySelectorAll(".clickable-card");

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const matchId = card.dataset.matchId;
      const type = card.dataset.type;

      const sourceList = type === "live" ? liveMatchesCache : upcomingMatchesCache;
      const selectedMatch = sourceList.find(
        (match) => String(match.id) === String(matchId)
      );

      if (selectedMatch) openMatchModal(selectedMatch);
    });
  });
}

function displayMatches(matchList, targetDiv, type = "live") {
  if (!matchList || matchList.length === 0) {
    showEmpty(targetDiv, `No ${type} matches found.`);
    return;
  }

  targetDiv.innerHTML = matchList.map((match) => createMatchCard(match, type)).join("");
  attachCardClickEvents();
}

function filterAndDisplayLiveMatches() {
  const filtered = getFilteredMatches(liveMatchesCache);
  displayMatches(filtered, matchesDiv, "live");
}

function filterAndDisplayUpcomingMatches() {
  const filtered = getFilteredMatches(upcomingMatchesCache);
  displayMatches(filtered, upcomingDiv, "upcoming");
}

async function fetchJson(url) {
  const response = await fetch(url);

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error("Response is not valid JSON");
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  if (!data) {
    throw new Error("Empty response from API");
  }

  if (String(data.status).toLowerCase() === "failure") {
    throw new Error(data.reason || data.message || "API returned failure status");
  }

  return data;
}

function setButtonsDisabled(disabled) {
  button.disabled = disabled;
  upcomingButton.disabled = disabled;
  refreshLiveButton.disabled = disabled;
}

function startLiveAutoRefresh() {
  stopLiveAutoRefresh();
  // Auto refresh disabled to save API hits while developing
}
function stopLiveAutoRefresh() {
  if (liveRefreshInterval) {
    clearInterval(liveRefreshInterval);
    liveRefreshInterval = null;
  }
}

async function loadLiveMatches(isAutoRefresh = false) {
  if (isLoadingLive) return;

  if (!API_KEY || API_KEY === "PASTE_YOUR_NEW_API_KEY_HERE") {
    setMessage("Please add your real CricAPI key in script.js first.");
    showEmpty(matchesDiv, "API key not added.");
    return;
  }

  isLoadingLive = true;
  setButtonsDisabled(true);

  if (!isAutoRefresh) {
    setMessage("Loading live matches...");
    showLoading(matchesDiv, "Loading live matches...");
  } else {
    setMessage("Refreshing live matches...");
  }

  try {
    const data = await fetchJson(LIVE_API_URL);
    console.log("Live full response:", data);

    const apiMatches = Array.isArray(data.data) ? data.data : [];
    liveMatchesCache = apiMatches.map((match) => normalizeMatch(match, "live"));

    populateSeriesFilter();
    filterAndDisplayLiveMatches();
    updateCounters();
    updateTimestamp();

    setMessage(`Loaded ${liveMatchesCache.length} live matches.`);
    startLiveAutoRefresh();
  } catch (error) {
    console.error("Live matches error:", error);

    const errorText = String(error.message || "").toLowerCase();
    if (errorText.includes("blocked")) {
      setMessage("API blocked for 15 minutes. Please wait and try again.");
      stopLiveAutoRefresh();
    } else {
      setMessage(`Failed to load live matches: ${error.message}`);
    }

    showEmpty(matchesDiv, "Could not fetch live scores.");
  } finally {
    isLoadingLive = false;
    setButtonsDisabled(false);
  }
}

function isUpcomingMatch(match) {
  const status = String(match.status || "").toLowerCase();
  const dateValue = match.dateTimeGMT || match.date;
  const now = new Date();

  let matchDate = null;
  if (dateValue) {
    const parsed = new Date(dateValue);
    if (!Number.isNaN(parsed.getTime())) matchDate = parsed;
  }

  const looksUpcomingByDate = matchDate && matchDate > now;
  const looksUpcomingByStatus =
    status.includes("upcoming") ||
    status.includes("not started") ||
    status.includes("starts at") ||
    status.includes("scheduled") ||
    status.includes("fixture");

  const looksFinished =
    status.includes("won") ||
    status.includes("result") ||
    status.includes("completed") ||
    status.includes("match over") ||
    status.includes("stumps");

  return (looksUpcomingByDate || looksUpcomingByStatus) && !looksFinished;
}

async function loadUpcomingMatches() {
  if (isLoadingUpcoming) return;

  if (!API_KEY || API_KEY === "PASTE_YOUR_NEW_API_KEY_HERE") {
    setMessage("Please add your real CricAPI key in script.js first.");
    showEmpty(upcomingDiv, "API key not added.");
    return;
  }

  isLoadingUpcoming = true;
  setButtonsDisabled(true);
  setMessage("Loading upcoming matches...");
  showLoading(upcomingDiv, "Loading upcoming matches...");

  try {
    const data = await fetchJson(UPCOMING_API_URL);
    console.log("Upcoming full response:", data);

    const apiMatches = Array.isArray(data.data) ? data.data : [];

    upcomingMatchesCache = apiMatches
      .filter((match) => isUpcomingMatch(match))
      .map((match) => normalizeMatch(match, "upcoming"));

    populateSeriesFilter();
    filterAndDisplayUpcomingMatches();
    updateCounters();
    updateTimestamp();

    setMessage(`Loaded ${upcomingMatchesCache.length} upcoming matches.`);
  } catch (error) {
    console.error("Upcoming matches error:", error);

    const errorText = String(error.message || "").toLowerCase();
    if (errorText.includes("blocked")) {
      setMessage("API blocked for 15 minutes. Please wait and try again.");
    } else {
      setMessage(`Failed to load upcoming matches: ${error.message}`);
    }

    showEmpty(upcomingDiv, "Could not fetch upcoming matches.");
  } finally {
    isLoadingUpcoming = false;
    setButtonsDisabled(false);
  }
}

button.addEventListener("click", () => {
  loadLiveMatches(false);
});

upcomingButton.addEventListener("click", () => {
  loadUpcomingMatches();
});

refreshLiveButton.addEventListener("click", () => {
  loadLiveMatches(false);
});

searchInput.addEventListener("input", () => {
  filterAndDisplayLiveMatches();
  filterAndDisplayUpcomingMatches();
  updateCounters();
});

clearSearchButton.addEventListener("click", () => {
  searchInput.value = "";
  matchTypeFilter.value = "";
  seriesFilter.value = "";
  filterAndDisplayLiveMatches();
  filterAndDisplayUpcomingMatches();
  updateCounters();
  setMessage("Search cleared.");
});

matchTypeFilter.addEventListener("change", () => {
  filterAndDisplayLiveMatches();
  filterAndDisplayUpcomingMatches();
  updateCounters();
});

seriesFilter.addEventListener("change", () => {
  filterAndDisplayLiveMatches();
  filterAndDisplayUpcomingMatches();
  updateCounters();
});

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");

  const isDark = document.body.classList.contains("dark");
  themeToggle.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
  localStorage.setItem("theme", isDark ? "dark" : "light");
});

closeModal.addEventListener("click", () => {
  closeMatchModal();
});

matchModal.addEventListener("click", (event) => {
  if (event.target === matchModal) {
    closeMatchModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMatchModal();
  }
});

window.addEventListener("load", () => {
  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    themeToggle.textContent = "☀️ Light Mode";
  }

  // Disabled while developing to save API hits
  // loadLiveMatches();
  // loadUpcomingMatches();
});