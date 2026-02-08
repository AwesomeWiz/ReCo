from flask import Flask, request, jsonify
from flask_cors import CORS
import bcrypt
from db import get_connection

app = Flask(__name__)
CORS(app)

@app.route("/signup", methods=["POST"])
def signup():
    data = request.json

    store = data["store"]
    phone = data["phone"]
    password = data["password"]
    country = data["country"]
    state = data["state"]

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode("utf-8")

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            INSERT INTO shops(store_name, phone, password_hash, country, state)
            VALUES (%s,%s,%s,%s,%s)
        """, (store, phone, hashed, country, state))

        conn.commit()
        return jsonify({"message": "Signup success"})
    except:
        return jsonify({"message": "Phone already exists"}), 400
    

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    phone = data["phone"]
    password = data["password"]

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM shops WHERE phone=%s", (phone,))
    user = cur.fetchone()

    if not user:
        return jsonify({"message":"User not found"}), 404

    if bcrypt.checkpw(password.encode(), user["password_hash"].encode("utf-8")):
        return jsonify({"message":"Login success"})
    else:
        return jsonify({"message":"Wrong password"}), 401

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

