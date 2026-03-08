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

if tflite and os.path.exists(MODEL_PATH):
    try:
        interpreter = tflite.Interpreter(model_path=MODEL_PATH)
        interpreter.allocate_tensors()
        print("Interpreter: LOADED SUCCESSFULLY")
    except Exception as e:
        print(f"Interpreter: LOAD ERROR: {e}")
else:
    print("Interpreter: CANNOT ATTEMPT LOAD (missing tflite or model file)")

if os.path.exists(CLASS_NAMES_PATH):
    try:
        with open(CLASS_NAMES_PATH, "r") as f:
            names = json.load(f)
        print(f"Class Names: LOADED ({len(names)} classes)")
    except Exception as e:
        print(f"Class Names: LOAD ERROR: {e}")
else:
    print("Class Names: NOT FOUND")
