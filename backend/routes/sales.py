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
    data = request.get_json(silent=True) or {}
    date_param = data.get("date")

    conn = get_connection()
    cur = conn.cursor()

    try:
        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        transaction_code = f"TXN{timestamp}"

        if date_param:
            cur.execute("""
                INSERT INTO transactions (shop_id, transaction_code, total, status, created_at)
                VALUES (%s, %s, 0, 'active', %s)
            """, (user_id, transaction_code, f"{date_param} 12:00:00"))
        else:
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
        barcode = data.get("barcode", None)
        price = data["price"]
        quantity = data["quantity"]
        total = data["total"]
    except KeyError as e:
        return jsonify({"error": f"Missing field: {str(e)}"}), 400

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT id, created_at FROM transactions
            WHERE id = %s AND shop_id = %s AND status = 'active'
        """, (transaction_id, user_id))

        txn = cur.fetchone()

        if not txn:
            return jsonify({"error": "Invalid or completed transaction"}), 400

        txn_date = txn["created_at"]

        # ── Check if item already exists in this transaction ──
        if barcode:
            cur.execute("""
                SELECT id, quantity, total FROM sales 
                WHERE transaction_id = %s AND barcode = %s
            """, (transaction_id, barcode))
        else:
            cur.execute("""
                SELECT id, quantity, total FROM sales 
                WHERE transaction_id = %s AND product_name = %s AND barcode IS NULL
            """, (transaction_id, product_name))
        
        existing_item = cur.fetchone()

        if existing_item:
            # ── Update existing record ──
            new_qty = existing_item["quantity"] + quantity
            new_total = float(existing_item["total"]) + total
            
            cur.execute("""
                UPDATE sales 
                SET quantity = %s, total = %s 
                WHERE id = %s
            """, (new_qty, new_total, existing_item["id"]))
        else:
            # ── Insert new sale record ──
            cur.execute("""
                INSERT INTO sales (
                    shop_id,
                    product_name,
                    category,
                    barcode,
                    price,
                    quantity,
                    total,
                    transaction_id,
                    created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                user_id,
                product_name,
                category,
                barcode,
                price,
                quantity,
                total,
                transaction_id,
                txn_date
            ))

        # ── Update transaction total ──
        cur.execute("""
            UPDATE transactions
            SET total = total + %s
            WHERE id = %s AND shop_id = %s
        """, (total, transaction_id, user_id))

        # ── Deduct from inventory stock ──
        if barcode:
            cur.execute("""
                UPDATE inventory
                SET stock = GREATEST(stock - %s, 0)
                WHERE shop_id = %s AND barcode = %s
            """, (quantity, user_id, barcode))
        else:
            cur.execute("""
                UPDATE inventory
                SET stock = GREATEST(stock - %s, 0)
                WHERE shop_id = %s AND product_name = %s
                LIMIT 1
            """, (quantity, user_id, product_name))

        conn.commit()

        return jsonify({"message": "Item added successfully"}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# REMOVE ITEM FROM TRANSACTION
# ─────────────────────────────────────────────
@sales_bp.route("/transactions/remove-item", methods=["POST"])
@token_required
def remove_item(user_id):
    data = request.json
    try:
        transaction_id = data["transaction_id"]
        product_name = data["product_name"]
        barcode = data.get("barcode")
    except KeyError as e:
        return jsonify({"error": f"Missing field: {str(e)}"}), 400

    conn = get_connection()
    cur = conn.cursor()
    try:
        # Get the item total to deduct from transaction total
        cur.execute("""
            SELECT total FROM sales 
            WHERE transaction_id = %s AND product_name = %s AND (barcode = %s OR %s IS NULL)
            LIMIT 1
        """, (transaction_id, product_name, barcode, barcode))
        item = cur.fetchone()
        if not item:
            return jsonify({"error": "Item not found in transaction"}), 404

        item_total = float(item["total"])

        # Delete from sales
        cur.execute("""
            DELETE FROM sales 
            WHERE transaction_id = %s AND product_name = %s AND (barcode = %s OR %s IS NULL)
            LIMIT 1
        """, (transaction_id, product_name, barcode, barcode))

        # Update transaction total
        cur.execute("""
            UPDATE transactions
            SET total = GREATEST(total - %s, 0)
            WHERE id = %s AND shop_id = %s
        """, (item_total, transaction_id, user_id))

        conn.commit()
        return jsonify({"message": "Item removed"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# ─────────────────────────────────────────────
# UPDATE ITEM QUANTITY
# ─────────────────────────────────────────────
@sales_bp.route("/transactions/update-item-qty", methods=["POST"])
@token_required
def update_item_qty(user_id):
    data = request.json
    try:
        transaction_id = data["transaction_id"]
        product_name = data["product_name"]
        barcode = data.get("barcode")
        new_qty = data["quantity"]
    except KeyError as e:
        return jsonify({"error": f"Missing field: {str(e)}"}), 400

    conn = get_connection()
    cur = conn.cursor()
    try:
        # Get current item info
        cur.execute("""
            SELECT price, quantity, total FROM sales 
            WHERE transaction_id = %s AND product_name = %s AND (barcode = %s OR %s IS NULL)
            LIMIT 1
        """, (transaction_id, product_name, barcode, barcode))
        item = cur.fetchone()
        if not item:
            return jsonify({"error": "Item not found"}), 404

        old_total = float(item["total"])
        price = float(item["price"])
        new_total = price * new_qty

        # Update sales record
        cur.execute("""
            UPDATE sales 
            SET quantity = %s, total = %s
            WHERE transaction_id = %s AND product_name = %s AND (barcode = %s OR %s IS NULL)
            LIMIT 1
        """, (new_qty, new_total, transaction_id, product_name, barcode, barcode))

        # Update transaction total
        cur.execute("""
            UPDATE transactions
            SET total = total - %s + %s
            WHERE id = %s AND shop_id = %s
        """, (old_total, new_total, transaction_id, user_id))

        conn.commit()
        return jsonify({"message": "Quantity updated"}), 200
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
            SELECT id, transaction_code, total, created_at
            FROM transactions
            WHERE id = %s AND shop_id = %s
        """, (transaction_id, user_id))

        txn = cur.fetchone()
        if not txn:
            return jsonify({"error": "Transaction not found"}), 404

        cur.execute("""
            SELECT product_name, quantity, price, total, category, barcode
            FROM sales
            WHERE transaction_id = %s AND shop_id = %s
        """, (transaction_id, user_id))

        rows = cur.fetchall()

        items = [
            {
                "description": row["product_name"],
                "qty": row["quantity"],
                "rate": float(row["price"]),
                "amount": float(row["total"]),
                "category": row["category"],
                "barcode": row["barcode"]
            }
            for row in rows
        ]

        return jsonify({
            "transaction_code": txn["transaction_code"],
            "total": float(txn["total"]),
            "created_at": txn["created_at"].isoformat() if hasattr(txn["created_at"], "isoformat") else str(txn["created_at"]),
            "items": items
        }), 200

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

    # Optional ?date=YYYY-MM-DD param for historical dashboard view
    date_param = request.args.get("date")

    conn = get_connection()
    cur = conn.cursor()

    try:
        if date_param:
            cur.execute("""
                SELECT s.product_name, s.quantity, s.price, s.total
                FROM sales s
                JOIN transactions t ON s.transaction_id = t.id
                WHERE s.shop_id = %s
                  AND DATE(s.created_at) = %s
                  AND t.status = 'completed'
                ORDER BY s.created_at DESC
            """, (user_id, date_param))
        else:
            cur.execute("""
                SELECT s.product_name, s.quantity, s.price, s.total
                FROM sales s
                JOIN transactions t ON s.transaction_id = t.id
                WHERE s.shop_id = %s
                  AND DATE(s.created_at) = CURDATE()
                  AND t.status = 'completed'
                ORDER BY s.created_at DESC
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
# HELPER: Build continuous daily series (fill gaps with 0)
# ─────────────────────────────────────────────
def _fill_date_gaps(dates, values):
    """Given parallel lists of dates + values, return a daily-frequency
    Series with missing dates filled as 0."""
    if len(dates) == 0:
        return pd.Series(dtype=float)
    df = pd.DataFrame({"date": pd.to_datetime(dates), "val": values})
    df = df.groupby("date")["val"].sum().sort_index()
    # Extend to today so ARIMA sees recent zero-sales days
    end_date = max(df.index.max(), pd.Timestamp.today().normalize())
    full_idx = pd.date_range(start=df.index.min(), end=end_date, freq="D")
    return df.reindex(full_idx, fill_value=0.0)


# ─────────────────────────────────────────────
# HELPER: Run ARIMA or fallback moving average
# ─────────────────────────────────────────────
def _arima_or_fallback(series, steps=7):
    """Returns list of `steps` forecast values.
    Trains ARIMA only on non-zero sales days; falls back to weighted moving average.
    This prevents zero-padded days from dragging the forecast to zero."""
    arr = np.asarray(series, dtype=float)

    # ── Only keep the non-zero sales days for modelling ──────────────────────
    # Zero-padding (days with no sales) should not inform the forecast level.
    nonzero = arr[arr > 0]

    if len(nonzero) == 0:
        return [0.0] * steps          # Truly no sales history → nothing to forecast

    # Weighted baseline: more weight to recent values
    recent_nz = nonzero[-14:] if len(nonzero) >= 14 else nonzero
    weights = np.arange(1, len(recent_nz) + 1, dtype=float)
    baseline = float(np.average(recent_nz, weights=weights))

    # ── Try ARIMA on non-zero days only ──────────────────────────────────────
    # Using the actual sales days avoids the series being dominated by zeros.
    if len(nonzero) >= 3:
        for order in [(0, 1, 0), (0, 1, 1), (1, 0, 0), (1, 1, 0)]:
            try:
                model = ARIMA(nonzero, order=order)
                fit = model.fit()
                fc = fit.forecast(steps=steps)
                values = [float(v) for v in fc]

                # Safety: reject runaway (>50× baseline) or all-zero outputs
                all_zero = all(v <= 0 for v in values)
                runaway  = baseline > 0 and max(values) > baseline * 50
                if all_zero or runaway:
                    continue

                return [max(0.0, round(v, 2)) for v in values]
            except Exception:
                continue

    # ── Fallback: weighted moving average with gentle trend ──────────────────
    if len(nonzero) == 1:
        return [round(baseline, 2)] * steps

    window = nonzero[-5:] if len(nonzero) >= 5 else nonzero
    # Trend from last two points, capped at ±20% of baseline per day
    diffs = np.diff(window.astype(float))
    raw_trend = float(np.mean(diffs))
    cap = baseline * 0.20 if baseline > 0 else 0.0
    trend = max(-cap, min(raw_trend, cap))
    base = float(window[-1])
    return [round(max(0.0, base + trend * (i + 1)), 2) for i in range(steps)]





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

        if len(rows) < 1:
            # Truly no data — return empty forecast instead of error
            return jsonify([])

        # Build continuous daily series (fill date gaps with 0)
        dates = [r["date"] for r in rows]
        values = [float(r["total_sales"]) for r in rows]
        daily_series = _fill_date_gaps(dates, values)

        forecast_values = _arima_or_fallback(daily_series.values, steps=7)

        # Always anchor forecast from today so dates are never stale
        today = datetime.date.today()
        future_dates = pd.date_range(
            start=today + pd.Timedelta(days=1),
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
        # ── Total sales, transactions & items sold ──────────
        cur.execute(f"""
            SELECT
                COALESCE(SUM(t.total), 0)    AS total_sales,
                COUNT(DISTINCT t.id)         AS total_transactions,
                COALESCE(SUM(s.quantity), 0) AS total_items
            FROM transactions t
            LEFT JOIN sales s ON s.transaction_id = t.id AND s.shop_id = t.shop_id
            WHERE t.shop_id = %s
              AND t.status = 'completed'
              AND {pf_t}
        """, (user_id,))
        txn_summary = cur.fetchone()

        # ── Total items sold ──────────
        cur.execute(f"""
            SELECT COALESCE(SUM(s.quantity), 0) AS total_items
            FROM sales s
            JOIN transactions t ON s.transaction_id = t.id
            WHERE t.shop_id = %s
              AND t.status = 'completed'
              AND {pf_t}
        """, (user_id,))
        items_summary = cur.fetchone()

        summary = {
            "total_sales": txn_summary["total_sales"],
            "total_transactions": txn_summary["total_transactions"],
            "total_items": items_summary["total_items"]
        }

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

        # ── Stock risk flag: HIGH or MEDIUM risk on any inventory item ──
        # Uses same thresholds as /analytics/stockout-risk:
        #   high   → stock <= demand_7d * 0.5
        #   medium → stock <  demand_7d
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
                dates  = [r["date"] for r in sales_rows]
                values = [float(r["qty"]) for r in sales_rows]
                daily  = _fill_date_gaps(dates, values)
                demand_7d = sum(_arima_or_fallback(daily.values, steps=7))
                stock_val = float(item["stock"])
                # Only flag AT RISK for high or medium — mirrors stockout-risk endpoint
                if demand_7d > 0 and stock_val < demand_7d:
                    stock_risk = True
                    break

        # If no inventory defined, fall back to sales-velocity heuristic
        if not inv_items:
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
            "total_items":        int(summary["total_items"]),
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
        # Use inventory as the source of products so every item gets a forecast
        # (not just products that have been sold before)
        cur.execute("""
            SELECT product_name
            FROM inventory
            WHERE shop_id = %s
            ORDER BY product_name
        """, (user_id,))
        inv_rows = cur.fetchall()

        # Fall back to distinct sold products if inventory is empty
        if not inv_rows:
            cur.execute("""
                SELECT DISTINCT product_name
                FROM sales
                WHERE shop_id = %s
                ORDER BY product_name
            """, (user_id,))
            inv_rows = cur.fetchall()

        products = [r["product_name"] for r in inv_rows]

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

            if rows:
                dates  = [r["date"] for r in rows]
                values = [float(r["qty"]) for r in rows]
                daily  = _fill_date_gaps(dates, values)
                forecast = _arima_or_fallback(daily.values, steps=7)
            else:
                forecast = [0.0] * 7

            result.append({
                "product_name": pname,
                "forecast": [
                    {"date": d, "predicted_qty": int(round(v))}
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
                dates = [r["date"] for r in rows]
                values = [float(r["qty"]) for r in rows]
                daily = _fill_date_gaps(dates, values)
                forecast_7d = _arima_or_fallback(daily.values, steps=7)
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
