// camera.js

window.camera = (function() {

    /*********************************************
     * Module-scoped data
     *********************************************/
    let streams = [
      { id: 1, name: 'Camera 1', uri: 'rtsp://192.168.101.88:554/1' },
      { id: 2, name: 'Camera 2', uri: 'rtsp://192.168.101.231:554/1' }
    ];
    let cameraSettings = {};      // { streamId: { useGlobal, format, location, segmentation } }
    let previewIntervals = {};    // For storing setInterval() IDs
    let pausedPreviews = {};      // For tracking pause state: { [streamId]: boolean }
    let globalSettings = null;    // We'll store a reference set by app.js
  
    // DOM references for camera form:
    let addCameraForm, cameraIdField, cameraNameField, cameraUriField, cameraFormBtn;
  
    /*********************************************
     * Local utility functions
     *********************************************/
    function getCameraIPFromUri(uri) {
      try {
        const withoutProtocol = uri.replace('rtsp://', '');
        return withoutProtocol.split('/')[0].split(':')[0];
      } catch {
        return '';
      }
    }
  
    function updateLivePreview(streamId, ip) {
      // If paused, do nothing
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
          imgEl.src = '';
          imgEl.alt = 'Camera Unavailable';
        });
    }
  
    /*********************************************
     * Public methods (exposed via the returned object)
     *********************************************/
  
    // Called once from app.js to pass in global settings and initialize the camera form logic
    function init(gSettings) {
      globalSettings = gSettings;
  
      // Grab references
      addCameraForm   = document.getElementById('add-camera-form');
      cameraIdField   = document.getElementById('camera-id');
      cameraNameField = document.getElementById('camera-name');
      cameraUriField  = document.getElementById('camera-uri');
      cameraFormBtn   = document.getElementById('camera-form-btn');
  
      // Hook up the camera form's submit
      if (addCameraForm) {
        addCameraForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const hiddenId = cameraIdField.value.trim();
          const nameVal  = cameraNameField.value.trim();
          const uriVal   = cameraUriField.value.trim();
          if (!nameVal || !uriVal) return;
  
          if (hiddenId) {
            // EDIT mode
            const camId = parseInt(hiddenId, 10);
            const existing = streams.find(s => s.id === camId);
            if (existing) {
              existing.name = nameVal;
              existing.uri  = uriVal;
            }
            cameraIdField.value = '';
            cameraFormBtn.textContent = 'Add Stream';
          } else {
            // ADD mode
            const newId = streams.length ? Math.max(...streams.map(s => s.id)) + 1 : 1;
            streams.push({
              id: newId,
              name: nameVal,
              uri: uriVal
            });
          }
  
          // Clear form fields
          cameraNameField.value = '';
          cameraUriField.value  = '';
  
          loadStreams();
        });
      }
    }
  
    // Return the main array so scheduling or other modules can read them
    function getStreams() {
      return streams;
    }
  
    // For scheduling code that references cameraSettings
    function getCameraSettings() {
      return cameraSettings;
    }
  
    // The main function to build camera UI
    function loadStreams() {
      const streamList             = document.getElementById('camera-list');
      const recordingControlsEl    = document.getElementById('recording-controls');
      const streamSelect           = document.getElementById('select-stream');
      const scheduledRecordingsList= document.getElementById('scheduled-recordings-list');
      const cameraSettingsList     = document.getElementById('camera-settings-list');
  
      if (!streamList || !recordingControlsEl || !streamSelect || !scheduledRecordingsList || !cameraSettingsList) {
        console.error('One or more required elements not found for camera management.');
        return;
      }
  
      // Clear existing UI
      streamList.innerHTML = '';
      recordingControlsEl.innerHTML = '';
      streamSelect.innerHTML = '<option value="">Select Stream</option>';
      scheduledRecordingsList.innerHTML = '';
      cameraSettingsList.innerHTML = '';
  
      // Clear existing preview intervals
      Object.keys(previewIntervals).forEach(id => {
        clearInterval(previewIntervals[id]);
      });
  
      // Build UI for each camera
      streams.forEach(stream => {
        // 1) Camera list item
        const listItem = document.createElement('li');
        listItem.classList.add('stream-item');
  
        // Left (name/uri), center (preview), right (edit/remove)
        const leftCol = `
          <div class="camera-info">
            <span class="camera-title">${stream.name}</span>
            <span class="camera-uri">${stream.uri}</span>
          </div>
        `;
        const midCol = `
          <div class="camera-preview">
            <!-- Add "onclick" so we can togglePause when user clicks preview -->
            <div class="live-preview" id="preview-${stream.id}" onclick="camera.togglePreview(${stream.id})">
              Loading preview...
            </div>
          </div>
        `;
        const rightCol = `
          <div class="camera-actions">
            <button onclick="camera.editCamera(${stream.id})">Edit</button>
            <button onclick="camera.removeStream(${stream.id})">Remove</button>
          </div>
        `;
        listItem.innerHTML = leftCol + midCol + rightCol;
        streamList.appendChild(listItem);
  
        // 2) Recording Controls
        const controlLi = document.createElement('li');
        controlLi.classList.add('control-item');
        controlLi.innerHTML = `
          <span>${stream.name}</span>
          <button onclick="recording.startRecording(${stream.id})">Start</button>
          <button onclick="recording.stopRecording(${stream.id})">Stop</button>
        `;
        recordingControlsEl.appendChild(controlLi);
  
        // 3) Scheduling dropdown
        const opt = document.createElement('option');
        opt.value = stream.id;
        opt.textContent = stream.name;
        streamSelect.appendChild(opt);
  
        // 4) Camera Settings (accordion)
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
                <input type="checkbox" id="useGlobal-${stream.id}" ${
                  cameraSettings[stream.id].useGlobal ? 'checked' : ''
                }/>
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
  
        // Defer attaching event listeners
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
  
          // Expand/collapse
          toggleBtn.addEventListener('click', () => {
            if (contentDiv.style.display === 'none') {
              contentDiv.style.display = 'block';
              toggleBtn.innerHTML = '&#9650;';
            } else {
              contentDiv.style.display = 'none';
              toggleBtn.innerHTML = '&#9660;';
            }
          });
  
          // Real-time updates
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
  
        // Initialize pausedPreviews state
        pausedPreviews[stream.id] = false;
  
        // Start live preview interval if not paused
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
  
    // Toggle pause/resume for a given camera's preview
    function togglePreview(streamId) {
      // If currently paused, resume
      if (pausedPreviews[streamId]) {
        pausedPreviews[streamId] = false;
        const ip = getCameraIPFromUri(streams.find(s => s.id === streamId).uri);
        // Recreate the interval
        const intervalId = setInterval(() => {
          updateLivePreview(streamId, ip);
        }, 1000);
        previewIntervals[streamId] = intervalId;
  
        // Clear "PAUSED" message
        const previewDiv = document.getElementById(`preview-${streamId}`);
        if (previewDiv) {
          previewDiv.innerHTML = '<img style="max-width:300px;max-height:200px;" />';
        }
      } else {
        // Pause
        pausedPreviews[streamId] = true;
        // Clear the interval
        if (previewIntervals[streamId]) {
          clearInterval(previewIntervals[streamId]);
          delete previewIntervals[streamId];
        }
  
        // Show "PAUSED" message
        const previewDiv = document.getElementById(`preview-${streamId}`);
        if (previewDiv) {
          previewDiv.innerHTML = 'PAUSED (click to resume)';
          previewDiv.style.textAlign = 'center';
          previewDiv.style.lineHeight = '240px'; // if you want it centered in the box
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
  
    /*********************************************
     * Return public API
     *********************************************/
    return {
      init,
      loadStreams,
      togglePreview,
      removeStream,
      editCamera,
      getStreams,
      getCameraSettings
    };
  })();
  