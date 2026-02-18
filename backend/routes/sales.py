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
# GET DAILY SALES
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


# ─────────────────────────────────────────────
# ARIMA FORECAST
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
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        """, (user_id,))

        rows = cur.fetchall()
        print("Forecast rows:", rows)


        if len(rows) < 3:
            return jsonify({"error": "Not enough data for forecasting"}), 400

        df = pd.DataFrame(rows)
        df["date"] = pd.to_datetime(df["date"])
        df.set_index("date", inplace=True)

        model = ARIMA(df["total_sales"], order=(1,1,1))
        model_fit = model.fit()

        forecast = model_fit.forecast(steps=7)

        result = []
        for i, value in enumerate(forecast):
            result.append({
                "day": f"Day {i+1}",
                "predicted_sales": float(value)
            })


        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        cur.close()
        conn.close()
