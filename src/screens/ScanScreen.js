import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from "react-native-vision-camera";
import { useResizePlugin } from "vision-camera-resize-plugin";
import { useTensorflowModel } from "react-native-fast-tflite";
import { useRunOnJS } from "react-native-worklets-core";
import AppText from "../components/AppText";
import classNames from "../data/class_names.json";

// Model input dimensions (224×224 RGB)
const INPUT_SIZE = 224;
const NUM_CLASSES = classNames.length; // 50

export default function ScanScreen({ navigation, route }) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");

  const [prediction, setPrediction] = useState(null);

  // Load the TFLite model from assets
  const model = useTensorflowModel(
    require("../../assets/models/fmcg_classifier.tflite")
  );
  const isModelReady = model.state === "loaded";

  // Resize plugin for frame processor
  const { resize } = useResizePlugin();

  // Request camera permission on mount
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // ─── Bridge: worklet → JS thread ──────────────────────────────────────────
  const updatePrediction = useRunOnJS(
    (name, conf) => {
      setPrediction({ productName: name, confidence: conf });
    },
    []
  );

  // ─── Frame Processor ──────────────────────────────────────────────────────
  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      if (model.state !== "loaded" || !model.model) return;

      // 1. Resize frame to 224×224 RGB uint8
      const resized = resize(frame, {
        scale: { width: INPUT_SIZE, height: INPUT_SIZE },
        pixelFormat: "rgb",
        dataType: "uint8",
      });

      // 2. Run model synchronously on the worklet thread
      const outputs = model.model.runSync([resized]);
      const output = outputs[0];

      // 3. Find argmax (highest confidence class)
      let maxIdx = 0;
      let maxVal = output[0];
      for (let i = 1; i < output.length; i++) {
        if (output[i] > maxVal) {
          maxVal = output[i];
          maxIdx = i;
        }
      }

      // 4. Apply softmax to get proper confidence
      let maxRaw = output[0];
      for (let i = 1; i < output.length; i++) {
        if (output[i] > maxRaw) maxRaw = output[i];
      }
      let sumExp = 0;
      for (let i = 0; i < output.length; i++) {
        sumExp += Math.exp(output[i] - maxRaw);
      }
      const confidence = Math.exp(output[maxIdx] - maxRaw) / sumExp;

      // 5. Look up class name and send to JS thread
      const name = classNames[maxIdx] || "Unknown";
      updatePrediction(name, confidence);
    },
    [model, resize, updatePrediction]
  );

  // ─── Confirm current ML prediction ────────────────────────────────────────
  const handleConfirm = () => {
    if (!prediction) return;
    navigation.navigate("ConfirmProduct", {
      prediction: {
        productName: prediction.productName,
        category: "",
        confidence: prediction.confidence,
      },
    });
  };

  // ─── Permission gates ─────────────────────────────────────────────────────
  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <AppText>Camera permission required</AppText>
        <TouchableOpacity onPress={requestPermission}>
          <AppText style={{ color: "#2254C5" }}>Grant Permission</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <AppText>No camera device found</AppText>
      </View>
    );
  }

  // ─── UI ───────────────────────────────────────────────────────────────────
  const confidencePct = prediction
    ? `${Math.round(prediction.confidence * 100)}%`
    : null;

  const isDetected = !!prediction;
  const cornerColor = isDetected ? "#2EFF00" : "#FFFFFF";

  return (
    <View style={styles.container}>
      {/* Camera */}
      <Camera
        style={styles.camera}
        device={device}
        isActive={true}
        frameProcessor={isModelReady ? frameProcessor : undefined}
        pixelFormat="yuv"
      />

      {/* Close button */}
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => navigation.navigate("Main", { screen: "Dashboard" })}
      >
        <AppText style={{ fontSize: 18 }}>✕</AppText>
      </TouchableOpacity>

      {/* Scanner Frame — turns green when product detected */}
      <View style={styles.scannerFrame}>
        <View
          style={[styles.corner, styles.topLeft, { borderColor: cornerColor }]}
        />
        <View
          style={[
            styles.corner,
            styles.topRight,
            { borderColor: cornerColor },
          ]}
        />
        <View
          style={[
            styles.corner,
            styles.bottomLeft,
            { borderColor: cornerColor },
          ]}
        />
        <View
          style={[
            styles.corner,
            styles.bottomRight,
            { borderColor: cornerColor },
          ]}
        />
      </View>

      {/* Barcode Toggle */}
      <TouchableOpacity
        style={styles.barcodeBtn}
        onPress={() => navigation.navigate("BarcodeScanner")}
      >
        <AppText style={{ color: "#fff", fontWeight: "600" }}>
          Scan Barcode
        </AppText>
      </TouchableOpacity>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        {/* Model loading state */}
        {!isModelReady ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#2254C5" />
            <AppText style={styles.loadingText}>Loading model…</AppText>
          </View>
        ) : (
          <>
            <AppText font="regular" style={styles.detected}>
              {prediction ? "Detected" : "Point camera at a product"}
            </AppText>

            <AppText font="semibold" style={styles.product}>
              {prediction ? prediction.productName : "—"}
            </AppText>

            {prediction && (
              <AppText font="regular" style={styles.confidence}>
                Confidence: {confidencePct}
              </AppText>
            )}

            {/* Confirm button */}
            <TouchableOpacity
              style={[styles.scanBtn, !prediction && styles.scanBtnDisabled]}
              onPress={handleConfirm}
              disabled={!prediction}
            >
              <Image
                source={require("../../assets/icons/Scan.png")}
                style={styles.scanIcon}
              />
            </TouchableOpacity>

            <View style={styles.fallback}>
              <AppText style={styles.wrong}>Wrong Product?</AppText>
              <AppText font="semibold" style={styles.manual}>
                Use Barcode Above
              </AppText>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },

  closeBtn: {
    position: "absolute",
    top: 50,
    left: 20,
    backgroundColor: "#fff",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },

  barcodeBtn: {
    position: "absolute",
    bottom: "35%",
    alignSelf: "center",
    backgroundColor: "#3A6FF7",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    zIndex: 10,
  },

  scannerFrame: {
    position: "absolute",
    top: "15%",
    left: "10%",
    width: "80%",
    height: "45%",
  },

  corner: {
    width: 24,
    height: 24,
    position: "absolute",
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },

  bottomSheet: {
    backgroundColor: "#F9F6EE",
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 10,
  },
  loadingText: { color: "#555", marginLeft: 8 },

  detected: { textAlign: "center", color: "#808080", marginBottom: 4 },
  product: { fontSize: 18, textAlign: "center", marginBottom: 2 },
  confidence: {
    textAlign: "center",
    color: "#2254C5",
    marginBottom: 14,
    fontSize: 13,
  },

  scanBtn: {
    alignSelf: "center",
    backgroundColor: "#2254C5",
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  scanBtnDisabled: { backgroundColor: "#aaa" },
  scanIcon: { width: 50, height: 50, tintColor: "#fff" },

  fallback: { alignItems: "center" },
  wrong: { color: "#808080" },
  manual: { marginTop: 4 },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});