python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
gunicorn -w 1 -b 0.0.0.0:5003 wsgi:app

sudo systemctl daemon-reload
sudo systemctl restart bank_rate
sudo systemctl enable bank_rate

sudo systemctl status bank_rate
sudo journalctl -u bank_rate -f
