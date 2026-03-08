import os
import base64
import json
import numpy as np
from io import BytesIO
from flask import Blueprint, request, jsonify

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

# ─── Load model & class names once at import time ────────────────────────────
_BASE = os.path.dirname(__file__)   # routes/
_BACKEND = os.path.dirname(_BASE)   # backend/

MODEL_PATH = os.path.join(_BACKEND, "fmcg_classifier.tflite")
CLASS_NAMES_PATH = os.path.join(_BACKEND, "class_names.json")

_interpreter = None
_class_names = []

def _load_model():
    global _interpreter, _class_names

    if not os.path.exists(MODEL_PATH):
        print(f"[classify] WARNING: Model not found at {MODEL_PATH}")
        return

    if tflite is None:
        print("[classify] WARNING: No TFLite runtime available. Install tflite-runtime or tensorflow.")
        return

    if Image is None:
        print("[classify] WARNING: Pillow not installed. Run: pip install Pillow")
        return

    try:
        _interpreter = tflite.Interpreter(model_path=MODEL_PATH)
        _interpreter.allocate_tensors()
        print(f"[classify] Model loaded from {MODEL_PATH} via {_tflite_source}")
    except Exception as e:
        print(f"[classify] ERROR loading model: {e}")
        _interpreter = None

    if os.path.exists(CLASS_NAMES_PATH):
        with open(CLASS_NAMES_PATH, "r") as f:
            _class_names = json.load(f)
        print(f"[classify] Loaded {len(_class_names)} class names")
    else:
        print(f"[classify] WARNING: class_names.json not found at {CLASS_NAMES_PATH}")

_load_model()


# ─── /classify endpoint ───────────────────────────────────────────────────────
@classify_bp.route("/classify", methods=["POST"])
def classify_product():
    """
    Body: { "image": "<base64-encoded JPEG string>" }
    Returns: { "productName": "...", "confidence": 0.97 }
    """
    if _interpreter is None:
        return jsonify({"error": "Model not loaded on server"}), 503
    if Image is None:
        return jsonify({"error": "Pillow not installed on server"}), 503

    data = request.get_json(silent=True)
    if not data or "image" not in data:
        return jsonify({"error": "Missing 'image' field"}), 400

    try:
        # 1. Decode base64 → raw bytes → PIL Image
        img_bytes = base64.b64decode(data["image"])
        img = Image.open(BytesIO(img_bytes)).convert("RGB")

        # 2. Resize to 224×224 (what the model expects)
        img = img.resize((224, 224), Image.BILINEAR)

        # 3. Normalise to [0, 1] float32
        img_array = np.array(img, dtype=np.float32) / 255.0  # shape: (224, 224, 3)
        img_array = np.expand_dims(img_array, axis=0)         # shape: (1, 224, 224, 3)

        # 4. Run inference
        input_details = _interpreter.get_input_details()
        output_details = _interpreter.get_output_details()
        _interpreter.set_tensor(input_details[0]["index"], img_array)
        _interpreter.invoke()
        scores = _interpreter.get_tensor(output_details[0]["index"])[0]  # (num_classes,)

        # 5. Softmax over raw logits
        scores = scores.astype(np.float64)
        scores -= scores.max()   # numerical stability
        exp_scores = np.exp(scores)
        probs = exp_scores / exp_scores.sum()

        best_idx = int(np.argmax(probs))
        confidence = float(probs[best_idx])
        product_name = _class_names[best_idx] if best_idx < len(_class_names) else f"class_{best_idx}"

        return jsonify({
            "productName": product_name,
            "confidence": confidence,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
