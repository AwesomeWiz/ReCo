import React, { useState, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { useTensorflowModel } from "react-native-fast-tflite";
import AppText from "../components/AppText";
import classNames from "../data/class_names.json";

export default function ScanScreen({ navigation, route }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [barcodeMode, setBarcodeMode] = useState(false);
  const [barcodeBuffer, setBarcodeBuffer] = useState([]);
  const cameraRef = useRef(null);

  const model = useTensorflowModel(
    require("../../assets/models/fmcg_classifier.tflite")
  );
  const isModelReady = model.state === "loaded";

  // ─── AI Product Identification ───────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isAnalyzing || !isModelReady) return;
    setIsAnalyzing(true);
    setPrediction(null);

    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: false });

      const resized = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 224, height: 224 } }],
        { format: "jpeg", base64: true }
      );

      const b64 = resized.base64;
      const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

      const inputData = new Float32Array(224 * 224 * 3);
      let pixelIdx = 0;
      for (let i = 0; i < raw.length; i += 4) {
        inputData[pixelIdx++] = raw[i] / 255;
        inputData[pixelIdx++] = raw[i + 1] / 255;
        inputData[pixelIdx++] = raw[i + 2] / 255;
      }

      const outputs = model.model.runSync([inputData]);
      const scores = outputs[0];

      let maxIdx = 0;
      let maxVal = scores[0];
      for (let i = 1; i < scores.length; i++) {
        if (scores[i] > maxVal) { maxVal = scores[i]; maxIdx = i; }
      }

      let maxRaw = scores[0];
      for (let i = 1; i < scores.length; i++) {
        if (scores[i] > maxRaw) maxRaw = scores[i];
      }
      let sumExp = 0;
      for (let i = 0; i < scores.length; i++) { sumExp += Math.exp(scores[i] - maxRaw); }
      const confidence = Math.exp(scores[maxIdx] - maxRaw) / sumExp;

      const name = classNames[maxIdx] || "Unknown";
      setPrediction({ productName: name, confidence });
    } catch (e) {
      Alert.alert("Analysis Error", "Failed to analyze the photo. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, isModelReady, model]);

  // ─── Confirm prediction → navigate ───────────────────────────────────────
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

  // ─── Barcode scan handler ─────────────────────────────────────────────────
  const handleBarcodeScanned = ({ data }) => {
    if (!barcodeMode || !data) return;

    const newBuffer = [...barcodeBuffer, data].slice(-5);
    setBarcodeBuffer(newBuffer);

    if (newBuffer.length === 5 && newBuffer.every((val) => val === data)) {
      setBarcodeBuffer([]);

      if (route?.params?.mode === "inventory") {
        route.params.onScan(data);
        navigation.goBack();
        return;
      }

      navigation.navigate("ConfirmProduct", { barcode: data });
    }
  };

  // ─── Permission gates ─────────────────────────────────────────────────────
  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <AppText>Camera permission required</AppText>
        <TouchableOpacity onPress={requestPermission}>
          <AppText style={{ color: "#2254C5", marginTop: 10 }}>Grant Permission</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  const confidencePct = prediction ? `${Math.round(prediction.confidence * 100)}%` : null;
  const isDetected = !!prediction && !barcodeMode;
  const cornerColor = isDetected ? "#2EFF00" : "#FFFFFF";

  return (
    <View style={styles.container}>
      {/* Camera */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onBarcodeScanned={barcodeMode ? handleBarcodeScanned : undefined}
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"] }}
      />

      {/* Close button */}
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => navigation.navigate("Main", { screen: "Dashboard" })}
      >
        <AppText style={{ fontSize: 18 }}>✕</AppText>
      </TouchableOpacity>

      {/* Scanner Frame */}
      <View style={styles.scannerFrame}>
        <View style={[styles.corner, styles.topLeft, { borderColor: cornerColor }]} />
        <View style={[styles.corner, styles.topRight, { borderColor: cornerColor }]} />
        <View style={[styles.corner, styles.bottomLeft, { borderColor: cornerColor }]} />
        <View style={[styles.corner, styles.bottomRight, { borderColor: cornerColor }]} />
      </View>

      {/* Mode Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleBtn, !barcodeMode && styles.toggleActive]}
          onPress={() => { setBarcodeMode(false); setPrediction(null); setBarcodeBuffer([]); }}
        >
          <AppText style={[styles.toggleText, !barcodeMode && styles.toggleTextActive]}>
            Product Scan
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, barcodeMode && styles.toggleActive]}
          onPress={() => { setBarcodeMode(true); setPrediction(null); setBarcodeBuffer([]); }}
        >
          <AppText style={[styles.toggleText, barcodeMode && styles.toggleTextActive]}>
            Barcode
          </AppText>
        </TouchableOpacity>
      </View>

      {/* Bottom sheet */}
      <View style={styles.bottomSheet}>
        {barcodeMode ? (
          <View style={styles.barcodeModeInfo}>
            <AppText font="semibold" style={styles.product}>Align barcode within the frame</AppText>
            <AppText font="regular" style={styles.detected}>Scanning happens automatically</AppText>
            <AppText font="regular" style={{ color: "#2254C5", marginTop: 10, fontSize: 13 }}>
              Verification: {barcodeBuffer.length}/3
            </AppText>
          </View>
        ) : !isModelReady ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#2254C5" />
            <AppText style={styles.loadingText}>Loading model…</AppText>
          </View>
        ) : (
          <>
            <AppText font="regular" style={styles.detected}>
              {isAnalyzing ? "Analyzing…" : prediction ? "Detected" : "Point camera at a product"}
            </AppText>

            <AppText font="semibold" style={styles.product}>
              {prediction ? prediction.productName : "—"}
            </AppText>

            {prediction && (
              <AppText font="regular" style={styles.confidence}>
                Confidence: {confidencePct}
              </AppText>
            )}

            {/* Capture / Confirm button */}
            <TouchableOpacity
              style={[styles.scanBtn, (isAnalyzing || !isModelReady) && styles.scanBtnDisabled]}
              onPress={prediction ? handleConfirm : handleCapture}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : (
                <Image
                  source={require("../../assets/icons/Scan.png")}
                  style={styles.scanIcon}
                />
              )}
            </TouchableOpacity>

            <View style={styles.fallback}>
              <AppText style={styles.wrong}>
                {prediction ? "Not this product?" : "Wrong Product?"}
              </AppText>
              <AppText
                font="semibold"
                style={styles.manual}
                onPress={() => { setBarcodeMode(true); setPrediction(null); }}
              >
                Switch to Barcode Scan
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

  scannerFrame: {
    position: "absolute",
    top: "15%",
    left: "10%",
    width: "80%",
    height: "45%",
  },
  corner: { width: 24, height: 24, position: "absolute" },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },

  toggleContainer: {
    position: "absolute",
    bottom: "33%",
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 25,
    padding: 4,
    zIndex: 10,
  },
  toggleBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
  toggleActive: { backgroundColor: "#2254C5" },
  toggleText: { color: "#ccc", fontWeight: "600" },
  toggleTextActive: { color: "#fff" },

  bottomSheet: {
    backgroundColor: "#F9F6EE",
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 220,
    justifyContent: "center",
  },
  barcodeModeInfo: { alignItems: "center", justifyContent: "center" },

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
  confidence: { textAlign: "center", color: "#2254C5", marginBottom: 14, fontSize: 13 },

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
  manual: { marginTop: 4, color: "#2254C5" },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});