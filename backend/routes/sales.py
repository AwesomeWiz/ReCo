from flask import Blueprint, request, jsonify
from db import get_connection
from utils.jwt_auth import token_required

sales_bp = Blueprint("sales", __name__)


@sales_bp.route("/sale", methods=["POST"])
@token_required
def record_sale(user_id):
    data = request.json

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
                total
            )
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            user_id,
            product_name,
            category,
            price,
            quantity,
            total
        ))

        conn.commit()
        return jsonify({"message": "Sale recorded successfully"}), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        cur.close()
        conn.close()
