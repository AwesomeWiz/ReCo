import os
import pymysql
from dotenv import load_dotenv

load_dotenv(dotenv_path='backend/.env')

try:
    conn = pymysql.connect(
        host='127.0.0.1',
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASS"),
        database=os.getenv("DB_NAME", "reco"),
        cursorclass=pymysql.cursors.DictCursor
    )
    print("Connection successful with 127.0.0.1")
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) as count FROM transactions")
    print(f"Total Transactions: {cur.fetchone()['count']}")
    conn.close()
except Exception as e:
    print(f"Connection failed: {e}")
