from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import whisper
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


# Load the Whisper model (this will download it the first time)
model = whisper.load_model("small", in_memory=True)

@app.route("/")
def index():
    return render_template('index.html')

@app.route("/transcribe", methods=["POST", "OPTIONS"])
def transcribe_audio():
    # Handle preflight requests
    if request.method == "OPTIONS":
        return "", 200
        
    try:
        # Check if file was uploaded
        if "audio" not in request.files:
            return jsonify({"error": "No audio file provided"}), 400

        audio_file = request.files["audio"]

        # Check if file has a name and valid extension
        if audio_file.filename == "":
            return jsonify({"error": "No selected file"}), 400

        allowed_extensions = {"wav", "mp3", "m4a", "ogg"}
        if (
            not "." in audio_file.filename
            or audio_file.filename.rsplit(".", 1)[1].lower() not in allowed_extensions
        ):
            return (
                jsonify(
                    {
                        "error": "Invalid file format. Allowed formats: WAV, MP3, M4A, OGG"
                    }
                ),
                400,
            )

        with NamedTemporaryFile(suffix=".wav", delete=False) as temp_audio:
            audio_file.save(temp_audio.name)

            # Transcribe using local Whisper model with additional parameters
            result = model.transcribe(
                temp_audio.name,
                language="ru",  # Specify Russian language
                temperature=0.0,  # Reduce randomness in output
                best_of=2,  # Generate multiple samples and select the best
                fp16=False,  # Use FP32 for better accuracy on CPU
                initial_prompt="Это транскрипция аудио файла на русском языке.",  # Help guide the model
            )

        return jsonify(
            {
                "success": True,
                "text": result["text"],
                "segments": result["segments"],  # Include timestamped segments
                "language": result["language"],  # Include detected language
            }
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5001)
