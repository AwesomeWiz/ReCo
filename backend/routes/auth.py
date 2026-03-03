from flask import Blueprint, request, jsonify
import bcrypt
import jwt
import datetime
from db import get_connection

auth_bp = Blueprint("auth", __name__)

SECRET_KEY = "reco_secret_key"


@auth_bp.route("/signup", methods=["POST"])
def signup():
    data = request.json

    store = data["store"]
    phone = data["phone"]
    password = data["password"]
    country = data["country"]
    state = data["state"]
    district = data.get("district", "")

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode("utf-8")

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            INSERT INTO shops(store_name, phone, password_hash, country, state, district)
            VALUES (%s,%s,%s,%s,%s,%s)
        """, (store, phone, hashed, country, state, district))

        conn.commit()
        return jsonify({"message": "Signup success"})
    except:
        return jsonify({"message": "Phone already exists"}), 400
    finally:
        cur.close()
        conn.close()


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json
    phone = data["phone"]
    password = data["password"]

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM shops WHERE phone=%s", (phone,))
    user = cur.fetchone()

    if not user:
        return jsonify({"message": "User not found"}), 404

    if bcrypt.checkpw(password.encode(), user["password_hash"].encode("utf-8")):

        token = jwt.encode({
            "user_id": user["id"],
            "exp": datetime.datetime.utcnow() + datetime.timedelta(days=30)
        }, SECRET_KEY, algorithm="HS256")

        return jsonify({
            "message": "Login success",
            "token": token,
            "store_name": user["store_name"] or "",
            "state": user["state"] or "",
            "country": user["country"] or "",
            "district": user["district"] or "",
        })

    return jsonify({"message": "Wrong password"}), 401
