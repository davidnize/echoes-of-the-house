import os
os.environ["TABPFN_DISABLE_TELEMETRY"] = "1"

import json
import re
from datetime import date
from http.server import BaseHTTPRequestHandler, HTTPServer

import numpy as np
from tabpfn import TabPFNClassifier

KEYWORDS = ["flicker", "footstep", "door", "whisper", "cold", "voice", "shadow", "music"]


def parse_date(s):
    m = re.match(r"(\d{4})-(\d{1,2})-(\d{1,2})", s or "")
    if not m:
        return None
    try:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def near_veil(d):
    # Oct 31 to Nov 2: the nights the veil is thin
    return (d.month == 10 and d.day == 31) or (d.month == 11 and d.day <= 2)


def features(events):
    hits, veil, rooms, years = 0, 0, set(), []
    for e in events:
        text = (str(e.get("event", "")) + " " + str(e.get("notes", ""))).lower()
        if any(k in text for k in KEYWORDS):
            hits += 1
        if e.get("room"):
            rooms.add(str(e["room"]).strip().lower())
        d = parse_date(e.get("date"))
        if d:
            years.append(d.year)
            if near_veil(d):
                veil += 1
    spread = (max(years) - min(years)) if years else 0
    return [len(events), len(rooms), hits, veil, spread]


def training_table(n=80):
    # A small made-up table of houses: [traces, rooms, strange traces, veil-night traces, years spanned]
    # A house counts as active if a strange trace fell on a veil night, or it has 3 or more of either.
    rng = np.random.default_rng(7)
    X, y = [], []
    for _ in range(n):
        total = int(rng.integers(1, 9))
        rooms = int(rng.integers(1, min(total, 5) + 1))
        hits = int(rng.binomial(total, 0.4))
        veil = int(rng.binomial(total, 0.3))
        spread = int(rng.integers(0, 40)) if total > 1 else 0
        active = (hits >= 1 and veil >= 1) or hits >= 3 or veil >= 3
        if rng.random() < 0.08:
            active = not active
        X.append([total, rooms, hits, veil, spread])
        y.append(int(active))
    return np.array(X, dtype=float), np.array(y)


def build_model():
    X, y = training_table()
    clf = TabPFNClassifier(device="cpu")
    clf.fit(X, y)
    return clf


MODEL = None


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._send(200, {"ok": True})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/predict":
            return self._send(404, {"error": "not found"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            events = json.loads(self.rfile.read(length) or b"{}").get("events", [])
            f = features(events)
            proba = MODEL.predict_proba(np.array([f], dtype=float))[0]
            idx = list(MODEL.classes_).index(1)
            self._send(200, {"probability": float(proba[idx]), "features": f})
        except Exception as err:
            self._send(500, {"error": str(err)})

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print("Loading TabPFN...")
    MODEL = build_model()
    print("TabPFN ready on http://127.0.0.1:8000")
    HTTPServer(("127.0.0.1", 8000), Handler).serve_forever()
