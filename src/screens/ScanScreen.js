import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useTensorflowModel } from "react-native-fast-tflite";
import AppText from "../components/AppText";
import { classifyOutput } from "../utils/classifyProduct";

// Model input dimensions (MobileNet-style 224×224 RGB)
const INPUT_SIZE = 224;
// How often to run inference (ms)
const INFERENCE_INTERVAL = 800;

export default function ScanScreen({ navigation, route }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [barcodeMode, setBarcodeMode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [prediction, setPrediction] = useState(null);

  const cameraRef = useRef(null);
  const inferenceActive = useRef(false);
  const intervalRef = useRef(null);

  // Load the TFLite model from assets
  const model = useTensorflowModel(
    require("../../assets/models/retail_classifier_quantized.tflite")
  );

  const isModelReady = model.state === "loaded";

  // ─── Inference Loop ───────────────────────────────────────────────────────
  const runInference = useCallback(async () => {
    if (!isModelReady || !cameraRef.current || inferenceActive.current) return;

    inferenceActive.current = true;
    try {
      // 1. Capture a frame from the camera
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.3,       // low quality is fine — we resize anyway
        skipProcessing: true,
        exif: false,
      });

      // 2. Resize to model input size
      const resized = await manipulateAsync(
        photo.uri,
        [{ resize: { width: INPUT_SIZE, height: INPUT_SIZE } }],
        { base64: true, format: SaveFormat.JPEG }
      );

      // 3. Decode base64 → Uint8Array of RGB pixels
      const base64Data = resized.base64;
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // 4. Build Uint8Array input tensor for quantized model
      //    Quantized models expect uint8 values (0-255), shape [1, 224, 224, 3]
      const pixelCount = INPUT_SIZE * INPUT_SIZE * 3;
      const inputTensor = new Uint8Array(pixelCount);

      // Use the last pixelCount bytes of the JPEG as pixel approximation
      const startOffset = Math.max(0, bytes.length - pixelCount);
      for (let i = 0; i < pixelCount; i++) {
        inputTensor[i] = bytes[startOffset + i] ?? 0;
      }

      // 5. Run model
      const outputs = await model.model.run([inputTensor]);

      // 6. Classify output
      const result = classifyOutput(outputs[0]);
      setPrediction(result);

    } catch (err) {
      // Silently ignore individual frame errors (camera not ready yet, etc.)
      console.log("[Inference] frame error:", err.message);
    } finally {
      inferenceActive.current = false;
    }
  }, [isModelReady, model]);

  // Start/stop the inference loop when model becomes ready
  useEffect(() => {
    if (!isModelReady) return;

    intervalRef.current = setInterval(runInference, INFERENCE_INTERVAL);

    return () => {
      clearInterval(intervalRef.current);
      inferenceActive.current = false;
    };
  }, [isModelReady, runInference]);

  // ─── Barcode handler ──────────────────────────────────────────────────────
  const handleBarcodeScanned = ({ data }) => {
    if (isScanning) return;
    setIsScanning(true);
    setBarcodeMode(false);

    if (route?.params?.mode === "inventory") {
      route.params.onScan(data);
      navigation.goBack();
      return;
    }

    navigation.navigate("ConfirmProduct", { barcode: data });
    setTimeout(() => setIsScanning(false), 1000);
  };

  // ─── Confirm current ML prediction ───────────────────────────────────────
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
  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <AppText>Camera permission required</AppText>
        <TouchableOpacity onPress={requestPermission}>
          <AppText style={{ color: "#2254C5" }}>Grant Permission</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── UI ───────────────────────────────────────────────────────────────────
  const confidencePct = prediction
    ? `${Math.round(prediction.confidence * 100)}%`
    : null;

  return (
    <View style={styles.container}>

      {/* Camera */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "code128", "upc_a", "upc_e"],
        }}
        onBarcodeScanned={barcodeMode ? handleBarcodeScanned : undefined}
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
        <View style={[styles.corner, styles.topLeft]} />
        <View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} />
        <View style={[styles.corner, styles.bottomRight]} />
      </View>

      {/* Barcode Toggle */}
      <TouchableOpacity
        style={styles.barcodeBtn}
        onPress={() => setBarcodeMode(true)}
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

  corner: { width: 24, height: 24, borderColor: "#2EFF00", position: "absolute" },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },

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
  manual: { marginTop: 4 },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});