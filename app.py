from flask import Flask, render_template, request, jsonify
from recording import rtsp_manager, rtsp_stats
import json
from datetime import datetime

app = Flask(__name__)

# In-memory store for scheduled recordings
# A scheduled recording will have: camera_ids (list), start_time, end_time, and type (manual/event)
scheduled_recordings = []

# Example camera list (this should be dynamically populated based on your camera management system)
streams = [
    {'id': 1, 'name': 'Camera 1', 'uri': 'rtsp://192.168.12.111:554/1'},
    {'id': 2, 'name': 'Camera 2', 'uri': 'rtsp://192.168.12.243:554/1'},
    {'id': 3, 'name': 'Camera 3', 'uri': 'rtsp://192.168.12.220:554/1'}
]

# Example event list (this should be dynamically populated from your events management system)
events = [
    {'id': 1, 'name': 'Event 1', 'start': '2025-04-01T10:00:00', 'end': '2025-04-01T12:00:00'},
    {'id': 2, 'name': 'Event 2', 'start': '2025-04-02T14:00:00', 'end': '2025-04-02T16:00:00'}
]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/streams', methods=['GET'])
def get_streams():
    return jsonify(streams)

@app.route('/api/events', methods=['GET'])
def get_events():
    return jsonify(events)

@app.route('/api/start_recording', methods=['POST'])
def start_recording_route():
    data = request.get_json()
    stream_ids = data.get('streamIds')
    start_time = data.get('startTime')
    end_time = data.get('endTime')

    if not stream_ids or not start_time or not end_time:
        return jsonify({'error': 'Missing data'}), 400

    # Treat all selected cameras as one group for manual scheduling
    schedule_id = f"{start_time}-{end_time}-{','.join(map(str, stream_ids))}"

    # Start recording for each selected camera
    for stream_id in stream_ids:
        stream = next((s for s in streams if s['id'] == stream_id), None)
        if stream:
            # Start recording for the selected camera
            rtsp_manager.start_recording(stream_id, stream['uri'])

            # Add the scheduled recording to the list (treat cameras as one entity for manual scheduling)
            scheduled_recordings.append({
                'schedule_id': schedule_id,
                'camera_ids': stream_ids,  # Store all cameras for this schedule
                'start_time': start_time,
                'end_time': end_time,
                'type': 'manual'
            })

    return jsonify({'message': 'Recording(s) scheduled successfully'})

@app.route('/api/schedule_event', methods=['POST'])
def schedule_event_route():
    data = request.get_json()
    event_id = data.get('eventId')
    camera_ids = data.get('cameraIds')

    if not event_id or not camera_ids:
        return jsonify({'error': 'Missing data'}), 400

    event = next((e for e in events if e['id'] == event_id), None)
    if not event:
        return jsonify({'error': 'Event not found'}), 404

    schedule_id = f"event-{event_id}"

    # Schedule recording based on the event's start and end times
    scheduled_recordings.append({
        'schedule_id': schedule_id,
        'camera_ids': camera_ids,
        'start_time': event['start'],
        'end_time': event['end'],
        'type': 'event'
    })

    # Start recording for each selected camera
    for camera_id in camera_ids:
        camera = next((s for s in streams if s['id'] == camera_id), None)
        if camera:
            rtsp_manager.start_recording(camera_id, camera['uri'])

    return jsonify({'message': 'Event recording(s) scheduled successfully'})

@app.route('/api/scheduled_recordings', methods=['GET'])
def list_scheduled_recordings():
    # Return a list of all scheduled recordings (manual and event)
    return jsonify(scheduled_recordings)

@app.route('/api/delete_recording', methods=['POST'])
def delete_recording():
    data = request.get_json()
    schedule_id = data.get('scheduleId')

    # Find and remove the recording by schedule ID
    global scheduled_recordings
    scheduled_recordings = [rec for rec in scheduled_recordings if rec['schedule_id'] != schedule_id]

    return jsonify({'message': f'Recording with Schedule ID {schedule_id} deleted successfully'})

@app.route('/api/edit_recording', methods=['POST'])
def edit_recording():
    data = request.get_json()
    schedule_id = data.get('scheduleId')
    new_start_time = data.get('newStartTime')
    new_end_time = data.get('newEndTime')
    new_camera_ids = data.get('newCameraIds')

    if not schedule_id or not new_start_time or not new_end_time or not new_camera_ids:
        return jsonify({'error': 'Missing data'}), 400

    # Find and update the scheduled recording
    recording = next((rec for rec in scheduled_recordings if rec['schedule_id'] == schedule_id), None)
    if not recording:
        return jsonify({'error': 'Scheduled recording not found'}), 404

    recording['start_time'] = new_start_time
    recording['end_time'] = new_end_time
    recording['camera_ids'] = new_camera_ids  # Update camera IDs

    # You can also update the recordings in the RTSP manager if needed
    for camera_id in new_camera_ids:
        camera = next((s for s in streams if s['id'] == camera_id), None)
        if camera:
            rtsp_manager.start_recording(camera_id, camera['uri'])

    return jsonify({'message': 'Scheduled recording updated successfully'})

@app.route('/api/rtspStats', methods=['GET'])
def get_rtsp_stats():
    uri = request.args.get('uri')
    
    if not uri:
        return jsonify({'error': 'Missing URI parameter'}), 400
    
    # Call the rtsp_stats module's function to gather stats
    try:
        stats = rtsp_stats.run_monitoring_cycle(rtsp_url=uri)  # Assuming this function returns stats as a dictionary
        # Return stats as JSON to the frontend
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
