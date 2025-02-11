# recording/rtsp_manager.py

import subprocess
import json

# Dictionary to keep track of active FFmpeg processes by stream_id
active_recordings = {}  # { stream_id: subprocess.Popen }

def start_recording(stream_id: int, rtsp_uri: str):
    """
    Start recording for the given RTSP URI using FFmpeg.
    The output is saved to "record_stream_<stream_id>.mp4".
    Returns True if recording started, False otherwise.
    """
    if stream_id in active_recordings:
        print(f"Stream {stream_id} is already recording.")
        return False

    output_file = f"record_stream_{stream_id}.mp4"
    cmd = [
        "ffmpeg",
        "-i", rtsp_uri,
        "-c:v", "copy",
        "-c:a", "copy",
        output_file
    ]
    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        active_recordings[stream_id] = process
        print(f"Started recording stream {stream_id} -> {output_file}")
        return True
    except Exception as e:
        print(f"Failed to start recording for stream {stream_id}: {e}")
        return False

def stop_recording(stream_id: int):
    """
    Stop recording for the given stream if it is active.
    Returns True if successfully stopped, False otherwise.
    """
    process = active_recordings.get(stream_id)
    if not process:
        print(f"No active recording found for stream {stream_id}")
        return False
    try:
        process.terminate()
        process.wait(timeout=5)
        del active_recordings[stream_id]
        print(f"Stopped recording for stream {stream_id}")
        return True
    except Exception as e:
        print(f"Failed to stop recording for stream {stream_id}: {e}")
        return False

def list_active_recordings():
    """
    Return a list of stream IDs that are currently recording.
    """
    return list(active_recordings.keys())

