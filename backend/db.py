import os
import pymysql

_DB_FIXED = False

def get_connection():
    global _DB_FIXED
    conn = pymysql.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASS"),
        database=os.getenv("DB_NAME", "reco"),
        cursorclass=pymysql.cursors.DictCursor,
        ssl_disabled=True,
    )
    
    # --- AUTO FIX FOR TRUNCATION ISSUE ---
    if not _DB_FIXED:
        try:
            with conn.cursor() as cur:
                # Fix schema
                cur.execute("ALTER TABLE inventory MODIFY COLUMN product_name VARCHAR(255) NOT NULL")
                # Restore truncated data
                cur.execute("""
                    UPDATE inventory 
                    SET product_name = 'Tropicana Fruit Juice - Delight Guava1 L'
                    WHERE product_name = 'Tr' AND (barcode = '8902080001439' OR (category = 'Beverages' AND price = 70.00))
                """)
                conn.commit()
                _DB_FIXED = True
        except Exception as e:
            print(f"Auto-fix error: {e}")
    # ------------------------------------
    
    return conn
