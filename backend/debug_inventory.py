import os
import pymysql
from dotenv import load_dotenv

# Set the path to the .env file
env_path = r"c:\Users\Asus\Desktop\Reco\recoappv2\ReCo\backend\.env"
load_dotenv(dotenv_path=env_path)

def get_connection():
    try:
        return pymysql.connect(
            host=os.getenv("DB_HOST", "localhost"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASS"),
            database=os.getenv("DB_NAME", "reco"),
            cursorclass=pymysql.cursors.DictCursor
        )
    except Exception as e:
        print(f"Error connecting to DB: {e}")
        return None

def check_item():
    conn = get_connection()
    if not conn:
        return
    cur = conn.cursor()
    try:
        # Check specifically for the barcode in the user's image
        barcode = "8902080001439"
        print(f"--- Checking for barcode: {barcode} ---")
        cur.execute("SELECT * FROM inventory WHERE barcode = %s", (barcode,))
        item = cur.fetchone()
        if item:
            print(f"ID: {item['id']}")
            print(f"Name: '{item['product_name']}'")
            print(f"Category: {item['category']}")
            print(f"Price: {item['price']}")
            print(f"Stock: {item['stock']}")
            print(f"Barcode: {item['barcode']}")
        else:
            print("Item not found.")
            
        print("\n--- SCHEMA of product_name column ---")
        cur.execute("SHOW COLUMNS FROM inventory LIKE 'product_name'")
        col = cur.fetchone()
        if col:
            print(f"Field: {col['Field']}, Type: {col['Type']}, Null: {col['Null']}, Key: {col['Key']}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    check_item()
