import os
import pymysql
from dotenv import load_dotenv

# Set the path to the .env file
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

def fix_all():
    conn = get_connection()
    cur = conn.cursor()
    try:
        print("1. Fixing inventory table schema...")
        # Expand product_name to 255 if it's truncated
        cur.execute("ALTER TABLE inventory MODIFY product_name VARCHAR(255) NOT NULL")
        print("   Schema updated.")

        print("2. Restoring truncated names from known patterns...")
        # Fix 'Tr' specifically if it matches Tropicana barcode or similar
        # Based on labelMapping.json: "8902080001439" is Tropicana? 
        # Actually in user image code is 8902080001439.
        # In labelMapping.json, Tropicana is index 58 (name: "Tropicana Fruit Juice - Delight Guava1 L")
        
        cur.execute("""
            UPDATE inventory 
            SET product_name = 'Tropicana Fruit Juice - Delight Guava1 L'
            WHERE product_name = 'Tr' AND barcode = '8902080001439'
        """)
        
        # Generic fix for any other 'Tr' that might be Tropicana
        cur.execute("""
            UPDATE inventory 
            SET product_name = 'Tropicana Fruit Juice - Delight Guava1 L'
            WHERE product_name = 'Tr' AND category = 'Beverages' AND price = 70.00
        """)
        
        print(f"   Rows restored: {cur.rowcount}")
        
        conn.commit()
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    fix_all()
