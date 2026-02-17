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
            SELECT id, product_name, category, price, stock
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
# ADD PRODUCT TO INVENTORY
# ─────────────────────────────────────────────
@inventory_bp.route("/inventory/add", methods=["POST"])
@token_required
def add_inventory_item(user_id):
    data = request.json

    product_name = data.get("name")
    category = data.get("category", "")
    price = data["price"]
    stock = data["stock"]

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            INSERT INTO inventory (
                shop_id,
                product_name,
                category,
                price,
                stock
            )
            VALUES (%s, %s, %s, %s, %s)
        """, (user_id, product_name, category, price, stock))

        conn.commit()

        return jsonify({"message": "Product added to inventory"}), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# UPDATE STOCK
# ─────────────────────────────────────────────
@inventory_bp.route("/inventory/update-stock", methods=["PUT"])
@token_required
def update_stock(user_id):
    data = request.json

    item_id = data["id"]
    stock = data["stock"]

    conn = get_connection()
    cur = conn.cursor()

    try:
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
