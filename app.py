# app.py

from flask import Flask, render_template, request, jsonify
from recording import rtsp_manager

app = Flask(__name__)

# Simulated streams for demonstration (in real code, store or load from DB)
streams = [
    {'id': 1, 'name': 'Camera 1', 'uri': 'rtsp://192.168.101.88:554/1'},
    {'id': 2, 'name': 'Camera 2', 'uri': 'rtsp://192.168.101.231:554/1'},
    {'id': 3, 'name': 'Camera 3', 'uri': 'rtsp://192.168.101.240:554/1'}
]

# Simulated recorded videos (for demonstration purposes)
recorded_videos = []

@app.route('/')
def index():
    return render_template('index.html')

# Example route: list all streams
@app.route('/api/streams', methods=['GET'])
def get_streams():
    return jsonify(streams)

# Start recording route
@app.route('/api/start_recording', methods=['POST'])
def start_recording():
    data = request.get_json()
    stream_id = data.get('streamId')
    
    # Find RTSP URI from your 'streams' list
    stream = next((s for s in streams if s['id'] == stream_id), None)
    if not stream:
        return jsonify({'error': 'Stream not found'}), 404
    
    success = rtsp_manager.start_recording(stream_id, stream['uri'])
    if success:
        return jsonify({'message': f'Started recording for Stream {stream_id}'})
    else:
        return jsonify({'error': f'Failed to start recording for Stream {stream_id}'}), 400

# Stop recording route
@app.route('/api/stop_recording', methods=['POST'])
def stop_recording():
    data = request.get_json()
    stream_id = data.get('streamId')
    
    success = rtsp_manager.stop_recording(stream_id)
    if success:
        return jsonify({'message': f'Stopped recording for Stream {stream_id}'})
    else:
        return jsonify({'error': f'Failed to stop recording for Stream {stream_id}'}), 400

# List active recordings
@app.route('/api/list_active_recordings', methods=['GET'])
def list_active_recordings():
    active = rtsp_manager.list_active_recordings()
    return jsonify({'active': active})

# Simulated route to get recorded videos
@app.route('/api/recorded_videos', methods=['GET'])
def get_recorded_videos():
    return jsonify(recorded_videos)

# Simulated route to delete a recording
@app.route('/api/delete_recording/<int:stream_id>', methods=['DELETE'])
def delete_recording(stream_id):
    global recorded_videos
    recorded_videos = [v for v in recorded_videos if f'Stream {stream_id}' not in v]
    return jsonify({'message': f'Deleted recording for Stream {stream_id}'})

if __name__ == '__main__':
    app.run(debug=True)
