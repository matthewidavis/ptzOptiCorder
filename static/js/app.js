// app.js

// Show/hide tabs
function showTab(tabId) {
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(tab => {
    tab.style.display = 'none';
  });
  const activeTab = document.getElementById(tabId);
  if (activeTab) activeTab.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
  // Global Settings
  let globalSettings = {
    format: 'mp4',
    location: './recordings/',
    segmentation: 10
  };

  // Initialize the camera module with global settings and load the camera list
  camera.init(globalSettings);
  camera.loadStreams();

  // If events.js is loaded, initialize events if needed
  if (window.loadEvents) {
    window.loadEvents();
  }

  // Scheduling (Manual vs. Events)
  const scheduleForm = document.getElementById('schedule-stream-form');
  const scheduledRecordingsList = document.getElementById('scheduled-recordings-list');
  const modeManual = document.getElementById('mode-manual');
  const modeEvents = document.getElementById('mode-events');
  const eventBasedScheduling = document.getElementById('event-based-scheduling');
  const scheduleEventsBtn = document.getElementById('schedule-events-btn');
  const selectEvents = document.getElementById('select-events');

  if (scheduleForm) {
    scheduleForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (modeEvents && modeEvents.checked) return;
      const streamSelect = document.getElementById('select-stream');
      const streamId = streamSelect.value;
      const scheduleTime = document.getElementById('schedule-time').value;
      if (streamId && scheduleTime) {
        const streams = camera.getStreams();
        const stream = streams.find(s => s.id === parseInt(streamId));
        if (stream) {
          const li = document.createElement('li');
          li.classList.add('scheduled-item');
          li.innerHTML = `
            <span>${stream.name} at ${scheduleTime}</span>
            <button onclick="cancelScheduledRecording('${stream.id}-${scheduleTime}')">Cancel</button>
          `;
          scheduledRecordingsList.appendChild(li);
        }
      }
    });
  }

  window.cancelScheduledRecording = function(scheduleId) {
    const [streamId, scheduleTime] = scheduleId.split('-');
    const itemToRemove = [...scheduledRecordingsList.children].find(
      item => item.textContent.includes(scheduleTime)
    );
    if (itemToRemove) itemToRemove.remove();
  };

  if (modeManual && modeEvents) {
    modeManual.addEventListener('change', () => {
      if (modeManual.checked) {
        scheduleForm.style.display = 'block';
        eventBasedScheduling.style.display = 'none';
      }
    });
    modeEvents.addEventListener('change', () => {
      if (modeEvents.checked) {
        scheduleForm.style.display = 'none';
        eventBasedScheduling.style.display = 'block';
      }
    });
  }

  if (scheduleEventsBtn) {
    scheduleEventsBtn.addEventListener('click', () => {
      if (!modeEvents || !modeEvents.checked) return;
      if (!selectEvents) return;
      const selectedOptions = [...selectEvents.selectedOptions];
      if (selectedOptions.length === 0) {
        alert('No events selected!');
        return;
      }
      selectedOptions.forEach(opt => {
        const evtId = parseInt(opt.value);
        const evtObj = window.events.find(e => e.id === evtId);
        if (evtObj) {
          const li = document.createElement('li');
          li.classList.add('scheduled-item');
          li.innerHTML = `
            <span>Event: ${evtObj.name} (Start: ${evtObj.start}, End: ${evtObj.end})</span>
            <button onclick="cancelScheduledRecording('event-${evtObj.id}')">Cancel</button>
          `;
          scheduledRecordingsList.appendChild(li);
        }
      });
    });
  }

  // Highlights
  function displayHighlights() {
    const highlightsList = document.getElementById('highlights-list');
    if (!highlightsList) return;
    const highlightItem = document.createElement('li');
    highlightItem.innerHTML = `
      <span>Highlight Video 1</span>
      <button>View</button>
    `;
    highlightsList.appendChild(highlightItem);
  }
  displayHighlights();

  // Default tab
  showTab('camera-management-tab');
});
