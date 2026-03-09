import os
import sys
import json

# Add parent dir to path to simulate import structure if needed
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

print(f"Python Version: {sys.version}")

# PIL
try:
    from PIL import Image
    print("PIL: Installed")
except ImportError:
    print("PIL: NOT INSTALLED")
    Image = None

# TFLite
tflite = None
_tflite_source = None
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

print(f"TFLite Source: {_tflite_source}")

_BACKEND = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(_BACKEND, "fmcg_classifier.tflite")
CLASS_NAMES_PATH = os.path.join(_BACKEND, "class_names.json")

print(f"Model Path: {MODEL_PATH}")
print(f"Model Exists: {os.path.exists(MODEL_PATH)}")

import numpy as np
from io import BytesIO
import base64

def test_inference(interpreter, class_names):
    print("\n--- Testing Mock Inference ---")
    try:
        # 1. Create a dummy white image
        img = Image.new('RGB', (224, 224), color = 'white')
        
        # 2. Mock what happens in classify.py
        buffered = BytesIO()
        img.save(buffered, format="JPEG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        img_bytes = base64.b64decode(img_str)
        decoded_img = Image.open(BytesIO(img_bytes)).convert("RGB")
        decoded_img = decoded_img.resize((224, 224), Image.Resampling.BILINEAR if hasattr(Image, "Resampling") else Image.BILINEAR)
        
        img_array = np.array(decoded_img, dtype=np.float32)
        img_array = np.expand_dims(img_array, axis=0)
        
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()
        
        print(f"Input Details: {input_details}")
        print(f"Output Details: {output_details}")
        
        interpreter.set_tensor(input_details[0]["index"], img_array)
        interpreter.invoke()
        scores = interpreter.get_tensor(output_details[0]["index"])[0]
        
        # 5. Get probabilities (model already has Softmax)
        probs = scores.astype(np.float64)
        
        best_idx = int(np.argmax(probs))
        pred_name = class_names[best_idx] if best_idx < len(class_names) else f"unknown_{best_idx}"
        print(f"Prediction: {pred_name} (Confidence: {probs[best_idx]:.2f})")
        
        # Test with a different color (black)
        print("\n--- Testing Black Image ---")
        img_black = Image.new('RGB', (224, 224), color = 'black')
        img_array_black = np.array(img_black, dtype=np.float32) / 255.0
        img_array_black = np.expand_dims(img_array_black, axis=0)
        interpreter.set_tensor(input_details[0]["index"], img_array_black)
        interpreter.invoke()
        scores_black = interpreter.get_tensor(output_details[0]["index"])[0]
        probs_black = np.exp(scores_black.astype(np.float64) - scores_black.max())
        probs_black /= probs_black.sum()
        best_idx_black = int(np.argmax(probs_black))
        pred_name_black = class_names[best_idx_black] if best_idx_black < len(class_names) else f"unknown_{best_idx_black}"
        print(f"Prediction for dummy black image: {pred_name_black} (Confidence: {probs_black[best_idx_black]:.2f})")
        
    except Exception as e:
        print(f"Inference Test Failed: {e}")
        import traceback
        traceback.print_exc()

if tflite and os.path.exists(MODEL_PATH):
    try:
        interpreter = tflite.Interpreter(model_path=MODEL_PATH)
        interpreter.allocate_tensors()
        print("Interpreter: LOADED SUCCESSFULLY")
        
        class_names = []
        if os.path.exists(CLASS_NAMES_PATH):
            with open(CLASS_NAMES_PATH, "r") as f:
                class_names = json.load(f)
            print(f"Class Names: LOADED ({len(class_names)} classes)")
        
        test_inference(interpreter, class_names)
    except Exception as e:
        print(f"Interpreter: LOAD ERROR: {e}")
else:
    print("Interpreter: CANNOT ATTEMPT LOAD (missing tflite or model file)")
