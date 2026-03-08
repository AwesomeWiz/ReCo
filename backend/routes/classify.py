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

def _load_model():
    global _interpreter, _label_mapping, _class_names

    if not os.path.exists(MODEL_PATH):
        print(f"[classify] WARNING: Model not found at {MODEL_PATH}")
        return

    if tflite is None:
        print("[classify] WARNING: No TFLite runtime available.")
        return

    try:
        _interpreter = tflite.Interpreter(model_path=MODEL_PATH)
        _interpreter.allocate_tensors()
        print(f"[classify] Model loaded from {MODEL_PATH} via {_tflite_source}")
    except Exception as e:
        print(f"[classify] ERROR loading model: {e}")
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

_load_model()


# ─── /classify endpoint ───────────────────────────────────────────────────────
@classify_bp.route("/classify", methods=["POST"])
@token_required
def classify_product(user_id):
    """
    Body: { "image": "<base64>" }
    Returns inventory details if product is found in shop's stock.
    """
    if _interpreter is None:
        return jsonify({"error": "Model not loaded"}), 503

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

        # 3. Map Index to Name
        # Based on analysis, Model Index i matches labelMapping Key str(i)
        # However, labelMapping starts at "1", and class_names[1] matches Key "1"
        # So it's safe to assume: name = mapping[str(best_idx)]
        identifer = str(best_idx)
        display_name = _label_mapping.get(identifer)
        
        # Fallback to slugs if mapping is missing
        if not display_name:
             display_name = _class_names[best_idx] if best_idx < len(_class_names) else f"Product_{best_idx}"
             # Clean up underscores for searching if needed
             display_name = display_name.replace("_", " ")

        # 4. Inventory Lookup (Database source of truth)
        conn = get_connection()
        cur = conn.cursor()
        
        # We search by name. The identified display_name should match product_name in inventory.
        cur.execute("""
            SELECT product_name, category, price, stock, barcode
            FROM inventory
            WHERE shop_id = %s AND product_name = %s
            LIMIT 1
        """, (user_id, display_name))
        
        inv_item = cur.fetchone()
        cur.close()
        conn.close()

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
                "productName": inv_item["product_name"], # Use exact DB name
                "price": float(inv_item["price"]),
                "category": inv_item["category"],
                "stock": inv_item["stock"],
                "barcode": inv_item["barcode"]
            })

        print(f"[classify] shop:{user_id} pred:{display_name} ({confidence:.2f}) inInv:{result['inInventory']}")

        return jsonify(result)

    except Exception as e:
        print(f"[classify] error: {e}")
        return jsonify({"error": str(e)}), 500
