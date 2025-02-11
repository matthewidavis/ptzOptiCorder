from flask import Flask, render_template, request, jsonify
from recording import rtsp_manager, rtsp_stats

app = Flask(__name__)

streams = [
    {'id': 1, 'name': 'Camera 1', 'uri': 'rtsp://192.168.12.111:554/1'},
    {'id': 2, 'name': 'Camera 2', 'uri': 'rtsp://192.168.12.243:554/1'},
    {'id': 3, 'name': 'Camera 3', 'uri': 'rtsp://192.168.12.220:554/1'}
]

recorded_videos = []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/streams', methods=['GET'])
def get_streams():
    return jsonify(streams)

@app.route('/api/start_recording', methods=['POST'])
def start_recording_route():
    data = request.get_json()
    stream_id = data.get('streamId')
    stream = next((s for s in streams if s['id'] == stream_id), None)
    if not stream:
        return jsonify({'error': 'Stream not found'}), 404
    success = rtsp_manager.start_recording(stream_id, stream['uri'])
    if success:
        return jsonify({'message': f'Started recording for Stream {stream_id}'})
    else:
        return jsonify({'error': f'Failed to start recording for Stream {stream_id}'}), 400

@app.route('/api/stop_recording', methods=['POST'])
def stop_recording_route():
    data = request.get_json()
    stream_id = data.get('streamId')
    success = rtsp_manager.stop_recording(stream_id)
    if success:
        return jsonify({'message': f'Stopped recording for Stream {stream_id}'})
    else:
        return jsonify({'error': f'Failed to stop recording for Stream {stream_id}'}), 400

@app.route('/api/list_active_recordings', methods=['GET'])
def list_active_recordings():
    active = rtsp_manager.list_active_recordings()
    return jsonify({'active': active})

@app.route('/api/recorded_videos', methods=['GET'])
def get_recorded_videos():
    return jsonify(recorded_videos)

@app.route('/api/delete_recording/<int:stream_id>', methods=['DELETE'])
def delete_recording(stream_id):
    global recorded_videos
    recorded_videos = [v for v in recorded_videos if f'Stream {stream_id}' not in v]
    return jsonify({'message': f'Deleted recording for Stream {stream_id}'})

# NEW: API endpoint for detailed RTSP statistics using rtsp_stats.py
@app.route('/api/rtspStats', methods=['GET'])
def get_rtsp_stats_endpoint():
    uri = request.args.get('uri')
    if not uri:
        return jsonify({'error': 'Missing URI parameter'}), 400
    try:
        # Call the rtsp_stats module's monitoring cycle for this URI.
        stats = rtsp_stats.run_monitoring_cycle(rtsp_url=uri)
        # Remove any keys not needed by the front end.
        stats.pop("FPS", None)
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)
