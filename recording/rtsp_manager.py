# recording/rtsp_manager.py

import subprocess
import os

# Keep track of active FFmpeg processes by stream_id
active_recordings = {}  # { stream_id: subprocess.Popen }

def start_recording(stream_id: int, rtsp_uri: str):
    """
    Start recording for the given RTSP URI using FFmpeg (or other tool).
    Returns True if recording started, False otherwise.
    """
    if stream_id in active_recordings:
        print(f"Stream {stream_id} is already recording.")
        return False
    
    # Example: Save to "record_stream_<id>.mp4"
    output_file = f"record_stream_{stream_id}.mp4"
    
    # Example FFmpeg command: copy video and audio
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
    Stop recording for the given stream if it's active.
    Returns True if successfully stopped, False otherwise.
    """
    process = active_recordings.get(stream_id)
    if not process:
        print(f"No active recording found for stream {stream_id}")
        return False
    
    try:
        # Terminate the FFmpeg process
        process.terminate()
        process.wait(timeout=5)
        del active_recordings[stream_id]
        print(f"Stopped recording for stream {stream_id}")
        return True
    except Exception as e:
        print(f"Failed to stop recording stream {stream_id}: {e}")
        return False

def list_active_recordings():
    """
    Return a list of currently active recording stream IDs.
    """
    return list(active_recordings.keys())
