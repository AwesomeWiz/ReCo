from functools import wraps
from flask import request, jsonify
import jwt

SECRET_KEY = "reco_secret_key"


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        # Read Authorization header
        auth_header = request.headers.get("Authorization")

        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

        if not token:
            return jsonify({"message": "Token missing"}), 401

        try:
            decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            user_id = decoded["user_id"]
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "Invalid token"}), 401

        return f(user_id, *args, **kwargs)

    return decorated
