import os
import base64
import json
import numpy as np
from io import BytesIO
from flask import Blueprint, request, jsonify
from utils.jwt_auth import token_required
from db import get_connection

# PIL for proper JPEG decoding
try:
    from PIL import Image
except ImportError:
    Image = None

# TFLite runtime — try multiple packages in priority order
try:
    import tflite_runtime.interpreter as tflite
    _tflite_source = "tflite_runtime"
except ImportError:
    try:
        from ai_edge_litert import interpreter as tflite
        _tflite_source = "ai_edge_litert"
    except ImportError:
        try:
            import tensorflow as tf
            tflite = tf.lite
            _tflite_source = "tensorflow"
        except ImportError:
            tflite = None
            _tflite_source = None

classify_bp = Blueprint("classify", __name__)

# ─── Load model & mappings once at import time ───────────────────────────────
_BASE = os.path.dirname(__file__)   # routes/
_BACKEND = os.path.dirname(_BASE)   # backend/

MODEL_PATH = os.path.join(_BACKEND, "fmcg_classifier.tflite")
LABEL_MAPPING_PATH = os.path.join(_BACKEND, "labelMapping.json")
CLASS_NAMES_PATH = os.path.join(_BACKEND, "class_names.json") # Fallback or slug mapping

_interpreter = None
_label_mapping = {}
_class_names = []
_load_error = "Not loaded yet"

def _load_model():
    global _interpreter, _label_mapping, _class_names, _load_error
    _load_error = None

    if not os.path.exists(MODEL_PATH):
        _load_error = f"Model file not found at {MODEL_PATH}"
        print(f"[classify] WARNING: {_load_error}")
        return

    if tflite is None:
        _load_error = "No TFLite runtime detected in environment"
        print(f"[classify] WARNING: {_load_error}")
        return

    try:
        _interpreter = tflite.Interpreter(model_path=MODEL_PATH)
        _interpreter.allocate_tensors()
        print(f"[classify] Model loaded from {MODEL_PATH} via {_tflite_source}")
    except Exception as e:
        _load_error = f"Interpreter error: {str(e)}"
        print(f"[classify] ERROR loading model: {_load_error}")
        _interpreter = None

    if os.path.exists(LABEL_MAPPING_PATH):
        with open(LABEL_MAPPING_PATH, "r") as f:
            data = json.load(f)
            _label_mapping = data.get("product_names", {})
        print(f"[classify] Loaded {len(_label_mapping)} display labels")

    if os.path.exists(CLASS_NAMES_PATH):
        with open(CLASS_NAMES_PATH, "r") as f:
            _class_names = json.load(f)
        print(f"[classify] Loaded {len(_class_names)} internal class slugs")


# ─── /classify endpoint ───────────────────────────────────────────────────────
@classify_bp.route("/classify", methods=["POST"])
@token_required
def classify_product(user_id):
    """
    Body: { "image": "<base64>" }
    Returns inventory details if product is found in shop's stock.
    """
    # Lazy-load model on first request (saves startup RAM on Railway free tier)
    if _interpreter is None and _load_error == "Not loaded yet":
        _load_model()

    if _interpreter is None:
        return jsonify({
            "error": "Model not loaded",
            "details": _load_error
        }), 503

    data = request.get_json(silent=True)
    if not data or "image" not in data:
        return jsonify({"error": "Missing image"}), 400

    try:
        # 1. Decode & Preprocess
        img_bytes = base64.b64decode(data["image"])
        img = Image.open(BytesIO(img_bytes)).convert("RGB")
        img = img.resize((224, 224), Image.BILINEAR)
        img_array = np.array(img, dtype=np.float32)
        img_array = np.expand_dims(img_array, axis=0)
        # 2. Inference
        input_details = _interpreter.get_input_details()
        output_details = _interpreter.get_output_details()
        _interpreter.set_tensor(input_details[0]["index"], img_array)
        _interpreter.invoke()
        scores = _interpreter.get_tensor(output_details[0]["index"])[0]

        probs = scores.astype(np.float64)
        best_idx = int(np.argmax(probs))
        confidence = float(probs[best_idx])

        # 3. Map Index to Name using class_names.json (Original Source of Truth for Model)
        slug = _class_names[best_idx] if best_idx < len(_class_names) else f"Product_{best_idx}"
        
        # Convert slug to a searchable/display name (matches inventory names)
        display_name = slug.replace("_", " ")

        # 4. Inventory Lookup (Database source of truth for pricing/availability)
        conn = get_connection()
        cur = conn.cursor()
        
        # Search by the processed name
        cur.execute("""
            SELECT product_name, category, price, stock, barcode
            FROM inventory
            WHERE shop_id = %s AND product_name = %s
            LIMIT 1
        """, (user_id, display_name))
        
        inv_item = cur.fetchone()
        cur.close()
        conn.close()

        # 5. Top 3 Logging (as requested)
        print(f"[classify] Prediction: {display_name} ({confidence:.4f})")
        top_indices = np.argsort(probs)[-3:][::-1]
        for i in top_indices:
            name = _class_names[i] if i < len(_class_names) else f"class_{i}"
            print(f"  - {name}: {probs[i]:.4f}")

        result = {
            "productName": display_name,
            "confidence": confidence,
            "inInventory": False,
            "price": 0,
            "category": "",
            "stock": 0,
            "barcode": None
        }

        if inv_item:
            result.update({
                "inInventory": True,
                "productName": inv_item["product_name"],
                "price": float(inv_item["price"]),
                "category": inv_item["category"],
                "stock": inv_item["stock"],
                "barcode": inv_item["barcode"]
            })

        return jsonify(result)

    except Exception as e:
        print(f"[classify] error: {e}")
        return jsonify({"error": str(e)}), 500
