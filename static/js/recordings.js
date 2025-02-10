// recordings.js

window.recording = (function() {

    // The public methods
    function startRecording(streamId) {
      fetch('/api/start_recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamId })
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) alert(`Error: ${data.error}`);
        else alert(data.message || 'Recording started');
      })
      .catch(err => console.error(err));
    }
  
    function stopRecording(streamId) {
      fetch('/api/stop_recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamId })
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) alert(`Error: ${data.error}`);
        else alert(data.message || 'Recording stopped');
      })
      .catch(err => console.error(err));
    }
  
    // Return an object for public usage
    return {
      startRecording,
      stopRecording
    };
  
  })();
  