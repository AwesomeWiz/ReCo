from flask import Blueprint, request, jsonify
from db import get_connection
from utils.jwt_auth import token_required

inventory_bp = Blueprint("inventory", __name__)


# ─────────────────────────────────────────────
# GET INVENTORY
# ─────────────────────────────────────────────
@inventory_bp.route("/inventory", methods=["GET"])
@token_required
def get_inventory(user_id):
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT id, product_name, category, price, stock, barcode
            FROM inventory
            WHERE shop_id = %s
            ORDER BY created_at DESC
        """, (user_id,))

        items = cur.fetchall()

        return jsonify(items)

    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# ADD PRODUCT TO INVENTORY (upsert by barcode)
# ─────────────────────────────────────────────
@inventory_bp.route("/inventory/add", methods=["POST"])
@token_required
def add_inventory_item(user_id):
    data = request.json

    conn = get_connection()
    cur = conn.cursor()

    try:
        product_name = data.get("name")
        category = data.get("category", "")
        barcode = data.get("barcode", None)

        if "price" not in data:
            return jsonify({"error": "Missing field: price"}), 400
        if "stock" not in data:
            return jsonify({"error": "Missing field: stock"}), 400

        price = data["price"]
        stock = data["stock"]

        if barcode:
            # ── Atomic upsert: if barcode already exists, ADD the new stock ──
            cur.execute("""
                INSERT INTO inventory (shop_id, product_name, category, price, stock, barcode)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    stock = stock + VALUES(stock),
                    price = VALUES(price)
            """, (user_id, product_name, category, price, stock, barcode))

            # affected_rows = 1 → inserted new, 2 → updated existing
            merged = cur.rowcount == 2
        else:
            # No barcode → always insert a new row
            cur.execute("""
                INSERT INTO inventory (shop_id, product_name, category, price, stock, barcode)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (user_id, product_name, category, price, stock, barcode))
            merged = False

        conn.commit()

        msg = "Stock updated (product merged)" if merged else "Product added to inventory"
        return jsonify({"message": msg, "merged": merged}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# BARCODE LOOKUP
# ─────────────────────────────────────────────
@inventory_bp.route("/inventory/barcode-lookup", methods=["POST"])
@token_required
def barcode_lookup(user_id):
    data = request.json
    barcode = data.get("barcode")

    if not barcode:
        return jsonify({"error": "Missing barcode"}), 400

    conn = get_connection()
    cur = conn.cursor()

    try:
        # DEBUG: Print all barcodes for this user to terminal to see why matching fails
        cur.execute("SELECT barcode FROM inventory WHERE shop_id = %s AND barcode IS NOT NULL", (user_id,))
        all_barcodes = [row["barcode"] if isinstance(row, dict) else row[0] for row in cur.fetchall()]
        print(f"DEBUG: Looking for barcode '{barcode}' (type {type(barcode)}). DB has: {all_barcodes}")

        cur.execute("""
            SELECT id, product_name, category, price, stock, barcode
            FROM inventory
            WHERE shop_id = %s AND barcode = %s
            LIMIT 1
        """, (user_id, barcode))

        item = cur.fetchone()

        if item:
            return jsonify({
                "found": True,
                "product": {
                    "id": item["id"],
                    "name": item["product_name"],
                    "category": item["category"],
                    "price": float(item["price"]),
                    "stock": item["stock"],
                    "barcode": item["barcode"]
                }
            })
        else:
            return jsonify({"found": False, "message": "Product not found"}), 200

    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# UPDATE PRODUCT (Full Update)
# ─────────────────────────────────────────────
@inventory_bp.route("/inventory/<int:item_id>", methods=["PUT"])
@token_required
def update_inventory_item(user_id, item_id):
    data = request.json
    conn = get_connection()
    cur = conn.cursor()

    try:
        name = data.get("product_name")
        category = data.get("category")
        price = data.get("price")
        stock = data.get("stock")
        barcode = data.get("barcode")

        cur.execute("""
            UPDATE inventory
            SET product_name = %s, category = %s, price = %s, stock = %s, barcode = %s
            WHERE id = %s AND shop_id = %s
        """, (name, category, price, stock, barcode, item_id, user_id))

        conn.commit()
        return jsonify({"message": "Product updated successfully"}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# UPDATE STOCK ONLY (Keep for backwards compatibility)
# ─────────────────────────────────────────────
@inventory_bp.route("/inventory/update-stock", methods=["PUT"])
@token_required
def update_stock(user_id):
    data = request.json

    conn = get_connection()
    cur = conn.cursor()

    try:
        if "id" not in data:
            return jsonify({"error": "Missing field: id"}), 400
        if "stock" not in data:
            return jsonify({"error": "Missing field: stock"}), 400

        item_id = data["id"]
        stock = data["stock"]

        cur.execute("""
            UPDATE inventory
            SET stock = %s
            WHERE id = %s AND shop_id = %s
        """, (stock, item_id, user_id))

        conn.commit()

        return jsonify({"message": "Stock updated"}), 200


    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# DELETE PRODUCT
# ─────────────────────────────────────────────
@inventory_bp.route("/inventory/<int:item_id>", methods=["DELETE"])
@token_required
def delete_inventory_item(user_id, item_id):
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            DELETE FROM inventory
            WHERE id = %s AND shop_id = %s
        """, (item_id, user_id))

        conn.commit()

        return jsonify({"message": "Product removed"}), 200

    finally:
        cur.close()
        conn.close()
