import os
import pymysql

_DB_FIXED = False

def get_connection():
    global _DB_FIXED
    conn = pymysql.connect(
        host=os.getenv("MYSQLHOST", "localhost"),
        port=int(os.getenv("MYSQLPORT", 3306)),
        user=os.getenv("MYSQLUSER", "root"),
        password=os.getenv("MYSQLPASSWORD", ""),
        database=os.getenv("MYSQLDATABASE", "reco"),
        cursorclass=pymysql.cursors.DictCursor,
        ssl_disabled=True,
    )
    
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
                
                # Fix sales table
                cur.execute("SHOW COLUMNS FROM sales LIKE 'barcode'")
                if not cur.fetchone():
                    cur.execute("ALTER TABLE sales ADD COLUMN barcode VARCHAR(50) AFTER category")
                
                conn.commit()
                _DB_FIXED = True
        except Exception as e:
            print(f"Auto-fix error: {e}")
    
    return conn