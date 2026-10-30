import io
import wave
from flask import Flask, request, Response
from piper import PiperVoice, SynthesisConfig

app = Flask(__name__)
voice = PiperVoice.load("en_GB-alan-medium.onnx")
cfg = SynthesisConfig(length_scale=1.2)

@app.post("/speak")
def speak():
    text = (request.get_json(silent=True) or {}).get("text", "").strip()
    if not text:
        return Response("no text", status=400)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        voice.synthesize_wav(text, wav, syn_config=cfg)
    return Response(buf.getvalue(), mimetype="audio/wav")

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8100)
