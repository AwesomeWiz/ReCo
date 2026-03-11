from db import get_connection
import datetime

conn = get_connection()
cur = conn.cursor()

try:
    cur.execute("""
        SELECT DATE(created_at) as date, SUM(total) as daily_total
        FROM transactions
        WHERE status = 'completed'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
    """)
    rows = cur.fetchall()
    print("Daily Sales Summary:")
    for row in rows:
        print(f"Date: {row['date']}, Total: {row['daily_total']}")
    
    cur.execute("SELECT COUNT(*) as count FROM transactions")
    print(f"\nTotal Transactions: {cur.fetchone()['count']}")
    
    cur.execute("SELECT COUNT(*) as count FROM transactions WHERE status = 'completed'")
    print(f"Completed Transactions: {cur.fetchone()['count']}")

finally:
    cur.close()
    conn.close()
