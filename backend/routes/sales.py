from flask import Blueprint, request, jsonify
from db import get_connection
from utils.jwt_auth import token_required
import datetime
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA

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
            INSERT INTO transactions (shop_id, transaction_code, total, status)
            VALUES (%s, %s, 0, 'active')
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
    print("Incoming add-item data:", data)

    try:
        transaction_id = data["transaction_id"]
        product_name = data["product_name"]
        category = data.get("category", "")
        price = data["price"]
        quantity = data["quantity"]
        total = data["total"]
    except KeyError as e:
        return jsonify({"error": f"Missing field: {str(e)}"}), 400

    conn = get_connection()
    cur = conn.cursor()

    try:
        # Check transaction exists and is active
        cur.execute("""
            SELECT id FROM transactions
            WHERE id = %s AND shop_id = %s AND status = 'active'
        """, (transaction_id, user_id))

        txn = cur.fetchone()

        if not txn:
            return jsonify({"error": "Invalid or completed transaction"}), 400

        # Insert sale item
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

        # Update transaction total
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
# GET TRANSACTION ITEMS
# ─────────────────────────────────────────────
@sales_bp.route("/transactions/<int:transaction_id>", methods=["GET"])
@token_required
def get_transaction(user_id, transaction_id):

    conn = get_connection()
    cur = conn.cursor()

    try:
        # Verify transaction belongs to this shop
        cur.execute("""
            SELECT id FROM transactions
            WHERE id = %s AND shop_id = %s
        """, (transaction_id, user_id))

        txn = cur.fetchone()
        if not txn:
            return jsonify({"error": "Transaction not found"}), 404

        # Fetch items for this transaction
        cur.execute("""
            SELECT product_name, quantity, price, total
            FROM sales
            WHERE transaction_id = %s AND shop_id = %s
        """, (transaction_id, user_id))

        rows = cur.fetchall()

        items = [
            {
                "description": row["product_name"],
                "qty": row["quantity"],
                "rate": row["price"],
                "amount": row["total"]
            }
            for row in rows
        ]

        return jsonify({"items": items}), 200

    except Exception as e:
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
    transaction_id = data.get("transaction_id")

    if not transaction_id:
        return jsonify({"error": "transaction_id required"}), 400

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            UPDATE transactions
            SET status = 'completed'
            WHERE id = %s AND shop_id = %s
        """, (transaction_id, user_id))

        conn.commit()

        return jsonify({
            "message": "Transaction completed"
        }), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# GET TODAY SALES (Dashboard)
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
# GET DAILY SALES (Analytics)
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
              AND status = 'completed'
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        """, (user_id,))

        rows = cur.fetchall()
        return jsonify(rows)

    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# ARIMA FORECAST (7 days)
# ─────────────────────────────────────────────
@sales_bp.route("/analytics/forecast", methods=["GET"])
@token_required
def forecast_sales(user_id):

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT DATE(created_at) as date,
                   SUM(total) as total_sales
            FROM transactions
            WHERE shop_id = %s
              AND status = 'completed'
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        """, (user_id,))

        rows = cur.fetchall()

        if len(rows) < 5:
            return jsonify({
                "error": "Not enough historical data for forecasting"
            }), 400

        df = pd.DataFrame(rows)

        df["date"] = pd.to_datetime(df["date"])
        df["total_sales"] = pd.to_numeric(df["total_sales"], errors="coerce")

        df.set_index("date", inplace=True)
        df = df.sort_index()

        model = ARIMA(df["total_sales"], order=(1, 1, 1))
        model_fit = model.fit()

        forecast = model_fit.forecast(steps=7)

        future_dates = pd.date_range(
            start=df.index[-1] + pd.Timedelta(days=1),
            periods=7
        )

        result = []

        for date, value in zip(future_dates, forecast):
            result.append({
                "date": date.strftime("%Y-%m-%d"),
                "predicted_sales": round(float(value), 2)
            })

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        cur.close()
        conn.close()
