// camera.js

window.camera = (function() {
  // Module-scoped data
  let streams = [
    { id: 1, name: 'Camera 1', uri: 'rtsp://192.168.12.111:554/1' },
    { id: 2, name: 'Camera 2', uri: 'rtsp://192.168.12.9:554/1' }
  ];
  let cameraSettings = {};      // { streamId: { useGlobal, format, location, segmentation } }
  let previewIntervals = {};    // For live preview intervals
  let statsIntervals = {};      // For periodic stats updates
  let pausedPreviews = {};      // { streamId: boolean }
  let globalSettings = null;    // Set by app.js

  // DOM references for the camera form
  let addCameraForm, cameraIdField, cameraNameField, cameraUriField, cameraFormBtn;

  /**********************************
   * Utility Functions
   **********************************/
  function getCameraIPFromUri(uri) {
    try {
      const withoutProtocol = uri.replace('rtsp://', '');
      return withoutProtocol.split('/')[0].split(':')[0];
    } catch (e) {
      return '';
    }
  }

  // Update the live preview image for a camera.
  // (This function is unchanged from before.)
  function updateLivePreview(streamId, ip) {
    if (pausedPreviews[streamId]) return;
    const previewDiv = document.getElementById(`preview-${streamId}`);
    if (!previewDiv) return;
    let imgEl = previewDiv.querySelector('img');
    if (!imgEl) {
      imgEl = document.createElement('img');
      imgEl.style.maxWidth = '300px';
      imgEl.style.maxHeight = '200px';
      previewDiv.innerHTML = '';
      previewDiv.appendChild(imgEl);
    }
    const snapshotUrl = `http://${ip}/snapshot.jpg`;
    fetch(snapshotUrl, { method: 'GET', cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        const objectURL = URL.createObjectURL(blob);
        imgEl.src = objectURL;
      })
      .catch(err => {
        console.error(`Error fetching snapshot for stream ${streamId}:`, err);
        imgEl.src = '';
        imgEl.alt = 'Camera Unavailable';
      });
  }

  // Render placeholders (titles and "..." values) immediately in the stats area.
  function renderStatsPlaceholder(streamId) {
    const statsContainer = document.getElementById(`stats-content-${streamId}`);
    if (!statsContainer) return;
    statsContainer.innerHTML = `
      <div class="stats-grid">
        <div class="stat-row"><span class="stat-key">Video Codec:</span><span class="stat-value">...</span></div>
        <div class="stat-row"><span class="stat-key">Resolution:</span><span class="stat-value">...</span></div>
        <div class="stat-row"><span class="stat-key">Frame Rate:</span><span class="stat-value">...</span></div>
        <div class="stat-row"><span class="stat-key">GOP Interval:</span><span class="stat-value">...</span></div>
        <div class="stat-row"><span class="stat-key">Latency:</span><span class="stat-value">...</span></div>
        <div class="stat-row"><span class="stat-key">Jitter:</span><span class="stat-value">...</span></div>
        <div class="stat-row"><span class="stat-key">Dropped Frames:</span><span class="stat-value">...</span></div>
        <div class="stat-row"><span class="stat-key">Video Bitrate:</span><span class="stat-value">...</span></div>
      </div>
    `;
  }

  // Update the stats display with the actual values.
  function renderStats(streamId, stats) {
    const statsContainer = document.getElementById(`stats-content-${streamId}`);
    if (!statsContainer) return;
    statsContainer.innerHTML = `
      <div class="stats-grid">
        <div class="stat-row"><span class="stat-key">Video Codec:</span><span class="stat-value">${stats["Video Codec"] || "N/A"}</span></div>
        <div class="stat-row"><span class="stat-key">Resolution:</span><span class="stat-value">${stats["Resolution"] || "N/A"}</span></div>
        <div class="stat-row"><span class="stat-key">Frame Rate:</span><span class="stat-value">${stats["Frame Rate"] || "N/A"}</span></div>
        <div class="stat-row"><span class="stat-key">GOP Interval:</span><span class="stat-value">${stats["GOP Interval"] || "N/A"}</span></div>
        <div class="stat-row"><span class="stat-key">Latency:</span><span class="stat-value">${stats["Latency"] || "N/A"}</span></div>
        <div class="stat-row"><span class="stat-key">Jitter:</span><span class="stat-value">${stats["Jitter"] || "N/A"}</span></div>
        <div class="stat-row"><span class="stat-key">Dropped Frames:</span><span class="stat-value">${stats["Dropped Frames"] || "N/A"}</span></div>
        <div class="stat-row"><span class="stat-key">Video Bitrate:</span><span class="stat-value">${stats["Video Bitrate"] || "N/A"}</span></div>
      </div>
    `;
  }

  /**********************************
   * Public Methods for Camera Module
   **********************************/
  function init(gSettings) {
    globalSettings = gSettings;
    addCameraForm   = document.getElementById('add-camera-form');
    cameraIdField   = document.getElementById('camera-id');
    cameraNameField = document.getElementById('camera-name');
    cameraUriField  = document.getElementById('camera-uri');
    cameraFormBtn   = document.getElementById('camera-form-btn');

    if (addCameraForm) {
      addCameraForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const hiddenId = cameraIdField.value.trim();
        const nameVal  = cameraNameField.value.trim();
        const uriVal   = cameraUriField.value.trim();
        if (!nameVal || !uriVal) return;
        if (hiddenId) {
          // Edit mode
          const camId = parseInt(hiddenId, 10);
          const existing = streams.find(s => s.id === camId);
          if (existing) {
            existing.name = nameVal;
            existing.uri  = uriVal;
          }
          cameraIdField.value = '';
          cameraFormBtn.textContent = 'Add Camera';
        } else {
          const newId = streams.length ? Math.max(...streams.map(s => s.id)) + 1 : 1;
          streams.push({ id: newId, name: nameVal, uri: uriVal });
        }
        cameraNameField.value = '';
        cameraUriField.value  = '';
        loadStreams();
      });
    }
  }

  function getStreams() {
    return streams;
  }

  function getCameraSettings() {
    return cameraSettings;
  }

  // Build (or rebuild) the camera list UI
  function loadStreams() {
    const streamList = document.getElementById('camera-list');
    const recordingControlsEl = document.getElementById('recording-controls');
    const streamSelect = document.getElementById('select-stream');
    const scheduledRecordingsList = document.getElementById('scheduled-recordings-list');
    const cameraSettingsList = document.getElementById('camera-settings-list');

    if (!streamList || !recordingControlsEl || !streamSelect || !scheduledRecordingsList || !cameraSettingsList) {
      console.error('One or more required elements not found for camera management.');
      return;
    }

    // Clear previous UI and intervals
    streamList.innerHTML = '';
    recordingControlsEl.innerHTML = '';
    streamSelect.innerHTML = '<option value="">Select Stream</option>';
    scheduledRecordingsList.innerHTML = '';
    cameraSettingsList.innerHTML = '';

    Object.keys(previewIntervals).forEach(id => clearInterval(previewIntervals[id]));
    Object.keys(statsIntervals).forEach(id => clearInterval(statsIntervals[id]));

    streams.forEach(stream => {
      // Create a list item (3-column grid)
      const listItem = document.createElement('li');
      listItem.classList.add('stream-item');

      // LEFT column: Camera Info with embedded stats container (initially hidden)
      const leftCol = `
        <div class="camera-info">
          <span class="camera-title">${stream.name}</span>
          <span class="camera-uri">${stream.uri}</span>
          <div class="camera-stats" id="stats-content-${stream.id}" style="display: none;"></div>
        </div>
      `;
      // CENTER column: Live Preview (clickable to pause/resume)
      const midCol = `
        <div class="camera-preview">
          <div class="live-preview" id="preview-${stream.id}" onclick="camera.togglePreview(${stream.id})">
            Loading preview...
          </div>
        </div>
      `;
      // RIGHT column: Action Buttons (Edit, Remove, Stats)
      const rightCol = `
        <div class="camera-actions">
          <button onclick="camera.editCamera(${stream.id})">Edit</button>
          <button onclick="camera.removeStream(${stream.id})">Remove</button>
          <button onclick="camera.toggleStats(${stream.id})">Stats</button>
        </div>
      `;
      listItem.innerHTML = leftCol + midCol + rightCol;
      streamList.appendChild(listItem);

      // Recording Controls (separate list)
      const controlLi = document.createElement('li');
      controlLi.classList.add('control-item');
      controlLi.innerHTML = `
        <span>${stream.name}</span>
        <button onclick="recording.startRecording(${stream.id})">Start</button>
        <button onclick="recording.stopRecording(${stream.id})">Stop</button>
      `;
      recordingControlsEl.appendChild(controlLi);

      // Add camera to scheduling dropdown
      const opt = document.createElement('option');
      opt.value = stream.id;
      opt.textContent = stream.name;
      streamSelect.appendChild(opt);

      // Set up individual camera settings (Accordion)
      if (!cameraSettings[stream.id]) {
        cameraSettings[stream.id] = {
          useGlobal: true,
          format: globalSettings.format,
          location: globalSettings.location,
          segmentation: globalSettings.segmentation
        };
      }
      const accLi = document.createElement('li');
      accLi.classList.add('camera-accordion');
      accLi.innerHTML = `
        <div class="camera-accordion-header" id="camera-accordion-header-${stream.id}">
          <span>${stream.name}</span>
          <div style="display:flex; align-items:center; gap:10px;">
            <label style="display:flex; align-items:center; gap:5px;">
              <input type="checkbox" id="useGlobal-${stream.id}" ${cameraSettings[stream.id].useGlobal ? 'checked' : ''}/>
              Use Global
            </label>
            <button type="button" id="toggle-accordion-${stream.id}">&#9660;</button>
          </div>
        </div>
        <div class="camera-accordion-content" id="camera-accordion-content-${stream.id}">
          <label>Format:</label>
          <input type="text" id="cam-format-${stream.id}" placeholder="Format"/>
          <label>Location:</label>
          <input type="text" id="cam-location-${stream.id}" placeholder="Location"/>
          <label>Segmentation (minutes):</label>
          <input type="number" id="cam-segment-${stream.id}" placeholder="Duration"/>
        </div>
      `;
      cameraSettingsList.appendChild(accLi);

      // Attach event listeners for the settings accordion
      setTimeout(() => {
        const useGlobalCheck = document.getElementById(`useGlobal-${stream.id}`);
        const contentDiv = document.getElementById(`camera-accordion-content-${stream.id}`);
        const formatInput = document.getElementById(`cam-format-${stream.id}`);
        const locationInput = document.getElementById(`cam-location-${stream.id}`);
        const segmentInput = document.getElementById(`cam-segment-${stream.id}`);
        const toggleBtn = document.getElementById(`toggle-accordion-${stream.id}`);

        useGlobalCheck.checked = cameraSettings[stream.id].useGlobal;
        formatInput.value = cameraSettings[stream.id].format;
        locationInput.value = cameraSettings[stream.id].location;
        segmentInput.value = cameraSettings[stream.id].segmentation;
        contentDiv.style.display = useGlobalCheck.checked ? 'none' : 'block';

        useGlobalCheck.addEventListener('change', () => {
          cameraSettings[stream.id].useGlobal = useGlobalCheck.checked;
          if (useGlobalCheck.checked) {
            cameraSettings[stream.id].format = globalSettings.format;
            cameraSettings[stream.id].location = globalSettings.location;
            cameraSettings[stream.id].segmentation = globalSettings.segmentation;
            formatInput.value = cameraSettings[stream.id].format;
            locationInput.value = cameraSettings[stream.id].location;
            segmentInput.value = cameraSettings[stream.id].segmentation;
            contentDiv.style.display = 'none';
          } else {
            contentDiv.style.display = 'block';
          }
        });

        toggleBtn.addEventListener('click', () => {
          if (contentDiv.style.display === 'none') {
            contentDiv.style.display = 'block';
            toggleBtn.innerHTML = '&#9650;';
          } else {
            contentDiv.style.display = 'none';
            toggleBtn.innerHTML = '&#9660;';
          }
        });

        formatInput.addEventListener('input', () => {
          cameraSettings[stream.id].format = formatInput.value;
        });
        locationInput.addEventListener('input', () => {
          cameraSettings[stream.id].location = locationInput.value;
        });
        segmentInput.addEventListener('input', () => {
          cameraSettings[stream.id].segmentation = parseFloat(segmentInput.value);
        });
      }, 0);

      pausedPreviews[stream.id] = false;
      const ip = getCameraIPFromUri(stream.uri);
      if (ip) {
        const intervalId = setInterval(() => {
          updateLivePreview(stream.id, ip);
        }, 1000);
        previewIntervals[stream.id] = intervalId;
      } else {
        const previewDiv = document.getElementById(`preview-${stream.id}`);
        if (previewDiv) {
          previewDiv.innerHTML = 'Camera Unavailable (Invalid URI)';
        }
      }
    });
  }

  // Toggle pause/resume for live preview
  function togglePreview(streamId) {
    if (pausedPreviews[streamId]) {
      pausedPreviews[streamId] = false;
      const stream = streams.find(s => s.id === streamId);
      if (!stream) return;
      const ip = getCameraIPFromUri(stream.uri);
      const intervalId = setInterval(() => {
        updateLivePreview(streamId, ip);
      }, 1000);
      previewIntervals[streamId] = intervalId;
      const previewDiv = document.getElementById(`preview-${streamId}`);
      if (previewDiv) {
        previewDiv.innerHTML = '<img style="max-width:300px;max-height:200px;" />';
      }
    } else {
      pausedPreviews[streamId] = true;
      if (previewIntervals[streamId]) {
        clearInterval(previewIntervals[streamId]);
        delete previewIntervals[streamId];
      }
      const previewDiv = document.getElementById(`preview-${streamId}`);
      if (previewDiv) {
        previewDiv.innerHTML = 'PAUSED (click to resume)';
        previewDiv.style.textAlign = 'center';
        previewDiv.style.lineHeight = '240px';
      }
    }
  }

  function removeStream(streamId) {
    streams = streams.filter(s => s.id !== streamId);
    loadStreams();
  }

  function editCamera(streamId) {
    const existing = streams.find(s => s.id === streamId);
    if (!existing) return;
    if (!cameraIdField || !cameraNameField || !cameraUriField || !cameraFormBtn) return;
    cameraIdField.value = existing.id;
    cameraNameField.value = existing.name;
    cameraUriField.value = existing.uri;
    cameraFormBtn.textContent = 'Save Camera';
  }

  /********* STATISTICS LOGIC *********/
  // Start stats updates only when the stats panel is visible.
  function startStats(streamId) {
    const statsContainer = document.getElementById(`stats-content-${streamId}`);
    if (!statsContainer) return;
    // Render placeholder values immediately
    renderStatsPlaceholder(streamId);
    const stream = streams.find(s => s.id === streamId);
    if (!stream) return;
    // Start periodic stats updates
    const intervalId = setInterval(async () => {
      // Only fetch stats if the stats container is visible
      if (window.getComputedStyle(statsContainer).display !== 'block') return;
      try {
        const stats = await rtspManager.getStats(stream.uri);
        if (stats) {
          renderStats(streamId, stats);
        }
      } catch (error) {
        console.error(`Error fetching stats for stream ${streamId}:`, error);
        statsContainer.innerHTML = `<div class="stat-error">Error fetching stats</div>`;
      }
    }, 2000);
    statsIntervals[streamId] = intervalId;
  }

  function stopStats(streamId) {
    if (statsIntervals[streamId]) {
      clearInterval(statsIntervals[streamId]);
      delete statsIntervals[streamId];
    }
  }

  // Toggle the stats panel display. When opening, show the placeholders and start stats updates.
  function toggleStats(streamId) {
    const statsContainer = document.getElementById(`stats-content-${streamId}`);
    if (!statsContainer) return;
    // Check current display state of the stats container.
    if (window.getComputedStyle(statsContainer).display === 'block') {
      // Hide the stats panel and stop stats updates.
      statsContainer.style.display = 'none';
      stopStats(streamId);
    } else {
      // Show the stats panel (set display to block) and start stats updates.
      statsContainer.style.display = 'block';
      startStats(streamId);
    }
  }

  return {
    init,
    loadStreams,
    togglePreview,
    toggleStats,
    removeStream,
    editCamera,
    getStreams,
    getCameraSettings
  };
})();
