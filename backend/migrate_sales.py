import os
import pymysql
from dotenv import load_dotenv

env_path = r"c:\Users\Asus\Desktop\Reco\recoappv2\ReCo\backend\.env"
load_dotenv(dotenv_path=env_path)

def get_connection():
    return pymysql.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASS"),
        database=os.getenv("DB_NAME", "reco"),
        cursorclass=pymysql.cursors.DictCursor
    )

def migrate():
    conn = get_connection()
    cur = conn.cursor()
    try:
        print("Checking if 'barcode' column exists in 'sales' table...")
        cur.execute("SHOW COLUMNS FROM sales LIKE 'barcode'")
        if not cur.fetchone():
            print("Adding 'barcode' column to 'sales' table...")
            cur.execute("ALTER TABLE sales ADD COLUMN barcode VARCHAR(50) AFTER category")
            print("Cleanup: successfully added barcode column.")
        else:
            print("'barcode' column already exists.")
        
        conn.commit()
    except Exception as e:
        print(f"Migration error: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    migrate()
