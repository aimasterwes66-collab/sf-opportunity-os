# SF Opportunity OS v2.2

A high-contrast, single-page web application for discovering and tracking opportunities in San Francisco. Built with pure vanilla JavaScript, HTML, and CSS — no external dependencies, no build step, no frameworks.

## What It Does

SF Opportunity OS surfaces **185 verified opportunities** across **10 categories** — from recovery programs and tech access to paid research studies, AI gigs, makerspaces, arts grants, workforce training, entrepreneurship support, and hidden community resources. Users can search, filter, save items to a personal tracker, manage checklists, take notes, and export everything to a text file.

## File Structure

```
sfos-v2/
├── index.html      # Single-page application shell
├── styles.css      # High-contrast black/white design system
├── app.js          # Complete application logic (no dependencies)
├── data.json       # Opportunity data (185 entries, 10 categories)
└── README.md       # This file
```

All four files must be in the same directory. Open `index.html` in any modern browser to run the app. No server required (though `data.json` fetch may require one depending on browser security settings — use any static file server if needed).

## How to Use

1. **Open `index.html`** in a web browser
2. **Search** opportunities using the large search input — searches across program name, organization, benefits, eligibility, notes, address, phone, and email
3. **Filter** by Category, Neighborhood, or Status using the dropdowns
4. **Toggle views** with the CARDS / CALENDAR / NEIGHBORHOODS / TRACKER buttons
5. **Click any card** to see full details including eligibility, process, checklist, and notes
6. **Click SAVE** on any card to add it to your tracker
7. **Open TRACKER view** to manage saved items, check off steps, and add personal notes
8. **Click EXPORT TO TXT** to download a complete text report of your saved items

All tracker data persists automatically in your browser's localStorage.

## How to Modify the Data

The data lives in `data.json`. The structure is:

```json
{
  "meta": {
    "version": "2.0",
    "generated": "2026-06-18",
    "city": "San Francisco",
    "total_opportunities": 78,
    "categories": ["Category Name", "..."],
    "neighborhoods": ["Neighborhood Name", "..."]
  },
  "opportunities": [
    {
      "id": "0001",
      "category": "Recovery & Health",
      "source": "Program Name",
      "organization": "Org Name",
      "website": "https://example.com",
      "benefits": "Description of what's offered...",
      "eligibility": "Who qualifies...",
      "process": "How to apply or participate...",
      "neighborhood": "Tenderloin",
      "address": "123 Main St",
      "phone": "(415) 555-0000",
      "email": "info@example.com",
      "schedule": "Mon-Fri 9AM-5PM",
      "status": "Active",
      "checklist": ["Step 1", "Step 2", "Step 3"],
      "notes": "Additional context...",
      "value": "$500 estimated"
    }
  ]
}
```

To add a new opportunity, append a new object to the `opportunities` array with all fields (empty strings for optional fields). The app will automatically pick it up on next load. To add a new category, add it to both `meta.categories` and use it in an opportunity's `category` field — the filter dropdown will auto-populate.

## How the Tracker Works

The tracker uses browser `localStorage` with the key `sfos_tracker`. The stored schema:

```json
{
  "0001": {
    "id": "0001",
    "savedAt": "2026-01-15T10:30:00.000Z",
    "checklist": [
      { "text": "Step 1 description", "done": true },
      { "text": "Step 2 description", "done": false }
    ],
    "notes": "Personal notes here"
  }
}
```

When you save an opportunity, the app copies its `checklist` array and wraps each item in `{ text, done }` objects. As you check items off, the state saves immediately to localStorage. If you clear your browser storage, tracker data is lost — use the Export feature to back up.

## Adding New Categories or Fields

**New category:** Add the category name to `meta.categories` in `data.json`, then use it in an opportunity's `category` field. The filter dropdown auto-populates from the data.

**New field on opportunities:** Add the field to the JSON objects. To display it in the UI, modify the card builder (`buildOpportunityCard`) and/or the detail modal (`openDetailModal`) in `app.js`.

**New filter type:** Add a new `<select>` to `index.html`, wire its change event in `initEventListeners`, add it to `state.filters`, and add the filtering logic in `applyFilters`.

## Tech Notes

- **Pure vanilla JavaScript** — no React, Vue, jQuery, or any other library
- **No build step** — edit files directly, refresh the browser
- **localStorage persistence** — tracker data survives page refreshes
- **High-contrast design** — pure black (#000000) background, pure white (#FFFFFF) text, designed for accessibility
- **Responsive** — works on mobile, tablet, and desktop
- **Print-friendly** — print styles invert to white background with black text
- **XSS-safe** — all user-provided data is HTML-escaped before rendering
- **Single directory** — the entire app is self-contained in one folder

## Browser Compatibility

Works in all modern browsers: Chrome, Firefox, Safari, Edge. Internet Explorer is not supported.

## License

Open source — modify and distribute freely.
