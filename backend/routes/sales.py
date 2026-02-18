from flask import Blueprint, request, jsonify
from db import get_connection
from utils.jwt_auth import token_required
import datetime

sales_bp = Blueprint("sales", __name__)

# ─────────────────────────────────────────────
# START TRANSACTION
# ─────────────────────────────────────────────
@sales_bp.route("/transactions/start", methods=["POST"])
@token_required
def start_transaction(user_id):
    conn = get_connection()
    cur = conn.cursor()

    try:
        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        transaction_code = f"TXN{timestamp}"

        cur.execute("""
            INSERT INTO transactions (shop_id, transaction_code, total)
            VALUES (%s, %s, 0)
        """, (user_id, transaction_code))

        transaction_id = cur.lastrowid
        conn.commit()

        return jsonify({
            "transaction_id": transaction_id,
            "transaction_code": transaction_code
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# ADD ITEM TO EXISTING TRANSACTION
# ─────────────────────────────────────────────
@sales_bp.route("/transactions/add-item", methods=["POST"])
@token_required
def add_item_to_transaction(user_id):
    data = request.json

    transaction_id = data["transaction_id"]
    product_name = data["product_name"]
    category = data.get("category", "")
    price = data["price"]
    quantity = data["quantity"]
    total = data["total"]

    conn = get_connection()
    cur = conn.cursor()

    try:
        # 🔎 1️⃣ Check inventory stock first
        cur.execute("""
            SELECT stock FROM inventory
            WHERE shop_id = %s AND product_name = %s
        """, (user_id, product_name))

        stock_row = cur.fetchone()

        if not stock_row:
            return jsonify({"error": "Product not found in inventory"}), 400

        if stock_row["stock"] < quantity:
            return jsonify({"error": "Insufficient stock"}), 400

        # 🧾 2️⃣ Insert into sales
        cur.execute("""
            INSERT INTO sales (
                shop_id,
                product_name,
                category,
                price,
                quantity,
                total,
                transaction_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            user_id,
            product_name,
            category,
            price,
            quantity,
            total,
            transaction_id
        ))

        # 📦 3️⃣ Reduce stock from inventory
        cur.execute("""
            UPDATE inventory
            SET stock = stock - %s
            WHERE shop_id = %s AND product_name = %s
        """, (quantity, user_id, product_name))

        # 💰 4️⃣ Update transaction total
        cur.execute("""
            UPDATE transactions
            SET total = total + %s
            WHERE id = %s AND shop_id = %s
        """, (total, transaction_id, user_id))

        conn.commit()

        return jsonify({"message": "Item added successfully"}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# COMPLETE TRANSACTION
# ─────────────────────────────────────────────
@sales_bp.route("/transactions/complete", methods=["POST"])
@token_required
def complete_transaction(user_id):
    data = request.json
    transaction_id = data["transaction_id"]

    # Optional: You can add validation logic here
    return jsonify({
        "message": "Transaction completed",
        "transaction_id": transaction_id
    }), 200


# ─────────────────────────────────────────────
# GET TRANSACTIONS BY DATE
# ─────────────────────────────────────────────
@sales_bp.route("/transactions/by-date", methods=["GET"])
@token_required
def get_transactions_by_date(user_id):
    selected_date = request.args.get("date")

    if not selected_date:
        return jsonify({"error": "Date required (YYYY-MM-DD)"}), 400

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT 
                id, 
                transaction_code, 
                total, 
                created_at
            FROM transactions
            WHERE shop_id = %s
            AND DATE(created_at) = %s
            ORDER BY created_at DESC
        """, (user_id, selected_date))

        transactions = cur.fetchall()

        result = []
        for row in transactions:
            # No conversion needed - already in IST
            dt = row["created_at"]
            formatted_time = dt.strftime("%d %b %Y • %I:%M %p")
            
            result.append({
                "id": row["id"],
                "transaction_code": row["transaction_code"],
                "total": row["total"],
                "formatted_time": formatted_time
            })

        return jsonify(result)

    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# GET SINGLE TRANSACTION DETAILS
# ─────────────────────────────────────────────
@sales_bp.route("/transactions/<int:transaction_id>", methods=["GET"])
@token_required
def get_transaction_details(user_id, transaction_id):

    conn = get_connection()
    cur = conn.cursor()

    try:
        # Get transaction info
        cur.execute("""
            SELECT transaction_code, total, created_at
            FROM transactions
            WHERE id = %s AND shop_id = %s
        """, (transaction_id, user_id))

        transaction = cur.fetchone()

        if not transaction:
            return jsonify({"error": "Transaction not found"}), 404

        # Get items
        cur.execute("""
            SELECT product_name, quantity, price, total
            FROM sales
            WHERE transaction_id = %s
        """, (transaction_id,))

        items = cur.fetchall()

        result = {
            "transaction_code": transaction["transaction_code"],
            "total": transaction["total"],
            "created_at": transaction["created_at"].isoformat(),
            "items": [
                {
                    "description": row["product_name"],
                    "qty": row["quantity"],
                    "rate": row["price"],
                    "amount": row["total"]
                }
                for row in items
            ]
        }

        return jsonify(result)

    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# LEGACY TODAY SALES (Optional)
# ─────────────────────────────────────────────
@sales_bp.route("/sales/today", methods=["GET"])
@token_required
def get_today_sales(user_id):
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT product_name, quantity, price, total
            FROM sales
            WHERE shop_id = %s
            AND DATE(created_at) = CURDATE()
            ORDER BY created_at DESC
        """, (user_id,))

        rows = cur.fetchall()

        result = [
            {
                "description": row["product_name"],
                "qty": row["quantity"],
                "rate": row["price"],
                "amount": row["total"]
            }
            for row in rows
        ]

        return jsonify(result)

    finally:
        cur.close()
        conn.close()

# ─────────────────────────────────────────────
# ANALYTICS
# ─────────────────────────────────────────────
@sales_bp.route("/analytics/daily", methods=["GET"])
@token_required
def get_daily_sales(user_id):
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT DATE(created_at) as date,
                   SUM(total) as total_sales
            FROM transactions
            WHERE shop_id = %s
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        """, (user_id,))

        rows = cur.fetchall()
        return jsonify(rows)

    finally:
        cur.close()
        conn.close()

