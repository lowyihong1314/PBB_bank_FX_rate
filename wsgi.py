# wsgi.py
from bank_rate import create_app, init_db, fetch_and_store_loop
import threading

app = create_app()

if __name__ == "__main__":
    # 仅在 python wsgi.py 时执行（开发调试）
    init_db()

    threading.Thread(
        target=fetch_and_store_loop,
        daemon=True
    ).start()

    app.run(host="0.0.0.0", port=5055, debug=True)
