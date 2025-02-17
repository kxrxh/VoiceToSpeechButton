from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from faster_whisper import WhisperModel
from tempfile import NamedTemporaryFile

app = Flask(__name__)
# Configure CORS to allow requests from any origin
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Load the fast-whisper model
# Using "base" with device="cpu" and compute_type="int8" for optimized CPU performance.
model = WhisperModel("base", device="cpu", compute_type="int8")

@app.route("/")
def index():
    return render_template('index.html')

@app.route("/transcribe", methods=["POST", "OPTIONS"])
def transcribe_audio():
    # Handle preflight OPTIONS requests
    if request.method == "OPTIONS":
        return "", 200

    try:
        # Ensure an audio file was uploaded
        if "audio" not in request.files:
            return jsonify({"error": "No audio file provided"}), 400

        audio_file = request.files["audio"]

        if audio_file.filename == "":
            return jsonify({"error": "No selected file"}), 400

        allowed_extensions = {"wav", "mp3", "m4a", "ogg"}
        if (
            "." not in audio_file.filename
            or audio_file.filename.rsplit(".", 1)[1].lower() not in allowed_extensions
        ):
            return jsonify({
                "error": "Invalid file format. Allowed formats: WAV, MP3, M4A, OGG"
            }), 400

        with NamedTemporaryFile(suffix=".wav", delete=False) as temp_audio:
            audio_file.save(temp_audio.name)

            # Transcribe using fast-whisper.
            # beam_size can be adjusted for a speed/accuracy trade-off.
            segments, info = model.transcribe(
                temp_audio.name,
                language="ru",
                beam_size=2  # Adjust beam_size as needed (1 for greedy search, higher for better accuracy)
            )

            # Combine segment texts into full transcript text and prepare segment details.
            transcript_text = " ".join([segment.text for segment in segments])
            segments_data = [
                {"start": round(segment.start, 2), "end": round(segment.end, 2), "text": segment.text}
                for segment in segments
            ]

        return jsonify({
            "success": True,
            "text": transcript_text,
            "segments": segments_data,
            "language": info.language
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5001)
