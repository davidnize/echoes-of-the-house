# Echoes of the House

## Setup
1. Pull the model once:  `ollama pull gemma3:4b`
2. Put `open.mp3` and `reply.mp3` in `client/public/sounds/`
3. Server:  `cd server && cp .env.example .env && npm install && npm run dev`
4. Client:  `cd client && npm install && npm run dev`
5. Make sure Ollama is running (`ollama serve`, or the Ollama app).

Server runs on :3001, client on :5173 (proxies /api to the server).
Requires Node 18.19+ (the server uses `node --import` for Sentry).
