
import os
try:
    from ai_edge_litert import interpreter as tflite
    _tflite_source = "ai_edge_litert"
except ImportError:
    try:
        import tflite_runtime.interpreter as tflite
        _tflite_source = "tflite_runtime"
    except ImportError:
        import tensorflow as tf
        tflite = tf.lite
        _tflite_source = "tensorflow"

import numpy as np

MODEL_PATH = "fmcg_classifier.tflite"

print(f"Testing TFLite loading {MODEL_PATH} via {_tflite_source}")

try:
    interpreter = tflite.Interpreter(model_path=MODEL_PATH)
    interpreter.allocate_tensors()
    print("Success: Model loaded and tensors allocated.")
except Exception as e:
    print(f"Error: {e}")
