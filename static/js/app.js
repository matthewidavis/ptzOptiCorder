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
  const selectStream = document.getElementById('select-stream');
  const selectEventCameras = document.getElementById('select-event-cameras');

  // Populate camera options for manual scheduling and event-based scheduling
  const loadCameras = () => {
    const cameras = camera.getStreams(); // Assuming camera.getStreams() gives us the list of available streams
    cameras.forEach(camera => {
      const option = document.createElement('option');
      option.value = camera.id;
      option.textContent = camera.name;
      selectStream.appendChild(option);
      
      const eventCameraOption = document.createElement('option');
      eventCameraOption.value = camera.id;
      eventCameraOption.textContent = camera.name;
      selectEventCameras.appendChild(eventCameraOption);
    });
  };

  loadCameras();
  window.loadEvents(); // Assuming the window.loadEvents() already loads the event options

  // Show/hide scheduling forms based on selected mode
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

  // Manual Scheduling Form Submit Handler
  scheduleForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (modeEvents && modeEvents.checked) return; // Prevent if event mode is active
    
    const selectedStreamIds = Array.from(selectStream.selectedOptions).map(option => option.value);
    const scheduleTime = document.getElementById('schedule-time').value;
    const endTime = document.getElementById('schedule-end-time').value;

    if (selectedStreamIds.length === 0 || !scheduleTime || !endTime) {
      alert('Please provide all necessary details.');
      return;
    }

    // Treat all selected cameras as one group for manual scheduling
    const scheduleId = `${scheduleTime}-${endTime}-${selectedStreamIds.join(',')}`;

    selectedStreamIds.forEach(streamId => {
      const streams = camera.getStreams();
      const stream = streams.find(s => s.id === parseInt(streamId));
      if (stream) {
        // Add a new scheduled item to the list
        const li = document.createElement('li');
        li.classList.add('scheduled-item');
        li.innerHTML = `
          <span>${stream.name} at ${scheduleTime} - ${endTime}</span>
          <button onclick="cancelScheduledRecording('${scheduleId}')">Cancel</button>
          <button onclick="editScheduledRecording('${scheduleId}')">Modify</button>
        `;
        scheduledRecordingsList.appendChild(li);

        // You can also add a fetch call here to submit the schedule to the backend
        // fetch('/api/start_recording', { ... });
      }
    });
  });

  // Event-based Scheduling (assign cameras to events)
  scheduleEventsBtn.addEventListener('click', () => {
    if (!modeEvents || !modeEvents.checked) return;

    const selectedOptions = [...selectEvents.selectedOptions];
    const selectedCameraIds = [...selectEventCameras.selectedOptions].map(option => option.value);

    if (selectedOptions.length === 0 || selectedCameraIds.length === 0) {
      alert('Please select at least one event and one camera.');
      return;
    }

    selectedOptions.forEach(opt => {
      const evtId = parseInt(opt.value);
      const evtObj = window.events.find(e => e.id === evtId);
      if (evtObj) {
        // Add a new scheduled item to the list
        const li = document.createElement('li');
        li.classList.add('scheduled-item');
        li.innerHTML = `
          <span>Event: ${evtObj.name} (Start: ${evtObj.start}, End: ${evtObj.end})</span>
          <button onclick="cancelScheduledRecording('event-${evtObj.id}')">Cancel</button>
          <button onclick="editScheduledRecording('event-${evtObj.id}')">Modify</button>
        `;
        scheduledRecordingsList.appendChild(li);

        // You can also submit this schedule to the backend
        // fetch('/api/schedule_event', { ... });
      }
    });
  });

  // Cancel scheduled recordings
  window.cancelScheduledRecording = function(scheduleId) {
    const itemToRemove = [...scheduledRecordingsList.children].find(
      item => item.textContent.includes(scheduleId)
    );
    if (itemToRemove) itemToRemove.remove();

    // Send delete request to backend if needed
    // fetch('/api/delete_recording', { ... });
  };

  // Edit scheduled recording
  window.editScheduledRecording = function(scheduleId) {
    const [scheduleTime, endTime, cameraIds] = scheduleId.split('-');
    const selectedCameras = cameraIds.split(',');

    // Fill the form with the existing data
    document.getElementById('schedule-time').value = scheduleTime;
    document.getElementById('schedule-end-time').value = endTime;

    // Select the cameras that were originally scheduled
    const options = Array.from(selectStream.options);
    options.forEach(option => {
      if (selectedCameras.includes(option.value)) {
        option.selected = true;
      }
    });

    // Store the editing schedule for saving later
    currentEditingSchedule = {
      start_time: scheduleTime,
      end_time: endTime,
      cameras: selectedCameras
    };
  };

  // Modify the scheduled recording when form is resubmitted
  scheduleForm.addEventListener('submit', (e) => {
    e.preventDefault();

    // If editing, update the schedule
    if (currentEditingSchedule) {
      const { start_time, end_time, cameras } = currentEditingSchedule;
      // Update the scheduled recording list
      // Replace the entry in the list with the new data

      currentEditingSchedule = null; // Reset after editing
    }
  });

  // Filtering and sorting (For scheduled recordings)
  const applyFiltersBtn = document.getElementById('apply-filters-btn');
  const filterCameras = document.getElementById('filter-cameras');
  const sortRecordings = document.getElementById('sort-recordings');

  applyFiltersBtn.addEventListener('click', () => {
    const selectedCamera = filterCameras.value;
    const sortOrder = sortRecordings.value;
    
    // Example of filtering and sorting
    const filteredAndSortedRecordings = scheduledRecordingsList.filter(recording => {
      return selectedCamera === '' || recording.cameraId === selectedCamera;
    }).sort((a, b) => {
      return sortOrder === 'start-time' ? new Date(a.startTime) - new Date(b.startTime) : new Date(a.endTime) - new Date(b.endTime);
    });

    // Update the UI with filtered and sorted recordings
    scheduledRecordingsList.innerHTML = ''; // Clear current list
    filteredAndSortedRecordings.forEach(recording => {
      const li = document.createElement('li');
      li.textContent = `Recording for Camera: ${recording.cameraName}, Start: ${recording.startTime}, End: ${recording.endTime}`;
      scheduledRecordingsList.appendChild(li);
    });
  });
});
