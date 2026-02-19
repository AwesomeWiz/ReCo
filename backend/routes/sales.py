from flask import Blueprint, request, jsonify
from db import get_connection
from utils.jwt_auth import token_required
import datetime
import pandas as pd
import numpy as np
from statsmodels.tsa.arima.model import ARIMA
import warnings
warnings.filterwarnings("ignore")

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
        cur.execute("""
            SELECT id FROM transactions
            WHERE id = %s AND shop_id = %s AND status = 'active'
        """, (transaction_id, user_id))

        txn = cur.fetchone()

        if not txn:
            return jsonify({"error": "Invalid or completed transaction"}), 400

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
# GET TRANSACTION ITEMS
# ─────────────────────────────────────────────
@sales_bp.route("/transactions/<int:transaction_id>", methods=["GET"])
@token_required
def get_transaction(user_id, transaction_id):

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT id FROM transactions
            WHERE id = %s AND shop_id = %s
        """, (transaction_id, user_id))

        txn = cur.fetchone()
        if not txn:
            return jsonify({"error": "Transaction not found"}), 404

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
# GET TRANSACTIONS BY DATE (Sales History)
# ─────────────────────────────────────────────
@sales_bp.route("/transactions/by-date", methods=["GET"])
@token_required
def get_transactions_by_date(user_id):

    date_str = request.args.get("date")  # expected format: YYYY-MM-DD
    if not date_str:
        return jsonify({"error": "date query parameter is required"}), 400

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT id, transaction_code, total, created_at
            FROM transactions
            WHERE shop_id = %s
              AND status = 'completed'
              AND DATE(created_at) = %s
            ORDER BY created_at DESC
        """, (user_id, date_str))

        rows = cur.fetchall()

        result = [
            {
                "id": row["id"],
                "transaction_code": row["transaction_code"],
                "total": float(row["total"]),
                "formatted_time": row["created_at"].strftime("%I:%M %p")
                    if hasattr(row["created_at"], "strftime")
                    else str(row["created_at"]),
            }
            for row in rows
        ]

        return jsonify(result), 200

    except Exception as e:
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
# HELPER: Run ARIMA or fallback moving average
# ─────────────────────────────────────────────
def _arima_or_fallback(series, steps=7):
    """Returns list of `steps` forecast values."""
    if len(series) >= 5:
        try:
            model = ARIMA(series, order=(1, 1, 1))
            fit = model.fit()
            forecast = fit.forecast(steps=steps)
            return [max(0.0, float(v)) for v in forecast]
        except Exception:
            pass
    # Fallback: moving average of last 3 points
    window = series[-3:] if len(series) >= 3 else series
    avg = float(np.mean(window)) if len(window) > 0 else 0.0
    return [round(avg, 2)] * steps


# ─────────────────────────────────────────────
# ARIMA REVENUE FORECAST (7 days)
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

        if len(rows) < 3:
            return jsonify({
                "error": "Not enough historical data for forecasting"
            }), 400

        df = pd.DataFrame(rows)
        df["date"] = pd.to_datetime(df["date"])
        df["total_sales"] = pd.to_numeric(df["total_sales"], errors="coerce").fillna(0)
        df = df.set_index("date").sort_index()

        forecast_values = _arima_or_fallback(df["total_sales"].values, steps=7)

        future_dates = pd.date_range(
            start=df.index[-1] + pd.Timedelta(days=1),
            periods=7
        )

        result = [
            {
                "date": date.strftime("%Y-%m-%d"),
                "predicted_sales": round(v, 2)
            }
            for date, v in zip(future_dates, forecast_values)
        ]

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# ANALYTICS SUMMARY  (period: daily/weekly/monthly)
# ─────────────────────────────────────────────
@sales_bp.route("/analytics/summary", methods=["GET"])
@token_required
def analytics_summary(user_id):

    period = request.args.get("period", "daily")

    def get_filter(alias):
        return {
            "daily":   f"DATE({alias}.created_at) = CURDATE()",
            "weekly":  f"{alias}.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)",
            "monthly": f"{alias}.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)",
        }.get(period, f"DATE({alias}.created_at) = CURDATE()")

    pf_t = get_filter("t")
    pf_t2 = get_filter("t2")

    conn = get_connection()
    cur = conn.cursor()

    try:
        # ── Total sales & transactions ──────────────────────
        cur.execute(f"""
            SELECT
                COALESCE(SUM(t.total), 0)  AS total_sales,
                COUNT(t.id)                AS total_transactions
            FROM transactions t
            WHERE t.shop_id = %s
              AND t.status = 'completed'
              AND {pf_t}
        """, (user_id,))
        summary = cur.fetchone()

        # ── Top selling product ─────────────────────────────
        cur.execute(f"""
            SELECT s.product_name, SUM(s.quantity) AS qty
            FROM sales s
            JOIN transactions t ON s.transaction_id = t.id
            WHERE s.shop_id = %s
              AND t.status = 'completed'
              AND {pf_t}
            GROUP BY s.product_name
            ORDER BY qty DESC
            LIMIT 1
        """, (user_id,))
        top = cur.fetchone()

        # ── Category breakdown ──────────────────────────────
        cur.execute(f"""
            SELECT s.category,
                   ROUND(SUM(s.total) * 100.0 /
                         NULLIF((SELECT SUM(s2.total)
                                 FROM sales s2
                                 JOIN transactions t2 ON s2.transaction_id = t2.id
                                 WHERE s2.shop_id = %s
                                   AND t2.status = 'completed'
                                   AND {pf_t2}), 0), 1) AS percentage
            FROM sales s
            JOIN transactions t ON s.transaction_id = t.id
            WHERE s.shop_id = %s
              AND t.status = 'completed'
              AND {pf_t}
            GROUP BY s.category
            ORDER BY percentage DESC
        """, (user_id, user_id))
        cats = cur.fetchall()

        # ── Stock risk flag via ARIMA demand check ──────────
        # Get inventory items
        cur.execute("""
            SELECT product_name, stock
            FROM inventory
            WHERE shop_id = %s
        """, (user_id,))
        inv_items = cur.fetchall()

        stock_risk = False
        for item in inv_items:
            pname = item["product_name"]
            cur.execute("""
                SELECT DATE(created_at) as date, SUM(quantity) as qty
                FROM sales
                WHERE shop_id = %s AND product_name = %s
                GROUP BY DATE(created_at)
                ORDER BY date
            """, (user_id, pname))
            sales_rows = cur.fetchall()

            if sales_rows:
                qty_series = [float(r["qty"]) for r in sales_rows]
                demand_7d = sum(_arima_or_fallback(qty_series, steps=7))
                if item["stock"] <= demand_7d:
                    stock_risk = True
                    break

        # If no inventory defined, compute simplified risk from sales velocity
        if not inv_items:
            # Check if any product sold more than 50 units in period
            cur.execute(f"""
                SELECT SUM(s.quantity) as total_qty
                FROM sales s
                JOIN transactions t ON s.transaction_id = t.id
                WHERE s.shop_id = %s
                  AND t.status = 'completed'
                  AND {pf_t}
            """, (user_id,))
            row = cur.fetchone()
            stock_risk = (row["total_qty"] or 0) > 50

        return jsonify({
            "total_sales":        round(float(summary["total_sales"]), 2),
            "total_transactions": int(summary["total_transactions"]),
            "top_product":        top["product_name"] if top else "N/A",
            "stock_risk":         stock_risk,
            "categories":         cats,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# ARIMA DEMAND FORECAST PER PRODUCT (next 7 days)
# ─────────────────────────────────────────────
@sales_bp.route("/analytics/demand", methods=["GET"])
@token_required
def demand_forecast(user_id):

    conn = get_connection()
    cur = conn.cursor()

    try:
        # Distinct products sold by this shop
        cur.execute("""
            SELECT DISTINCT product_name
            FROM sales
            WHERE shop_id = %s
            ORDER BY product_name
        """, (user_id,))
        products = [r["product_name"] for r in cur.fetchall()]

        result = []
        today = datetime.date.today()
        future_dates = [
            (today + datetime.timedelta(days=i)).strftime("%Y-%m-%d")
            for i in range(1, 8)
        ]

        for pname in products:
            cur.execute("""
                SELECT DATE(created_at) as date, SUM(quantity) as qty
                FROM sales
                WHERE shop_id = %s AND product_name = %s
                GROUP BY DATE(created_at)
                ORDER BY date
            """, (user_id, pname))
            rows = cur.fetchall()

            qty_series = [float(r["qty"]) for r in rows]
            forecast = _arima_or_fallback(qty_series, steps=7)

            result.append({
                "product_name": pname,
                "forecast": [
                    {"date": d, "predicted_qty": round(v, 1)}
                    for d, v in zip(future_dates, forecast)
                ],
                "total_predicted_7d": round(sum(forecast), 1),
            })

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# STOCKOUT RISK  (per inventory item)
# ─────────────────────────────────────────────
@sales_bp.route("/analytics/stockout-risk", methods=["GET"])
@token_required
def stockout_risk(user_id):

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT id, product_name, stock
            FROM inventory
            WHERE shop_id = %s
            ORDER BY product_name
        """, (user_id,))
        inv_items = cur.fetchall()

        result = []
        today = datetime.date.today()

        for item in inv_items:
            pname = item["product_name"]
            stock = float(item["stock"])

            cur.execute("""
                SELECT DATE(created_at) as date, SUM(quantity) as qty
                FROM sales
                WHERE shop_id = %s AND product_name = %s
                GROUP BY DATE(created_at)
                ORDER BY date
            """, (user_id, pname))
            rows = cur.fetchall()

            if rows:
                qty_series = [float(r["qty"]) for r in rows]
                forecast_7d = _arima_or_fallback(qty_series, steps=7)
                demand_7d = sum(forecast_7d)
            else:
                demand_7d = 0.0
                forecast_7d = [0.0] * 7

            # Risk classification
            if demand_7d == 0:
                risk_level = "none"
            elif stock <= demand_7d * 0.5:
                risk_level = "high"
            elif stock < demand_7d:
                risk_level = "medium"
            else:
                risk_level = "low"

            # Days until stockout estimate
            daily_avg = demand_7d / 7 if demand_7d > 0 else 0
            days_until_stockout = round(stock / daily_avg) if daily_avg > 0 else None

            result.append({
                "product_name":         pname,
                "stock":                int(stock),
                "predicted_demand_7d":  round(demand_7d, 1),
                "daily_avg_demand":     round(daily_avg, 1),
                "days_until_stockout":  days_until_stockout,
                "risk_level":           risk_level,
            })

        # Sort by risk severity
        risk_order = {"high": 0, "medium": 1, "low": 2, "none": 3}
        result.sort(key=lambda x: risk_order.get(x["risk_level"], 4))

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        cur.close()
        conn.close()
