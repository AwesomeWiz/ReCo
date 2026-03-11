
try:
    import tensorflow as tf
    print(f"TensorFlow version: {tf.__version__}")
except ImportError:
    print("TensorFlow not installed")

try:
    import ai_edge_litert.interpreter as tflite
    print("ai_edge_litert is available")
except ImportError:
    print("ai_edge_litert not installed")

try:
    import tflite_runtime.interpreter as tflite
    print("tflite_runtime is available")
except ImportError:
    print("tflite_runtime not installed")
