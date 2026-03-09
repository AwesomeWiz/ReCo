import os
import pymysql
from dotenv import load_dotenv

# Set the path to the .env file
env_path = r"c:\Users\Asus\Desktop\Reco\recoappv2\ReCo\backend\.env"
load_dotenv(dotenv_path=env_path)

CONFIGS = [
    {"host": "localhost", "user": "root", "password": os.getenv("DB_PASS"), "database": "reco"},
    {"host": "localhost", "user": "root", "password": "", "database": "reco"},
    {"host": "127.0.0.1", "user": "root", "password": os.getenv("DB_PASS"), "database": "reco"},
    {"host": "127.0.0.1", "user": "root", "password": "", "database": "reco"},
]

def try_fix():
    for config in CONFIGS:
        try:
            print(f"Trying config: {config['host']}@{config['user']} (pass: {'YES' if config['password'] else 'NO'})")
            conn = pymysql.connect(
                host=config["host"],
                user=config["user"],
                password=config["password"] if config["password"] else None,
                database=config["database"],
                cursorclass=pymysql.cursors.DictCursor
            )
            cur = conn.cursor()
            print("Connected! Fixing schema...")
            cur.execute("ALTER TABLE inventory MODIFY product_name VARCHAR(255) NOT NULL")
            cur.execute("""
                UPDATE inventory 
                SET product_name = 'Tropicana Fruit Juice - Delight Guava1 L'
                WHERE product_name = 'Tr' AND (barcode = '8902080001439' OR (category = 'Beverages' AND price = 70.00))
            """)
            print(f"Fixed! Rows updated: {cur.rowcount}")
            conn.commit()
            cur.close()
            conn.close()
            return True
        except Exception as e:
            print(f"Failed: {e}")
    return False

if __name__ == "__main__":
    if not try_fix():
        print("COULD NOT FIX DB. Please check your MySQL service and credentials.")
