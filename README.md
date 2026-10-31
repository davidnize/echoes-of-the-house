# 🕯️ Echoes of the House

**A ghost you can talk to, one that remembers.**

Light a candle, leave a few traces of what happened in a house (a door that opened on its own, footsteps in the hallway), and ask the house a question. A local AI model reads the traces, decides how restless the house is, and answers you in the voice of the one who still lingers there. Every encounter is remembered, so the ghost knows you when you come back.

Built for the DEV "Ghost in the Machine" Hacktoberfest challenge.

## 🔮 How it works

1. **You leave traces:** dated events in rooms of the house.
2. **TabPFN reads them** and predicts how restless the house is.
3. **Gemma 3 answers** as the ghost, shaped by that restlessness, your question, and its past memories of you.
4. **Piper speaks** the reply aloud, and **Backboard remembers** the encounter for next time.

## ✨ Features

- **Two modes.** *Remembrance* lets you speak with someone you've lost. *Haunting* lets you question the house itself.
- **Traces.** Add dated events by room, or use the sample traces, and TabPFN predicts how active the house is.
- **A ghost that answers.** Gemma 3 (4B) runs locally through Ollama and streams its reply word by word. You can add a photo for it to look at.
- **Memory.** Each encounter is saved to Backboard, and the last few are fed back to the ghost. "Let the house forget" wipes them.
- **Voice and atmosphere.** Ambient sound, a laugh when you enter, and a spoken reply ("Hear it") through a local Piper voice.
- **Keep it.** Save any encounter as a PNG.
- **Tracing.** Sentry spans follow each encounter: reading the traces, fetching memory, the ghost speaking, and saving memory.

## 🧱 How it's built

| Part | Tech | Port |
|---|---|---|
| Client | React + Vite | 5173 |
| Server | Node.js + Express | 3001 |
| The ghost's mind | Gemma 3 4B on Ollama | 11434 |
| Reading the traces | TabPFN (Python) | 8000 |
| The ghost's voice | Piper TTS, `en_GB-alan-medium` (Python + Flask) | 8100 |
| Memory | Backboard API | n/a |
| Monitoring | Sentry | n/a |

## 🚀 Run it locally

You need Node 18.19+, Python 3.9+ and [Ollama](https://ollama.com).

**1. The model**
```bash
ollama pull gemma3:4b
ollama serve
```

**2. TabPFN service**
```bash
cd tabpfn-service
python3 -m venv .venv && source .venv/bin/activate
pip install tabpfn "numpy==1.26.4"
python service.py
```

**3. Voice service (optional)**
```bash
cd voice-service
python3 -m venv .venv && source .venv/bin/activate
pip install piper-tts flask
python -m piper.download_voices en_GB-alan-medium
python voice.py
```

**4. Server.** Create `server/.env` (this file is never committed):
```
PORT=3001
OLLAMA_URL=http://localhost:11434
GEMMA_MODEL=gemma3:4b
BACKBOARD_API_KEY=your_backboard_key
BACKBOARD_ASSISTANT_ID=your_assistant_id
SENTRY_DSN=your_sentry_dsn
```
Then:
```bash
cd server && npm install && npm run dev
```

**5. Client**
```bash
cd client && npm install && npm run dev
```

Open http://localhost:5173 and light the candle.

If Backboard isn't set up, memory falls back to a local file in `server/data/memory.json`.

## 🛠️ Troubleshooting

- **The ghost doesn't answer:** make sure `ollama serve` is running and you've pulled `gemma3:4b`.
- **No voice:** the voice service is optional. Start it on port 8100 to enable "Hear it".
- **Traces aren't scored:** check that the TabPFN service is running on port 8000.
- **Memory resets:** without Backboard keys, memory is stored in `server/data/memory.json`.

## 🌐 The live version

The deployed site on Render serves the house and its memory. Gemma, TabPFN and Piper run on a local machine, so the full encounter with the ghost speaking is shown in the demo video.

## 💭 Why I built this

I didn't make this project for anyone in particular. Here in Zambia we don't celebrate Halloween or the other holidays, so I'm excited to build this for the people out there who do.

## 🙏 Credits

- TabPFN by Prior Labs. The training table of houses is made-up example data.
- Gemma 3 by Google, run with Ollama.
- Piper TTS voice `en_GB-alan-medium`.
- Memory by Backboard. Monitoring by Sentry.
- The entrance laugh is Kira's laugh from *Death Note*. All rights belong to its owners, and it's used here only for fun.

Made by [David Nizeyimana](https://www.linkedin.com/in/david-nizeyimana) in Lusaka, Zambia.
