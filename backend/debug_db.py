import os
import pymysql
from dotenv import load_dotenv

# Load .env from backend directory
load_dotenv(dotenv_path='backend/.env')

conn = pymysql.connect(
    host=os.getenv("DB_HOST", "localhost"),
    user=os.getenv("DB_USER", "root"),
    password=os.getenv("DB_PASS"),
    database=os.getenv("DB_NAME", "reco"),
    cursorclass=pymysql.cursors.DictCursor
)

cur = conn.cursor()

try:
    print("--- Transaction Stats ---")
    cur.execute("SELECT COUNT(*) as count FROM transactions")
    print(f"Total Transactions: {cur.fetchone()['count']}")
    
    cur.execute("SELECT COUNT(*) as count FROM transactions WHERE status = 'completed'")
    print(f"Completed Transactions: {cur.fetchone()['count']}")
    
    print("\n--- Daily Sales Summary ---")
    cur.execute("""
        SELECT DATE(created_at) as date, SUM(total) as daily_total, COUNT(*) as txn_count
        FROM transactions
        WHERE status = 'completed'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
    """)
    rows = cur.fetchall()
    for row in rows:
        print(f"Date: {row['date']}, Total: {row['daily_total']}, Txns: {row['txn_count']}")

    print("\n--- Recent Transactions ---")
    cur.execute("SELECT id, total, status, created_at FROM transactions ORDER BY created_at DESC LIMIT 5")
    for row in cur.fetchall():
        print(row)

finally:
    cur.close()
    conn.close()
