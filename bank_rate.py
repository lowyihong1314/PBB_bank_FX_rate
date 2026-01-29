# bank_rate.py
from flask import Flask, jsonify, send_from_directory
import os
import re
from flask_cors import CORS
from bs4 import BeautifulSoup
import urllib.request, gzip, zlib, json, sqlite3, threading, time
from datetime import datetime, timedelta

DB_PATH = "bank_rate.sql"
FETCH_URL = "https://pbebank.com/en/rates-charges/forex/"

def fetch(url: str) -> str:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) "
            "Gecko/20100101 Firefox/130.0"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()
        enc = resp.headers.get("Content-Encoding", "")
        if enc == "gzip":
            raw = gzip.decompress(raw)
        elif enc == "deflate":
            raw = zlib.decompress(raw, -zlib.MAX_WBITS)
        return raw.decode("utf-8", errors="replace")

def extract_table_to_json(html: str):
    soup = BeautifulSoup(html, "lxml")
    div = soup.find("div", class_="grid-items vgap48")
    if not div:
        raise ValueError("未找到目标 div")

    date_p = div.find("p")
    date_text_raw = date_p.get_text(strip=True).replace(
        "Foreign Exchange Rate as at ", ""
    )

    try:
        parsed_date = datetime.strptime(date_text_raw, "%d %B %Y %I:%M %p")
        date_iso = parsed_date.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        parsed_date = None
        date_iso = None

    table = div.find("table")
    rows = []
    for tr in table.find_all("tr")[1:]:
        td = [t.get_text(strip=True) for t in tr.find_all("td")]
        if not td:
            continue
        row = {
            "currency": td[0],
            "selling_tt_od": td[1] if len(td) > 1 else None,
            "buying_tt": td[2] if len(td) > 2 else None,
            "buying_od": td[3] if len(td) > 3 else None,
            "notes_selling": td[4] if len(td) > 4 else None,
            "notes_buying": td[5] if len(td) > 5 else None,
        }
        rows.append(row)

    for row in rows:
        match = re.match(r"(\d+)\s+(.*)", row["currency"])
        if match:
            unit = float(match.group(1))
            name = match.group(2).strip()
        else:
            unit = 1.0
            name = row["currency"].strip()
        for key in [
            "selling_tt_od",
            "buying_tt",
            "buying_od",
            "notes_selling",
            "notes_buying",
        ]:
            val = row.get(key)
            if val and val != "N/A":
                try:
                    row[key] = round(float(val) / unit, 6)
                except Exception:
                    row[key] = None
            else:
                row[key] = None
        row["currency"] = f"1 {name}"

    return {"date": date_iso, "rates": rows}

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS rates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATETIME NOT NULL,
            currency TEXT NOT NULL,
            selling_tt_od REAL,
            buying_tt REAL,
            buying_od REAL,
            notes_selling REAL,
            notes_buying REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(date, currency) ON CONFLICT IGNORE
        )
    """)
    conn.commit()
    conn.close()


def save_to_db(data: dict):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    date = data.get("date")
    for r in data.get("rates", []):
        cur.execute("""
            INSERT INTO rates (
                date, currency,
                selling_tt_od, buying_tt, buying_od,
                notes_selling, notes_buying
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            date,
            r["currency"],
            r["selling_tt_od"],
            r["buying_tt"],
            r["buying_od"],
            r["notes_selling"],
            r["notes_buying"],
        ))
    conn.commit()
    conn.close()


def fetch_and_store_loop():
    while True:
        try:
            print("[INFO] Fetching latest forex rates ...")
            html = fetch(FETCH_URL)
            data = extract_table_to_json(html)
            save_to_db(data)
            print(f"[OK] Updated rates for {data['date']}")
        except Exception as e:
            print(f"[ERROR] {e}")
        time.sleep(300)


def create_app():
    app = Flask(
        __name__,
        static_folder="static", 
        static_url_path="/static"
    )
    CORS(app, origins=["*"])

    init_db()

    threading.Thread(
        target=fetch_and_store_loop,
        daemon=True
    ).start()

    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

    @app.route("/", methods=["GET"])
    def index():
        return send_from_directory(
            os.path.join(BASE_DIR, "static"),
            "index.html"
        )

    @app.route("/get_new_rate", methods=["GET"])
    def get_new_rate():
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute(
                "SELECT * FROM rates ORDER BY created_at DESC LIMIT 50"
            )
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return jsonify(rows)
        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route("/get_rate_range", methods=["GET"])
    @app.route("/get_rate_range/<start>/<end>")
    def get_rate_range(start=None, end=None):
        try:
            if not end:
                end = datetime.now().strftime("%Y-%m-%d")

            if not start:
                start = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")

            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("""
                SELECT * FROM rates
                WHERE DATE(date) BETWEEN DATE(?) AND DATE(?)
                ORDER BY date ASC
            """, (start, end))

            rows = [dict(r) for r in cur.fetchall()]
            conn.close()

            grouped = {}
            for r in rows:
                currency = r["currency"]
                grouped.setdefault(currency, []).append(r)

            return jsonify({
                "start": start,
                "end": end,
                "data": grouped
            })

        except Exception as e:
            return jsonify({"error": str(e)}), 500

    return app