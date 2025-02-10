// events.js

// We'll attach everything to 'window' so 'app.js' or other scripts can reference it.
window.events = [];      // The main array of event objects: {id, name, start, end, imageUrl?}
window.nextEventId = 1; // Auto-increment ID for new events

// We'll store references to the new UI elements so we can do searching/sorting and date/time display
let eventsSearchEl      = null;
let eventsSortFieldEl   = null;
let eventsSortOrderEl   = null;
let eventsTitleEl       = null;

/**
 * INIT: Called once after DOM is loaded, or from app.js if you prefer.
 * Attaches the new search/sort listeners, etc.
 */
function initEvents() {
  eventsSearchEl    = document.getElementById('events-search');
  eventsSortFieldEl = document.getElementById('events-sort-field');
  eventsSortOrderEl = document.getElementById('events-sort-order');
  eventsTitleEl     = document.getElementById('events-title'); // The <h3 id="events-title">Scheduled Events</h3>

  // Listen for changes
  if (eventsSearchEl) {
    eventsSearchEl.addEventListener('input', () => {
      loadEvents();
    });
  }
  if (eventsSortFieldEl && eventsSortOrderEl) {
    eventsSortFieldEl.addEventListener('change', () => loadEvents());
    eventsSortOrderEl.addEventListener('change', () => loadEvents());
  }
}

/**
 * loadEvents():
 * 1) Displays current date/time in #events-title
 * 2) Filters by search
 * 3) Sorts by chosen field+order
 * 4) Updates the #events-list
 * 5) Also updates #select-events (for scheduling)
 */
window.loadEvents = function() {
  const eventsList = document.getElementById('events-list');
  if (!eventsList) return;

  // 1) Display current date/time next to "Scheduled Events"
  if (eventsTitleEl) {
    const nowStr = new Date().toLocaleString();
    // E.g. "Scheduled Events (4/1/2025, 1:23 PM)"
    eventsTitleEl.textContent = `Scheduled Events (${nowStr})`;
  }

  // 2) Filter by search query
  const query = eventsSearchEl ? eventsSearchEl.value.trim().toLowerCase() : '';
  let filtered = window.events;
  if (query) {
    filtered = window.events.filter(evt => {
      // Match name, start, or end ignoring case
      const nameMatch  = evt.name.toLowerCase().includes(query);
      const startMatch = evt.start.toLowerCase().includes(query);
      const endMatch   = evt.end.toLowerCase().includes(query);
      return (nameMatch || startMatch || endMatch);
    });
  }

  // 3) Sort by chosen field & order
  let sortField = 'start'; // default
  let sortOrder = 'asc';   // default
  if (eventsSortFieldEl && eventsSortOrderEl) {
    sortField = eventsSortFieldEl.value; 
    sortOrder = eventsSortOrderEl.value; 
  }
  filtered.sort((a,b) => eventCompare(a,b, sortField, sortOrder));

  // 4) Clear & rebuild #events-list
  eventsList.innerHTML = '';
  filtered.forEach(evt => {
    const li = document.createElement('li');
    li.innerHTML = renderEventItem(evt);
    eventsList.appendChild(li);
  });

  // 5) Update scheduling's <select> (#select-events)
  const selectEvents = document.getElementById('select-events');
  if (selectEvents) {
    selectEvents.innerHTML = '';
    filtered.forEach(evt => {
      const opt = document.createElement('option');
      opt.value = evt.id;
      opt.textContent = `${evt.name} (Start: ${evt.start}, End: ${evt.end})`;
      selectEvents.appendChild(opt);
    });
  }
};

/** Compare two events by the given field & order for sorting. */
function eventCompare(a,b, field, order) {
  let valA, valB;
  switch(field) {
    case 'end':
      valA = new Date(a.end).getTime() || 0;
      valB = new Date(b.end).getTime() || 0;
      break;
    case 'name':
      valA = a.name.toLowerCase();
      valB = b.name.toLowerCase();
      break;
    case 'duration':
      const aStart = new Date(a.start).getTime() || 0;
      const aEnd   = new Date(a.end).getTime()   || 0;
      valA = aEnd - aStart;

      const bStart = new Date(b.start).getTime() || 0;
      const bEnd   = new Date(b.end).getTime()   || 0;
      valB = bEnd - bStart;
      break;
    default:
      // "start" or fallback
      valA = new Date(a.start).getTime() || 0;
      valB = new Date(b.start).getTime() || 0;
      break;
  }

  if (valA < valB) return (order === 'asc' ? -1 : 1);
  if (valA > valB) return (order === 'asc' ? 1 : -1);
  return 0;
}

/** Build the HTML for a single event item. */
function renderEventItem(evt) {
  // Optionally display duration
  const startMs = new Date(evt.start).getTime();
  const endMs   = new Date(evt.end).getTime();
  let durationStr = '';
  if (!isNaN(startMs) && !isNaN(endMs)) {
    const diffMin = Math.round((endMs - startMs)/60000);
    durationStr = ` (~${diffMin} min)`;
  }

  // If evt.imageUrl is defined, show a thumbnail
  let leftHtml = `
    <span>
      <strong>${evt.name}</strong> (Start: ${evt.start}, End: ${evt.end}${durationStr})
    </span>
  `;
  if (evt.imageUrl) {
    leftHtml = `
      <span style="display:flex; align-items:center; gap:10px;">
        <img src="${evt.imageUrl}" alt="Event Image" class="event-image"/>
        <span>
          <strong>${evt.name}</strong>
          (Start: ${evt.start}, End: ${evt.end}${durationStr})
        </span>
      </span>
    `;
  }

  return `
    ${leftHtml}
    <div>
      <button onclick="editEvent(${evt.id})">Edit</button>
      <button onclick="removeEvent(${evt.id})">Remove</button>
    </div>
  `;
}

/** Edit event by ID */
window.editEvent = function(id) {
  const evt = window.events.find(e => e.id === id);
  if (!evt) return;

  document.getElementById('event-id').value = evt.id;
  document.getElementById('event-name').value = evt.name;
  document.getElementById('event-start').value = evt.start;
  document.getElementById('event-end').value = evt.end;
  document.getElementById('save-event-btn').textContent = 'Save Event';
};

/** Remove event by ID */
window.removeEvent = function(id) {
  window.events = window.events.filter(e => e.id !== id);
  window.loadEvents();
};

/** Convert file to Base64 */
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Document load -> attach form listener for add/update. */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize the new UI controls (search/sort) and date/time display logic
  initEvents();

  // Hook up the event form
  const addEventForm = document.getElementById('add-event-form');
  if (addEventForm) {
    addEventForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const evtId = document.getElementById('event-id').value.trim();
      const name = document.getElementById('event-name').value.trim();
      const start = document.getElementById('event-start').value.trim();
      const end = document.getElementById('event-end').value.trim();
      const imageFileInput = document.getElementById('event-image');

      if (!name || !start || !end) return;

      let imageUrl = '';
      if (imageFileInput && imageFileInput.files[0]) {
        imageUrl = await readFileAsBase64(imageFileInput.files[0]);
      }

      if (evtId) {
        // Update existing
        const existing = window.events.find(e => e.id === parseInt(evtId));
        if (existing) {
          existing.name  = name;
          existing.start = start;
          existing.end   = end;
          if (imageUrl) {
            existing.imageUrl = imageUrl;
          }
        }
      } else {
        // Add new
        window.events.push({
          id: window.nextEventId++,
          name,
          start,
          end,
          imageUrl
        });
      }

      // Clear form
      document.getElementById('event-id').value = '';
      document.getElementById('event-name').value = '';
      document.getElementById('event-start').value = '';
      document.getElementById('event-end').value = '';
      if (imageFileInput) imageFileInput.value = '';
      document.getElementById('save-event-btn').textContent = 'Add Event';

      window.loadEvents();
    });
  }
});

/* ================================
   Import/Export logic
================================ */
window.importCsvBtn   = document.getElementById('import-csv-btn');
window.importJsonBtn  = document.getElementById('import-json-btn');
window.importCsvFile  = document.getElementById('import-csv-file');
window.importJsonFile = document.getElementById('import-json-file');

window.exportCsvBtn   = document.getElementById('export-csv-btn');
window.exportJsonBtn  = document.getElementById('export-json-btn');
window.exportPdfBtn   = document.getElementById('export-pdf-btn');
window.exportIcsBtn   = document.getElementById('export-ics-btn');

if (window.exportCsvBtn) {
  window.exportCsvBtn.addEventListener('click', exportEventsAsCSV);
}
if (window.exportJsonBtn) {
  window.exportJsonBtn.addEventListener('click', exportEventsAsJSON);
}
if (window.exportPdfBtn) {
  window.exportPdfBtn.addEventListener('click', exportEventsAsPDF);
}
if (window.exportIcsBtn) {
  window.exportIcsBtn.addEventListener('click', exportEventsAsICS);
}

// CSV import
if (window.importCsvBtn && window.importCsvFile) {
  window.importCsvBtn.addEventListener('click', () => {
    window.importCsvFile.click();
  });
  window.importCsvFile.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      importEventsFromCSV(e.target.files[0]);
      window.importCsvFile.value = '';
    }
  });
}

// JSON import
if (window.importJsonBtn && window.importJsonFile) {
  window.importJsonBtn.addEventListener('click', () => {
    window.importJsonFile.click();
  });
  window.importJsonFile.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      importEventsFromJSON(e.target.files[0]);
      window.importJsonFile.value = '';
    }
  });
}

/** Export to CSV */
function exportEventsAsCSV() {
  let csv = "data:text/csv;charset=utf-8," +
    "id,name,start,end\n" +
    window.events.map(evt =>
      `${evt.id},"${(evt.name || '').replace(/"/g,'""')}",${evt.start || ''},${evt.end || ''}`
    ).join("\n");
  
  const encodedUri = encodeURI(csv);
  const link = document.createElement('a');
  link.href = encodedUri;
  link.download = "events.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Export to JSON */
function exportEventsAsJSON() {
  const json = JSON.stringify(window.events, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = "events.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Export to PDF (placeholder) */
function exportEventsAsPDF() {
  let text = "Events:\n\n";
  window.events.forEach(evt => {
    text += `${evt.name} | Start: ${evt.start} | End: ${evt.end}\n`;
  });

  const blob = new Blob([text], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "events.pdf";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  alert("Placeholder PDF export. Use a real PDF library for an actual PDF!");
}

/** Export to ICS */
function exportEventsAsICS() {
  let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//MyApp//Events//EN\n";
  window.events.forEach(evt => {
    ics += "BEGIN:VEVENT\n";
    ics += `UID:event-${evt.id}\n`;

    // For real usage, parse and format times better
    ics += `DTSTART:${(evt.start||'').replace(/[-:]/g,"").replace("T","")}Z\n`;
    ics += `DTEND:${(evt.end||'').replace(/[-:]/g,"").replace("T","")}Z\n`;
    ics += `SUMMARY:${evt.name}\n`;
    ics += "END:VEVENT\n";
  });
  ics += "END:VCALENDAR";

  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = "events.ics";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  alert("Exported ICS. Times might need better formatting for real iCalendar usage!");
}

/** CSV Import */
function parseCsvLine(line) {
  return line.split(",").map(l => l.trim());
}
function importEventsFromCSV(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const lines= text.split("\n").map(l => l.trim()).filter(l => l);
    if (!lines.length) return;

    // remove header
    lines.shift(); // "id,name,start,end"
    lines.forEach(line => {
      const [idRaw, nameRaw, start, end] = parseCsvLine(line);
      const id = parseInt(idRaw);
      const evName = (nameRaw || '').replace(/^"|"$/g,"");
      window.events.push({
        id: isNaN(id) ? window.nextEventId++ : id,
        name: evName,
        start: start || '',
        end: end || ''
      });
      if (!isNaN(id) && id >= window.nextEventId) {
        window.nextEventId = id + 1;
      }
    });
    window.loadEvents();
    alert("Imported events from CSV.");
  };
  reader.readAsText(file);
}

/** JSON Import */
function importEventsFromJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const arr = JSON.parse(e.target.result);
      arr.forEach(evt => {
        if (!evt.id) {
          evt.id = window.nextEventId++;
        } else if (evt.id >= window.nextEventId) {
          window.nextEventId = evt.id + 1;
        }
        evt.name  = evt.name  || 'Untitled';
        evt.start = evt.start || '';
        evt.end   = evt.end   || '';
        window.events.push(evt);
      });
      window.loadEvents();
      alert("Imported events from JSON.");
    } catch(err) {
      alert("Failed to parse JSON file.");
    }
  };
  reader.readAsText(file);
}
