/* ============================================================ */
/* SF OPPORTUNITY OS v2 — COMPLETE VANILLA JS APPLICATION       */
/* No external dependencies. All data from data.json.            */
/* Features: Cards, Calendar, Neighborhoods, Tracker views       */
/* State management, localStorage persistence, export to TXT     */
/* ============================================================ */

/**
 * GLOBAL STATE
 * ------------
 * Single source of truth for the entire application.
 * All UI updates flow from state changes.
 */
const state = {
  // Raw data loaded from data.json
  opportunities: [],
  meta: {},

  // Filtered subset currently displayed
  filtered: [],

  // Saved items for the tracker (persisted to localStorage)
  // Format: { id: { id, savedAt, checklist: [{text, done}], notes } }
  saved: {},

  // Search text (real-time, case-insensitive)
  search: '',

  // Active filters
  filters: {
    category: '',
    neighborhood: '',
    status: '',
    dateFrom: '',
    dateTo: ''
  },

  // Current view mode: 'cards' | 'calendar' | 'neighborhoods' | 'tracker'
  view: 'cards',

  // Calendar state
  calendarDate: new Date(),

  // Expanded neighborhoods in neighborhood view
  expandedNeighborhoods: new Set(),

  // Currently selected day in calendar view
  selectedDay: null
};

// localStorage key for persisting tracker data
const STORAGE_KEY = 'sfos_tracker';


/* ============================================================ */
/* SECTION 1: DATA LOADING                                      */
/* ============================================================ */

/**
 * Load data from data.json on application startup.
 * Initializes state.opportunities and state.meta.
 * Also loads saved tracker items from localStorage.
 */
async function loadData() {
  try {
    const response = await fetch('./data.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();

    // Parse the JSON structure: { meta: {...}, opportunities: [...] }
    state.meta = data.meta || {};
    state.opportunities = data.opportunities || [];

    // Initially, all opportunities are shown (before filters/search)
    state.filtered = [...state.opportunities];

    // Load saved items from localStorage
    loadSavedFromStorage();

    // Populate filter dropdowns with unique values from data
    populateFilterOptions();

    // Render the initial view
    applyFilters();
    updateStatsLine();
    renderView();

  } catch (error) {
    console.error('Failed to load data:', error);
    document.getElementById('main-content').innerHTML = `
      <div class="no-results">ERROR LOADING DATA: ${escapeHtml(error.message)}</div>
    `;
  }
}


/* ============================================================ */
/* SECTION 2: LOCAL STORAGE — TRACKER PERSISTENCE               */
/* ============================================================ */

/**
 * Load saved tracker items from localStorage.
 * The saved data is keyed by opportunity ID.
 * Schema: { id: { id, savedAt, checklist: [{text, done}], notes } }
 */
function loadSavedFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      state.saved = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Could not load saved items from localStorage:', e);
    state.saved = {};
  }
}

/**
 * Persist saved tracker items to localStorage.
 * Called whenever the user saves/unsaves an item or modifies
 * a checklist checkbox or notes field.
 */
function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.saved));
  } catch (e) {
    console.warn('Could not save to localStorage:', e);
  }
}

/**
 * Toggle an opportunity's saved status.
 * When saving, we copy the opportunity's checklist items into
 * the saved entry so the user can track their progress.
 */
function toggleSaved(oppId) {
  if (state.saved[oppId]) {
    // Remove from saved
    delete state.saved[oppId];
  } else {
    // Find the opportunity
    const opp = state.opportunities.find(o => o.id === oppId);
    if (!opp) return;

    // Add to saved with initialized checklist
    state.saved[oppId] = {
      id: oppId,
      savedAt: new Date().toISOString(),
      checklist: (opp.checklist || []).map(item => ({
        text: item,
        done: false
      })),
      notes: ''
    };
  }

  saveToStorage();
  updateStatsLine();
  renderView();
}

/**
 * Remove an item from the tracker.
 */
function removeSaved(oppId) {
  delete state.saved[oppId];
  saveToStorage();
  updateStatsLine();
  renderView();
}

/**
 * Toggle a checklist item's done status.
 * Updates localStorage immediately.
 */
function toggleChecklistItem(oppId, index) {
  const entry = state.saved[oppId];
  if (!entry || !entry.checklist[index]) return;

  entry.checklist[index].done = !entry.checklist[index].done;
  saveToStorage();
  updateStatsLine();
  // Re-render progress for this item without full re-render
  updateChecklistProgress(oppId);
}

/**
 * Update notes for a saved item.
 */
function updateNotes(oppId, notes) {
  const entry = state.saved[oppId];
  if (!entry) return;

  entry.notes = notes;
  saveToStorage();
}


/* ============================================================ */
/* SECTION 3: FILTER DROPDOWNS                                  */
/* ============================================================ */

/**
 * Populate the Category and Neighborhood filter dropdowns
 * with unique values extracted from the opportunity data.
 * This runs once after data is loaded.
 */
function populateFilterOptions() {
  // Get unique categories, sorted alphabetically
  const categories = [...new Set(state.opportunities.map(o => o.category))].sort();
  const categorySelect = document.getElementById('filter-category');
  categorySelect.innerHTML = '<option value="">ALL CATEGORIES</option>' +
    categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

  // Get unique neighborhoods, sorted alphabetically
  const neighborhoods = [...new Set(state.opportunities.map(o => o.neighborhood))].sort();
  const neighborhoodSelect = document.getElementById('filter-neighborhood');
  neighborhoodSelect.innerHTML = '<option value="">ALL NEIGHBORHOODS</option>' +
    neighborhoods.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
}


/* ============================================================ */
/* SECTION 4: SEARCH                                            */
/* ============================================================ */

/**
 * Real-time text search across multiple fields.
 * Searches: source, organization, benefits, eligibility, notes, address, phone, email
 * Case-insensitive. Updates results as user types.
 */
function handleSearch() {
  const input = document.getElementById('search-input');
  state.search = input.value.trim().toLowerCase();
  applyFilters();
}


/* ============================================================ */
/* SECTION 5: FILTERING LOGIC                                   */
/* ============================================================ */

/**
 * Sync the quick category filter buttons with the current state.
 * The button matching state.filters.category gets the 'active' class.
 * The SHOW ALL button (data-cat="") is active when no category is selected.
 * Call this after any category filter change (dropdown or button click).
 */
function syncCategoryButtons() {
  const currentCat = state.filters.category;
  document.querySelectorAll('.cat-btn').forEach(btn => {
    if (btn.dataset.cat === currentCat) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Apply all active filters and search to produce the filtered list.
 * This is the core filtering pipeline:
 *   1. Start with all opportunities
 *   2. Apply category filter
 *   3. Apply neighborhood filter
 *   4. Apply status filter (ALL / ACTIVE / TIME-LIMITED)
 *   5. Apply text search across multiple fields
 *   6. Update the UI
 */
function applyFilters() {
  let results = [...state.opportunities];

  // 1. Category filter
  if (state.filters.category) {
    results = results.filter(o => o.category === state.filters.category);
  }

  // 2. Neighborhood filter
  if (state.filters.neighborhood) {
    results = results.filter(o => o.neighborhood === state.filters.neighborhood);
  }

  // 3. Status filter
  if (state.filters.status) {
    if (state.filters.status === 'TIME-LIMITED') {
      results = results.filter(o =>
        o.status && o.status.toLowerCase().includes('time')
      );
    } else if (state.filters.status === 'ACTIVE') {
      results = results.filter(o =>
        o.status && o.status.toLowerCase().includes('active')
      );
    }
  }

  // 4. Text search (case-insensitive across multiple fields)
  if (state.search) {
    const query = state.search;
    results = results.filter(o => {
      return (
        (o.source && o.source.toLowerCase().includes(query)) ||
        (o.organization && o.organization.toLowerCase().includes(query)) ||
        (o.benefits && o.benefits.toLowerCase().includes(query)) ||
        (o.eligibility && o.eligibility.toLowerCase().includes(query)) ||
        (o.notes && o.notes.toLowerCase().includes(query)) ||
        (o.address && o.address.toLowerCase().includes(query)) ||
        (o.phone && o.phone.toLowerCase().includes(query)) ||
        (o.email && o.email.toLowerCase().includes(query)) ||
        (o.process && o.process.toLowerCase().includes(query))
      );
    });
  }

  state.filtered = results;
  updateActiveFilterDisplay();
  renderView();
}

/**
 * Handle filter dropdown changes.
 */
function handleFilterChange(type, value) {
  state.filters[type] = value;
  applyFilters();
}

/**
 * Clear all active filters and search.
 */
function clearAllFilters() {
  state.search = '';
  state.filters = {
    category: '',
    neighborhood: '',
    status: '',
    dateFrom: '',
    dateTo: ''
  };

  // Reset UI controls
  document.getElementById('search-input').value = '';
  document.getElementById('filter-category').value = '';
  document.getElementById('filter-neighborhood').value = '';
  document.getElementById('filter-status').value = '';

  applyFilters();
}

/**
 * Update the "active filters" display below the filter bar.
 */
function updateActiveFilterDisplay() {
  const container = document.getElementById('active-filters');
  const countEl = document.getElementById('filter-count');

  let activeCount = 0;
  if (state.search) activeCount++;
  if (state.filters.category) activeCount++;
  if (state.filters.neighborhood) activeCount++;
  if (state.filters.status) activeCount++;

  if (activeCount > 0) {
    container.style.display = 'block';
    countEl.textContent = `${activeCount} FILTER${activeCount > 1 ? 'S' : ''} ACTIVE — ${state.filtered.length} RESULT${state.filtered.length !== 1 ? 'S' : ''}`;
  } else {
    container.style.display = 'block';
    countEl.textContent = `${state.filtered.length} RESULT${state.filtered.length !== 1 ? 'S' : ''}`;
  }
}


/* ============================================================ */
/* SECTION 6: STATS LINE                                        */
/* ============================================================ */

/**
 * Update the top bar stats line.
 * Shows: total opportunities count, categories count, saved count.
 */
function updateStatsLine() {
  const total = state.opportunities.length;
  const categories = state.meta.categories ? state.meta.categories.length : 0;
  const savedCount = Object.keys(state.saved).length;

  document.getElementById('stats-line').innerHTML = `
    <span>${total} OPPORTUNITIES</span> &nbsp;|&nbsp;
    <span>${categories} CATEGORIES</span> &nbsp;|&nbsp;
    <span>${savedCount} SAVED</span>
  `;
}


/* ============================================================ */
/* SECTION 7: VIEW RENDERING — DISPATCHER                     */
/* ============================================================ */

/**
 * Main render dispatcher.
 * Routes to the appropriate view renderer based on state.view.
 */
function renderView() {
  const main = document.getElementById('main-content');

  switch (state.view) {
    case 'cards':
      renderCardsView(main);
      break;
    case 'calendar':
      renderCalendarView(main);
      break;
    case 'neighborhoods':
      renderNeighborhoodsView(main);
      break;
    case 'tracker':
      renderTrackerView(main);
      break;
    default:
      renderCardsView(main);
  }

  // Update tracker panel visibility
  const trackerPanel = document.getElementById('tracker-panel');
  if (state.view === 'tracker') {
    trackerPanel.style.display = 'block';
    renderTrackerPanel();
  } else {
    trackerPanel.style.display = 'none';
  }

  // Update export area visibility
  document.getElementById('export-area').style.display =
    state.view === 'tracker' ? 'block' : 'none';

  // Update active view button
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === state.view);
  });
}


/* ============================================================ */
/* SECTION 8: CARDS VIEW                                        */
/* ============================================================ */

/**
 * Render the Cards view (default).
 * Displays opportunities in a responsive grid.
 * Each card shows category, source, org, benefits, contact info, status, save button.
 * Clicking a card opens the detail modal.
 */
function renderCardsView(container) {
  if (state.filtered.length === 0) {
    container.innerHTML = '<div class="no-results">NO OPPORTUNITIES MATCH YOUR CRITERIA</div>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'cards-grid';

  state.filtered.forEach(opp => {
    const card = buildOpportunityCard(opp);
    grid.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(grid);
}

/**
 * Build a single opportunity card element.
 */
function buildOpportunityCard(opp, { showFullBenefits = false } = {}) {
  const isSaved = !!state.saved[opp.id];

  const card = document.createElement('div');
  card.className = `opportunity-card ${isSaved ? 'saved' : ''}`;
  card.dataset.id = opp.id;

  // Build contact lines (only show if data exists)
  let contactHtml = '';
  if (opp.phone) {
    contactHtml += `<div class="card-contact">PHONE: ${escapeHtml(opp.phone)}</div>`;
  }
  if (opp.email) {
    contactHtml += `<div class="card-contact">EMAIL: ${escapeHtml(opp.email)}</div>`;
  }
  if (opp.website) {
    // Truncate long URLs for display
    const shortUrl = opp.website.replace(/^https?:\/\//, '').replace(/\/$/, '');
    contactHtml += `<div class="card-contact">WEBSITE: <a href="${escapeHtml(opp.website)}" target="_blank" rel="noopener" onclick="event.stopPropagation();">${escapeHtml(shortUrl)}</a></div>`;
  }
  if (opp.address) {
    contactHtml += `<div class="card-contact">ADDRESS: ${escapeHtml(opp.address)}</div>`;
  }

  // Benefits text with optional truncation
  let benefitsHtml = '';
  if (opp.benefits) {
    const shouldTruncate = opp.benefits.length > 150 && !showFullBenefits;
    benefitsHtml = `<div class="card-benefits ${shouldTruncate ? '' : 'expanded'}" id="benefits-${opp.id}">${escapeHtml(opp.benefits)}</div>`;
    if (shouldTruncate) {
      benefitsHtml += `<button class="show-more" onclick="event.stopPropagation(); toggleBenefits('${opp.id}')">SHOW MORE</button>`;
    }
  }

  // Status badge
  const statusClass = opp.status && opp.status.toLowerCase().includes('active') && !opp.status.toLowerCase().includes('ends')
    ? 'status-active'
    : 'status-limited';

  // Value display
  const valueHtml = opp.value
    ? `<div class="card-value">VALUE: ${escapeHtml(opp.value)}</div>`
    : '';

  card.innerHTML = `
    <div class="card-category">${escapeHtml(opp.category)}</div>
    <div class="card-source">${escapeHtml(opp.source)}</div>
    <div class="card-org">${escapeHtml(opp.organization)}</div>
    ${benefitsHtml}
    ${contactHtml}
    <div>
      <span class="card-status ${statusClass}">${escapeHtml(opp.status || 'ACTIVE')}</span>
    </div>
    <button class="btn-save ${isSaved ? 'saved' : ''}" onclick="event.stopPropagation(); toggleSaved('${opp.id}')">
      ${isSaved ? 'SAVED' : 'SAVE'}
    </button>
    ${valueHtml}
  `;

  // Click card to open detail modal
  card.addEventListener('click', () => openDetailModal(opp));

  return card;
}

/**
 * Toggle benefits text expansion on a card.
 */
function toggleBenefits(oppId) {
  const el = document.getElementById(`benefits-${oppId}`);
  if (el) {
    el.classList.toggle('expanded');
    // Update button text
    const btn = el.nextElementSibling;
    if (btn && btn.classList.contains('show-more')) {
      btn.textContent = el.classList.contains('expanded') ? 'SHOW LESS' : 'SHOW MORE';
    }
  }
}


/* ============================================================ */
/* SECTION 9: CALENDAR VIEW                                     */
/* ============================================================ */

/**
 * Render the Calendar view.
 * Shows a month grid with day numbers. If opportunities have a
 * schedule matching that day, small dots appear.
 * Click a day to show matching opportunities below.
 */
function renderCalendarView(container) {
  const year = state.calendarDate.getFullYear();
  const month = state.calendarDate.getMonth();

  // Calculate calendar boundaries
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay(); // 0 = Sunday
  const daysInMonth = lastDay.getDate();

  // Previous month days to show
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  // Month names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Build calendar HTML
  let html = `
    <div class="calendar-header">
      <h2 class="calendar-title">${monthNames[month]} ${year}</h2>
      <div class="calendar-nav">
        <button onclick="changeMonth(-1)">PREV</button>
        <button onclick="changeMonth(1)">NEXT</button>
      </div>
    </div>
    <div class="calendar-grid">
  `;

  // Day labels
  dayNames.forEach(d => {
    html += `<div class="calendar-day-label">${d}</div>`;
  });

  // Previous month filler days
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    html += `<div class="calendar-day other-month"><div class="calendar-day-number">${day}</div></div>`;
  }

  // Current month days
  const today = new Date();
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
    const matchingOpps = findOpportunitiesForDay(year, month, day);

    html += `<div class="calendar-day ${isToday ? 'today' : ''}" onclick="selectCalendarDay(${year}, ${month}, ${day})">`;
    html += `<div class="calendar-day-number" style="${isToday ? 'font-weight:700;color:#fff;' : ''}">${day}</div>`;

    // Show dots for matching opportunities (max 5)
    if (matchingOpps.length > 0) {
      html += '<div class="calendar-dots">';
      for (let d = 0; d < Math.min(matchingOpps.length, 5); d++) {
        html += '<div class="calendar-dot"></div>';
      }
      html += '</div>';
    }

    html += '</div>';
  }

  // Next month filler days to complete the grid
  const totalCells = startDayOfWeek + daysInMonth;
  const remainingCells = (7 - (totalCells % 7)) % 7;
  for (let day = 1; day <= remainingCells; day++) {
    html += `<div class="calendar-day other-month"><div class="calendar-day-number">${day}</div></div>`;
  }

  html += '</div>'; // end calendar-grid

  // Show detail panel for selected day
  if (state.selectedDay) {
    const sd = state.selectedDay;
    const dayOpps = findOpportunitiesForDay(sd.year, sd.month, sd.day);
    const dateStr = new Date(sd.year, sd.month, sd.day).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    html += `<div class="day-detail">`;
    html += `<h3>${dateStr.toUpperCase()} — ${dayOpps.length} OPPORTUNITIES</h3>`;

    if (dayOpps.length === 0) {
      html += `<p style="color:var(--text-muted);font-family:var(--font-mono);font-size:0.8rem;text-transform:uppercase;">No opportunities scheduled for this day.</p>`;
    } else {
      const detailGrid = document.createElement('div');
      detailGrid.className = 'cards-grid';
      dayOpps.forEach(opp => {
        // Inline card rendering for calendar detail
        const isSaved = !!state.saved[opp.id];
        html += `
          <div class="opportunity-card ${isSaved ? 'saved' : ''}" onclick="openModalById('${opp.id}')">
            <div class="card-category">${escapeHtml(opp.category)}</div>
            <div class="card-source">${escapeHtml(opp.source)}</div>
            <div class="card-org">${escapeHtml(opp.organization)}</div>
            <div class="card-benefits">${escapeHtml(opp.benefits || '')}</div>
            ${opp.schedule ? `<div class="card-contact">SCHEDULE: ${escapeHtml(opp.schedule)}</div>` : ''}
            <div><span class="card-status status-active">${escapeHtml(opp.status || 'ACTIVE')}</span></div>
          </div>
        `;
      });
    }
    html += `</div>`;
  }

  container.innerHTML = html;
}

/**
 * Find opportunities that might match a specific calendar day.
 * Uses the schedule field to determine relevance.
 * "Ongoing" and "Daily" match every day.
 * Weekday patterns (Mon-Fri) match accordingly.
 * Specific date mentions are parsed when possible.
 */
function findOpportunitiesForDay(year, month, day) {
  const date = new Date(year, month, day);
  const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayName = dayNames[dayOfWeek];

  return state.opportunities.filter(opp => {
    const sched = (opp.schedule || '').toLowerCase();

    // Match everything if no schedule specified
    if (!sched) return false;

    // "Ongoing" or "Daily" or "24/7" — matches every day
    if (sched.includes('ongoing') || sched.includes('daily') || sched.includes('24/7') || sched.includes('rolling')) {
      return true;
    }

    // "Mon-Fri" or "Mon - Fri" — match weekdays
    if (sched.includes('mon') && sched.includes('fri')) {
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    }

    // "Mon-Sat" — match Monday through Saturday
    if (sched.includes('mon') && sched.includes('sat')) {
      return dayOfWeek >= 1 && dayOfWeek <= 6;
    }

    // Specific day name matching
    if (sched.includes(dayName)) return true;

    // "Tue-Sat" pattern
    if (sched.includes('tue') && sched.includes('sat') && !sched.includes('sun')) {
      return dayOfWeek >= 2 && dayOfWeek <= 6;
    }

    // Check if schedule mentions a specific month/day pattern
    // (This is a heuristic — the data uses free-text schedules)
    return false;
  });
}

/**
 * Navigate to previous/next month in calendar.
 */
function changeMonth(delta) {
  const newDate = new Date(state.calendarDate);
  newDate.setMonth(newDate.getMonth() + delta);
  state.calendarDate = newDate;
  renderView();
}

/**
 * Handle day click in calendar — show matching opportunities.
 */
function selectCalendarDay(year, month, day) {
  state.selectedDay = { year, month, day };
  renderView();
}


/* ============================================================ */
/* SECTION 10: NEIGHBORHOODS VIEW                               */
/* ============================================================ */

/**
 * Render the Neighborhoods view.
 * Groups opportunities by neighborhood in collapsible sections.
 * Each section shows a count and can be expanded/collapsed.
 */
function renderNeighborhoodsView(container) {
  if (state.filtered.length === 0) {
    container.innerHTML = '<div class="no-results">NO OPPORTUNITIES MATCH YOUR CRITERIA</div>';
    return;
  }

  // Group by neighborhood
  const groups = {};
  state.filtered.forEach(opp => {
    const nh = opp.neighborhood || 'Unknown';
    if (!groups[nh]) groups[nh] = [];
    groups[nh].push(opp);
  });

  // Sort neighborhood names alphabetically
  const sortedNeighborhoods = Object.keys(groups).sort();

  let html = '';
  sortedNeighborhoods.forEach(nh => {
    const opps = groups[nh];
    const isExpanded = state.expandedNeighborhoods.has(nh);
    const count = opps.length;

    html += `
      <div class="neighborhood-section">
        <button class="neighborhood-header" onclick="toggleNeighborhood('${escapeHtml(nh)}')">
          <span>${escapeHtml(nh)}</span>
          <span class="neighborhood-count">${count} OPPORTUNIT${count !== 1 ? 'IES' : 'Y'}</span>
        </button>
        <div class="neighborhood-content ${isExpanded ? 'open' : ''}" id="nh-${hashString(nh)}">
          <div class="neighborhood-cards">
    `;

    opps.forEach(opp => {
      const isSaved = !!state.saved[opp.id];
      html += `
        <div class="opportunity-card ${isSaved ? 'saved' : ''}" onclick="openModalById('${opp.id}')">
          <div class="card-category">${escapeHtml(opp.category)}</div>
          <div class="card-source">${escapeHtml(opp.source)}</div>
          <div class="card-org">${escapeHtml(opp.organization)}</div>
          <div class="card-benefits">${escapeHtml(opp.benefits || '')}</div>
          ${opp.schedule ? `<div class="card-contact">SCHEDULE: ${escapeHtml(opp.schedule)}</div>` : ''}
          <div><span class="card-status status-active">${escapeHtml(opp.status || 'ACTIVE')}</span></div>
        </div>
      `;
    });

    html += `
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

/**
 * Toggle a neighborhood section open/closed.
 */
function toggleNeighborhood(name) {
  if (state.expandedNeighborhoods.has(name)) {
    state.expandedNeighborhoods.delete(name);
  } else {
    state.expandedNeighborhoods.add(name);
  }

  // Toggle just this section without full re-render
  const el = document.getElementById(`nh-${hashString(name)}`);
  if (el) {
    el.classList.toggle('open');
  }
}


/* ============================================================ */
/* SECTION 11: TRACKER VIEW                                     */
/* ============================================================ */

/**
 * Render the Tracker view (main area).
 * Lists all saved opportunities with checklist management.
 */
function renderTrackerView(container) {
  const savedIds = Object.keys(state.saved);

  if (savedIds.length === 0) {
    container.innerHTML = `
      <div class="tracker-empty">
        NO SAVED OPPORTUNITIES<br><br>
        CLICK "SAVE" ON ANY CARD TO ADD IT TO YOUR TRACKER
      </div>
    `;
    return;
  }

  let html = '';

  savedIds.forEach(id => {
    const entry = state.saved[id];
    const opp = state.opportunities.find(o => o.id === id);
    if (!opp) return;

    html += renderTrackerItem(opp, entry);
  });

  container.innerHTML = html;
}

/**
 * Render the fixed tracker panel (side overlay).
 * Same content as tracker view but in a side panel.
 */
function renderTrackerPanel() {
  const list = document.getElementById('tracker-list');
  const summary = document.getElementById('tracker-summary');
  const savedIds = Object.keys(state.saved);

  // Summary stats
  const totalSaved = savedIds.length;
  let totalChecklistItems = 0;
  let completedChecklistItems = 0;

  savedIds.forEach(id => {
    const entry = state.saved[id];
    if (entry.checklist) {
      totalChecklistItems += entry.checklist.length;
      completedChecklistItems += entry.checklist.filter(c => c.done).length;
    }
  });

  const completionPercent = totalChecklistItems > 0
    ? Math.round((completedChecklistItems / totalChecklistItems) * 100)
    : 0;

  summary.innerHTML = `
    <span><strong>${totalSaved}</strong> SAVED</span>
    <span><strong>${completedChecklistItems}/${totalChecklistItems}</strong> CHECKLIST DONE</span>
    <span><strong>${completionPercent}%</strong> COMPLETE</span>
  `;

  // List items
  if (savedIds.length === 0) {
    list.innerHTML = '<div class="tracker-empty">NO SAVED ITEMS</div>';
    return;
  }

  let html = '';
  savedIds.forEach(id => {
    const entry = state.saved[id];
    const opp = state.opportunities.find(o => o.id === id);
    if (!opp) return;
    html += renderTrackerItem(opp, entry);
  });

  list.innerHTML = html;
}

/**
 * Render a single tracker item with checklist, progress, notes.
 */
function renderTrackerItem(opp, entry) {
  const isSaved = true;
  const checklist = entry.checklist || [];
  const total = checklist.length;
  const done = checklist.filter(c => c.done).length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  let checklistHtml = '';
  if (checklist.length > 0) {
    checklistHtml += '<div class="tracker-checklist"><h4>CHECKLIST</h4>';
    checklist.forEach((item, idx) => {
      checklistHtml += `
        <label class="checklist-item ${item.done ? 'checked' : ''}">
          <input type="checkbox" ${item.done ? 'checked' : ''}
            onchange="toggleChecklistItem('${opp.id}', ${idx})">
          <span>${escapeHtml(item.text)}</span>
        </label>
      `;
    });
    checklistHtml += `
      <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>
      <div class="progress-text">${done}/${total} COMPLETE (${percent}%)</div>
    </div>`;
  }

  const notes = entry.notes || '';

  return `
    <div class="tracker-item saved" id="tracker-item-${opp.id}">
      <div class="tracker-item-header">
        <div>
          <div class="tracker-item-title">${escapeHtml(opp.source)}</div>
          <div class="tracker-item-org">${escapeHtml(opp.organization)} — ${escapeHtml(opp.category)}</div>
        </div>
        <button class="tracker-item-remove" onclick="removeSaved('${opp.id}')">REMOVE</button>
      </div>
      ${checklistHtml}
      <div class="tracker-notes">
        <label>NOTES</label>
        <textarea
          onchange="updateNotes('${opp.id}', this.value)"
          placeholder="Add your notes here..."
        >${escapeHtml(notes)}</textarea>
      </div>
    </div>
  `;
}

/**
 * Update just the progress bar and text for a tracker item
 * without re-rendering the entire view.
 */
function updateChecklistProgress(oppId) {
  const entry = state.saved[oppId];
  if (!entry) return;

  const checklist = entry.checklist || [];
  const total = checklist.length;
  const done = checklist.filter(c => c.done).length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  const itemEl = document.getElementById(`tracker-item-${oppId}`);
  if (itemEl) {
    const fill = itemEl.querySelector('.progress-fill');
    const text = itemEl.querySelector('.progress-text');
    if (fill) fill.style.width = `${percent}%`;
    if (text) text.textContent = `${done}/${total} COMPLETE (${percent}%)`;
  }
}


/* ============================================================ */
/* SECTION 12: DETAIL MODAL                                     */
/* ============================================================ */

/**
 * Open the detail modal showing full information for an opportunity.
 * Displays all fields: eligibility, process, schedule, notes, checklist, etc.
 */
function openDetailModal(opp) {
  const modal = document.getElementById('detail-modal');
  const content = document.getElementById('modal-content');
  const isSaved = !!state.saved[opp.id];

  // Build detail sections
  let sections = '';

  // Benefits
  if (opp.benefits) {
    sections += `
      <div class="detail-section">
        <h3>BENEFITS</h3>
        <p>${escapeHtml(opp.benefits)}</p>
      </div>
    `;
  }

  // Eligibility
  if (opp.eligibility) {
    sections += `
      <div class="detail-section">
        <h3>ELIGIBILITY</h3>
        <p>${escapeHtml(opp.eligibility)}</p>
      </div>
    `;
  }

  // How It Works (process)
  if (opp.process) {
    sections += `
      <div class="detail-section">
        <h3>HOW IT WORKS</h3>
        <p>${escapeHtml(opp.process)}</p>
      </div>
    `;
  }

  // Contact info
  let contactSection = '';
  if (opp.phone) contactSection += `<div class="detail-contact">PHONE: ${escapeHtml(opp.phone)}</div>`;
  if (opp.email) contactSection += `<div class="detail-contact">EMAIL: ${escapeHtml(opp.email)}</div>`;
  if (opp.website) contactSection += `<div class="detail-contact">WEBSITE: <a href="${escapeHtml(opp.website)}" target="_blank" rel="noopener">${escapeHtml(opp.website)}</a></div>`;
  if (opp.address) contactSection += `<div class="detail-contact">ADDRESS: ${escapeHtml(opp.address)}</div>`;
  if (opp.neighborhood) contactSection += `<div class="detail-contact">NEIGHBORHOOD: ${escapeHtml(opp.neighborhood)}</div>`;

  if (contactSection) {
    sections += `
      <div class="detail-section">
        <h3>CONTACT</h3>
        ${contactSection}
      </div>
    `;
  }

  // Schedule
  if (opp.schedule) {
    sections += `
      <div class="detail-section">
        <h3>SCHEDULE</h3>
        <p>${escapeHtml(opp.schedule)}</p>
      </div>
    `;
  }

  // Checklist items
  if (opp.checklist && opp.checklist.length > 0) {
    const checklistItems = opp.checklist.map(item =>
      `<li>${escapeHtml(item)}</li>`
    ).join('');
    sections += `
      <div class="detail-section">
        <h3>CHECKLIST</h3>
        <ul>${checklistItems}</ul>
      </div>
    `;
  }

  // Notes
  if (opp.notes) {
    sections += `
      <div class="detail-section">
        <h3>NOTES</h3>
        <p>${escapeHtml(opp.notes)}</p>
      </div>
    `;
  }

  // Value
  if (opp.value) {
    sections += `
      <div class="detail-section">
        <h3>ESTIMATED VALUE</h3>
        <p>${escapeHtml(opp.value)}</p>
      </div>
    `;
  }

  content.innerHTML = `
    <button class="modal-close" onclick="closeDetailModal()">CLOSE</button>
    <div class="modal-category">${escapeHtml(opp.category)}</div>
    <div class="modal-source">${escapeHtml(opp.source)}</div>
    <div class="modal-org">${escapeHtml(opp.organization)}</div>
    <button class="btn-save ${isSaved ? 'saved' : ''}" onclick="toggleSaved('${opp.id}');closeDetailModal();" style="margin-bottom:var(--space-lg);">
      ${isSaved ? 'SAVED' : 'SAVE TO TRACKER'}
    </button>
    ${sections}
  `;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

/**
 * Open modal by opportunity ID (used by calendar/neighborhood views).
 */
function openModalById(oppId) {
  const opp = state.opportunities.find(o => o.id === oppId);
  if (opp) openDetailModal(opp);
}

/**
 * Close the detail modal.
 */
function closeDetailModal() {
  document.getElementById('detail-modal').style.display = 'none';
  document.body.style.overflow = '';
}


/* ============================================================ */
/* SECTION 13: EXPORT TO TXT                                    */
/* ============================================================ */

/**
 * Generate a text report of all saved tracker items.
 * Creates a downloadable .txt file with full details for each item.
 */
function exportToTxt() {
  const savedIds = Object.keys(state.saved);

  if (savedIds.length === 0) {
    alert('No saved items to export. Save some opportunities first.');
    return;
  }

  let lines = [];
  lines.push('============================================================');
  lines.push('  SF OPPORTUNITY OS — EXPORT');
  lines.push('============================================================');
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push(`Total Saved Items: ${savedIds.length}`);
  lines.push('');

  savedIds.forEach((id, index) => {
    const entry = state.saved[id];
    const opp = state.opportunities.find(o => o.id === id);
    if (!opp) return;

    lines.push('------------------------------------------------------------');
    lines.push(`#${index + 1}: ${opp.source}`);
    lines.push('------------------------------------------------------------');
    lines.push(`Category: ${opp.category}`);
    lines.push(`Organization: ${opp.organization}`);
    if (opp.phone) lines.push(`Phone: ${opp.phone}`);
    if (opp.email) lines.push(`Email: ${opp.email}`);
    if (opp.website) lines.push(`Website: ${opp.website}`);
    if (opp.address) lines.push(`Address: ${opp.address}`);
    if (opp.neighborhood) lines.push(`Neighborhood: ${opp.neighborhood}`);
    lines.push('');

    if (opp.benefits) {
      lines.push('BENEFITS:');
      lines.push(opp.benefits);
      lines.push('');
    }

    if (opp.eligibility) {
      lines.push('ELIGIBILITY:');
      lines.push(opp.eligibility);
      lines.push('');
    }

    if (opp.process) {
      lines.push('HOW IT WORKS:');
      lines.push(opp.process);
      lines.push('');
    }

    // Checklist with [ ] or [x]
    if (entry.checklist && entry.checklist.length > 0) {
      lines.push('CHECKLIST:');
      entry.checklist.forEach(item => {
        const mark = item.done ? '[x]' : '[ ]';
        lines.push(`  ${mark} ${item.text}`);
      });

      const total = entry.checklist.length;
      const done = entry.checklist.filter(c => c.done).length;
      const pct = Math.round((done / total) * 100);
      lines.push(`  Progress: ${done}/${total} (${pct}%)`);
      lines.push('');
    }

    if (entry.notes) {
      lines.push('NOTES:');
      lines.push(entry.notes);
      lines.push('');
    }

    if (opp.value) {
      lines.push(`Estimated Value: ${opp.value}`);
      lines.push('');
    }

    lines.push(`Status: ${opp.status || 'Active'}`);
    lines.push(`Saved: ${new Date(entry.savedAt).toLocaleString()}`);
    lines.push('');
  });

  // Footer summary
  let totalChecklistItems = 0;
  let completedChecklistItems = 0;
  savedIds.forEach(id => {
    const entry = state.saved[id];
    if (entry.checklist) {
      totalChecklistItems += entry.checklist.length;
      completedChecklistItems += entry.checklist.filter(c => c.done).length;
    }
  });

  lines.push('============================================================');
  lines.push('SUMMARY');
  lines.push('============================================================');
  lines.push(`Total Saved Opportunities: ${savedIds.length}`);
  lines.push(`Total Checklist Items: ${totalChecklistItems}`);
  lines.push(`Completed Checklist Items: ${completedChecklistItems}`);
  lines.push(`Overall Completion: ${totalChecklistItems > 0 ? Math.round((completedChecklistItems / totalChecklistItems) * 100) : 0}%`);
  lines.push('');
  lines.push('SF Opportunity OS v2');
  lines.push('https://github.com');

  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sfos-export-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


/* ============================================================ */
/* SECTION 14: UTILITY FUNCTIONS                                */
/* ============================================================ */

/**
 * Escape HTML special characters to prevent XSS.
 * Crucial when rendering user-provided data.
 */
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const str = String(text);
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Create a simple hash from a string for use as an element ID.
 * Neighborhood names may contain spaces and special characters,
 * so we hash them to create valid CSS IDs.
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}


/* ============================================================ */
/* SECTION 15: EVENT LISTENERS                                  */
/* ============================================================ */

/**
 * Wire up all event listeners on page load.
 * This is the entry point after the DOM is ready.
 */
function initEventListeners() {
  // Search input — real-time filtering
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', handleSearch);

  /*
   * Quick category buttons — one-click filter for top categories.
   * Clicking a cat-btn instantly filters to that category.
   * The "SHOW ALL" button (data-cat="") resets the filter.
   * These buttons stay in sync with the category dropdown.
   */
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      // Update state
      state.filters.category = cat;
      // Sync the dropdown to match
      document.getElementById('filter-category').value = cat;
      // Update active states on all category buttons
      syncCategoryButtons();
      // Re-filter and render
      applyFilters();
    });
  });

  // Filter dropdowns — these also sync the quick category buttons
  document.getElementById('filter-category').addEventListener('change', (e) => {
    handleFilterChange('category', e.target.value);
    // Sync the quick category buttons to match dropdown
    syncCategoryButtons();
  });
  document.getElementById('filter-neighborhood').addEventListener('change', (e) => {
    handleFilterChange('neighborhood', e.target.value);
  });
  document.getElementById('filter-status').addEventListener('change', (e) => {
    handleFilterChange('status', e.target.value);
  });

  // Clear filters button — also resets quick category buttons
  document.getElementById('clear-filters').addEventListener('click', () => {
    clearAllFilters();
    syncCategoryButtons();
  });

  // View toggle buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.view = btn.dataset.view;
      renderView();
    });
  });

  // Tracker close button
  document.getElementById('tracker-close').addEventListener('click', () => {
    state.view = 'cards';
    renderView();
  });

  // Export buttons
  document.getElementById('btn-export').addEventListener('click', exportToTxt);
  document.getElementById('btn-export-main').addEventListener('click', exportToTxt);

  // Modal close on backdrop click
  document.getElementById('detail-modal').addEventListener('click', (e) => {
    if (e.target.id === 'detail-modal') {
      closeDetailModal();
    }
  });

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDetailModal();
    }
  });
}


/* ============================================================ */
/* SECTION 16: APPLICATION ENTRY POINT                          */
/* ============================================================ */

/**
 * Initialize the application when the DOM is ready.
 * This is the first function that runs on page load.
 */
function init() {
  initEventListeners();
  loadData();
}

// Start the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);
