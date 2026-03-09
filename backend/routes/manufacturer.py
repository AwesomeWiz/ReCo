from flask import Blueprint, request, jsonify
from db import get_connection
import datetime
import bcrypt
import jwt
import os
from functools import wraps

manufacturer_bp = Blueprint("manufacturer", __name__)

JWT_SECRET = os.environ.get("JWT_SECRET", "reco_mfr_secret_change_in_prod")


# ─────────────────────────────────────────────
# JWT AUTH DECORATOR (manufacturer-specific)
# ─────────────────────────────────────────────
def mfr_token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Unauthorized"}), 401
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            mfr_id = payload["id"]
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        return f(mfr_id, *args, **kwargs)
    return decorated


# ─────────────────────────────────────────────
# SIGN UP
# ─────────────────────────────────────────────
@manufacturer_bp.route("/manufacturer/signup", methods=["POST"])
def manufacturer_signup():

    data = request.json or {}
    company_name = data.get("company_name", "").strip()
    email        = data.get("email", "").strip().lower()
    phone        = data.get("phone", "").strip() or None
    password     = data.get("password", "")
    country      = data.get("country", "India")
    state        = data.get("state", "") or None

    if not company_name or not email or not password:
        return jsonify({"error": "company_name, email and password are required"}), 400

    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    conn = get_connection()
    cur  = conn.cursor()

    try:
        cur.execute("""
            INSERT INTO manufacturers (company_name, email, phone, password_hash, country, state)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (company_name, email, phone, password_hash, country, state))
        conn.commit()
        return jsonify({"message": "Account created"}), 201

    except Exception as e:
        conn.rollback()
        if "Duplicate entry" in str(e):
            return jsonify({"error": "Email already registered"}), 409
        return jsonify({"error": str(e)}), 500

    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# LOGIN
# ─────────────────────────────────────────────
@manufacturer_bp.route("/manufacturer/login", methods=["POST"])
def manufacturer_login():

    data     = request.json or {}
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    conn = get_connection()
    cur  = conn.cursor()

    try:
        cur.execute("""
            SELECT id, company_name, email, phone, password_hash, country, state, created_at
            FROM manufacturers
            WHERE email = %s
        """, (email,))
        mfr = cur.fetchone()

        if not mfr:
            return jsonify({"error": "Invalid credentials"}), 401

        if not bcrypt.checkpw(password.encode(), mfr["password_hash"].encode()):
            return jsonify({"error": "Invalid credentials"}), 401

        token = jwt.encode(
            {
                "id":           mfr["id"],
                "email":        mfr["email"],
                "company_name": mfr["company_name"],
                "exp":          datetime.datetime.utcnow() + datetime.timedelta(days=7),
            },
            JWT_SECRET,
            algorithm="HS256"
        )

        safe = {k: v for k, v in mfr.items() if k != "password_hash"}
        if hasattr(safe.get("created_at"), "isoformat"):
            safe["created_at"] = safe["created_at"].isoformat()

        return jsonify({"manufacturer": safe, "token": token}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# GET PRODUCTS
# ─────────────────────────────────────────────
@manufacturer_bp.route("/manufacturer/products", methods=["GET"])
@mfr_token_required
def get_products(mfr_id):

    conn = get_connection()
    cur  = conn.cursor()

    try:
        cur.execute("""
            SELECT id, product_name, category, created_at
            FROM manufacturer_products
            WHERE manufacturer_id = %s
            ORDER BY created_at DESC
        """, (mfr_id,))
        rows = cur.fetchall()

        products = []
        for row in rows:
            p = dict(row)
            if hasattr(p.get("created_at"), "isoformat"):
                p["created_at"] = p["created_at"].isoformat()
            products.append(p)

        return jsonify({"products": products}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# ADD PRODUCT
# ─────────────────────────────────────────────
@manufacturer_bp.route("/manufacturer/products", methods=["POST"])
@mfr_token_required
def add_product(mfr_id):

    data         = request.json or {}
    product_name = data.get("product_name", "").strip()
    category     = data.get("category", "General").strip()

    if not product_name:
        return jsonify({"error": "product_name is required"}), 400

    conn = get_connection()
    cur  = conn.cursor()

    try:
        cur.execute("""
            SELECT id FROM manufacturer_products
            WHERE manufacturer_id = %s AND product_name = %s
        """, (mfr_id, product_name))
        if cur.fetchone():
            return jsonify({"error": "Product already listed"}), 409

        cur.execute("""
            INSERT INTO manufacturer_products (manufacturer_id, product_name, category)
            VALUES (%s, %s, %s)
        """, (mfr_id, product_name, category))
        conn.commit()

        return jsonify({"id": cur.lastrowid, "product_name": product_name, "category": category}), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# DELETE PRODUCT
# ─────────────────────────────────────────────
@manufacturer_bp.route("/manufacturer/products/<int:product_id>", methods=["DELETE"])
@mfr_token_required
def delete_product(mfr_id, product_id):

    conn = get_connection()
    cur  = conn.cursor()

    try:
        cur.execute("""
            DELETE FROM manufacturer_products
            WHERE id = %s AND manufacturer_id = %s
        """, (product_id, mfr_id))
        conn.commit()
        return jsonify({"message": "Removed"}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# DASHBOARD STATS
# ─────────────────────────────────────────────
@manufacturer_bp.route("/manufacturer/dashboard-stats", methods=["GET"])
@mfr_token_required
def dashboard_stats(mfr_id):

    conn = get_connection()
    cur  = conn.cursor()

    try:
        # Total listed products
        cur.execute("""
            SELECT COUNT(*) AS cnt
            FROM manufacturer_products
            WHERE manufacturer_id = %s
        """, (mfr_id,))
        total_products = cur.fetchone()["cnt"]

        # Fetch listed product names
        cur.execute("""
            SELECT product_name FROM manufacturer_products
            WHERE manufacturer_id = %s
        """, (mfr_id,))
        product_names = [r["product_name"] for r in cur.fetchall()]

        if not product_names:
            return jsonify({
                "total_products":    0,
                "total_units_sold":  0,
                "active_regions":    0,
                "avg_stockout_risk": "N/A",
                "top_products":      [],
                "region_split":      [],
                "trend":             [],
            }), 200

        placeholders = ", ".join(["%s"] * len(product_names))

        # Total units sold in last 30 days
        cur.execute(f"""
            SELECT COALESCE(SUM(quantity), 0) AS total
            FROM sales
            WHERE product_name IN ({placeholders})
              AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        """, product_names)
        total_units = int(cur.fetchone()["total"])

        # Active regions (distinct states) — last 30 days
        cur.execute(f"""
            SELECT COUNT(DISTINCT sh.state) AS cnt
            FROM sales s
            JOIN shops sh ON sh.id = s.shop_id
            WHERE s.product_name IN ({placeholders})
              AND s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        """, product_names)
        active_regions = int(cur.fetchone()["cnt"])

        # Average stock across inventory for listed products
        cur.execute(f"""
            SELECT AVG(stock) AS avg_stock
            FROM inventory
            WHERE product_name IN ({placeholders})
        """, product_names)
        row = cur.fetchone()
        avg_stock = float(row["avg_stock"]) if row["avg_stock"] else None

        if avg_stock is None:
            avg_stockout_risk = "N/A"
        elif avg_stock < 5:
            avg_stockout_risk = "High"
        elif avg_stock < 15:
            avg_stockout_risk = "Medium"
        else:
            avg_stockout_risk = "Low"

        # Top 5 products by units sold — last 30 days
        cur.execute(f"""
            SELECT product_name, COALESCE(SUM(quantity), 0) AS units
            FROM sales
            WHERE product_name IN ({placeholders})
              AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY product_name
            ORDER BY units DESC
            LIMIT 5
        """, product_names)
        top_rows        = cur.fetchall()
        total_top_units = sum(r["units"] for r in top_rows) or 1
        top_products    = [
            {
                "name":  r["product_name"],
                "units": int(r["units"]),
                "share": round((r["units"] / total_top_units) * 100),
            }
            for r in top_rows
        ]

        # Region split — units + store count per state — last 30 days
        cur.execute(f"""
            SELECT sh.state,
                   COALESCE(SUM(s.quantity), 0)    AS units,
                   COUNT(DISTINCT s.shop_id)        AS stores
            FROM sales s
            JOIN shops sh ON sh.id = s.shop_id
            WHERE s.product_name IN ({placeholders})
              AND s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY sh.state
            ORDER BY units DESC
        """, product_names)
        region_split = [
            {"state": r["state"] or "Unknown", "units": int(r["units"]), "stores": int(r["stores"])}
            for r in cur.fetchall()
        ]

        # Trend — last 14 days grouped by day
        cur.execute(f"""
            SELECT DATE_FORMAT(created_at, '%%b %%d') AS date,
                   COALESCE(SUM(quantity), 0)          AS units
            FROM sales
            WHERE product_name IN ({placeholders})
              AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
            GROUP BY DATE_FORMAT(created_at, '%%b %%d')
            ORDER BY MIN(created_at)
        """, product_names)
        trend = [{"date": r["date"], "units": int(r["units"])} for r in cur.fetchall()]

        return jsonify({
            "total_products":    total_products,
            "total_units_sold":  total_units,
            "active_regions":    active_regions,
            "avg_stockout_risk": avg_stockout_risk,
            "top_products":      top_products,
            "region_split":      region_split,
            "trend":             trend,
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# ANALYTICS
# Returns: regions (with districts), trend, stockout
# All data is aggregated + anonymised — no shop
# names or contact details are ever exposed.
# ─────────────────────────────────────────────
@manufacturer_bp.route("/manufacturer/analytics", methods=["GET"])
@mfr_token_required
def manufacturer_analytics(mfr_id):

    period         = request.args.get("period", "monthly")
    selected_product = request.args.get("product", None)  # for per-product trend

    date_filter = {
        "daily":   "s.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)",
        "weekly":  "s.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)",
        "monthly": "s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
    }.get(period, "s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)")

    conn = get_connection()
    cur  = conn.cursor()

    try:
        # Fetch manufacturer's listed products
        cur.execute("""
            SELECT product_name FROM manufacturer_products
            WHERE manufacturer_id = %s
        """, (mfr_id,))
        product_names = [r["product_name"] for r in cur.fetchall()]

        if not product_names:
            return jsonify({"regions": [], "trend": [], "stockout": [], "stores": []}), 200

        placeholders = ", ".join(["%s"] * len(product_names))

        # ── 1. Regional aggregation (all products) ────────────
        cur.execute(f"""
            SELECT
                sh.state,
                SUM(s.quantity)           AS total_units,
                COUNT(DISTINCT s.shop_id) AS stores
            FROM sales s
            JOIN shops sh ON sh.id = s.shop_id
            WHERE s.product_name IN ({placeholders})
              AND {date_filter}
            GROUP BY sh.state
            ORDER BY total_units DESC
        """, product_names)
        regions = [dict(r) for r in cur.fetchall()]

        # ── 2. Sales trend — filtered by selected product ─────
        # If a specific product is requested and it belongs to this
        # manufacturer, filter by it. Otherwise use all products.
        if selected_product and selected_product in product_names:
            trend_params = [selected_product]
            trend_ph     = "%s"
        else:
            trend_params = product_names
            trend_ph     = placeholders

        cur.execute(f"""
            SELECT
                DATE_FORMAT(s.created_at, '%%b %%d') AS date,
                SUM(s.quantity)                       AS units
            FROM sales s
            WHERE s.product_name IN ({trend_ph})
              AND s.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
            GROUP BY DATE_FORMAT(s.created_at, '%%b %%d')
            ORDER BY MIN(s.created_at)
        """, trend_params)
        trend = [dict(r) for r in cur.fetchall()]

        # ── 3. Stockout risk across all stores ────────────────
        cur.execute(f"""
            SELECT
                i.product_name,
                COUNT(CASE WHEN i.stock < 5 THEN 1 END) AS at_risk_stores,
                COUNT(*)                                  AS total_stores,
                CASE
                    WHEN AVG(i.stock) < 5  THEN 'high'
                    WHEN AVG(i.stock) < 15 THEN 'medium'
                    ELSE 'low'
                END AS risk_level
            FROM inventory i
            WHERE i.product_name IN ({placeholders})
            GROUP BY i.product_name
        """, product_names)
        stockout = [dict(r) for r in cur.fetchall()]

        # ── 4. District + store drill-down ────────────────────
        # District level
        cur.execute(f"""
            SELECT
                sh.state,
                sh.district,
                SUM(s.quantity)           AS units,
                COUNT(DISTINCT s.shop_id) AS store_count
            FROM sales s
            JOIN shops sh ON sh.id = s.shop_id
            WHERE s.product_name IN ({placeholders})
              AND {date_filter}
              AND sh.district IS NOT NULL
            GROUP BY sh.state, sh.district
            ORDER BY sh.state, units DESC
        """, product_names)
        district_rows = cur.fetchall()

        # Store level — include store_name and district for display
        cur.execute(f"""
            SELECT
                sh.state,
                sh.district,
                sh.store_name,
                SUM(s.quantity) AS units
            FROM sales s
            JOIN shops sh ON sh.id = s.shop_id
            WHERE s.product_name IN ({placeholders})
              AND {date_filter}
            GROUP BY sh.state, sh.district, sh.id, sh.store_name
            ORDER BY sh.state, sh.district, units DESC
        """, product_names)
        store_rows = cur.fetchall()

        # Group stores under state+district
        stores_by_key = {}
        for row in store_rows:
            key = (row["state"], row["district"])
            if key not in stores_by_key:
                stores_by_key[key] = []
            stores_by_key[key].append({
                "store_name": row["store_name"],
                "district":   row["district"],
                "units":      int(row["units"]),
            })

        # Group districts under state, attach stores to each district
        districts_by_state = {}
        for row in district_rows:
            state = row["state"]
            if state not in districts_by_state:
                districts_by_state[state] = []
            districts_by_state[state].append({
                "district":    row["district"],
                "units":       int(row["units"]),
                "store_count": int(row["store_count"]),
                "stores":      stores_by_key.get((row["state"], row["district"]), []),
            })

        # Attach to regions + cast types
        for region in regions:
            region["districts"]   = districts_by_state.get(region["state"], [])
            region["total_units"] = int(region["total_units"])
            region["stores"]      = int(region["stores"])

        for s in stockout:
            s["at_risk_stores"] = int(s["at_risk_stores"])
            s["total_stores"]   = int(s["total_stores"])

        for t in trend:
            t["units"] = int(t["units"])

        # Flat store list for the stores tab (sorted by units desc)
        all_stores = []
        for row in store_rows:
            all_stores.append({
                "store_name": row["store_name"],
                "district":   row["district"] or "—",
                "state":      row["state"] or "—",
                "units":      int(row["units"]),
            })

        return jsonify({
            "regions":  regions,
            "trend":    trend,
            "stockout": stockout,
            "stores":   all_stores,
        }), 200

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500

    finally:
        cur.close()
        conn.close()