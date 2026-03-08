import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import AppText from "../components/AppText";
import api from "../api/api";

export default function ScanScreen({ navigation, route }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [barcodeMode, setBarcodeMode] = useState(false);
  const [barcodeBuffer, setBarcodeBuffer] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  // Stable refs — avoid stale closure problems in the scan loop
  const isAnalyzingRef = useRef(false);
  const isLockedRef = useRef(false);
  const barcodeModeRef = useRef(false);
  const cameraReadyRef = useRef(false);
  const cameraRef = useRef(null);

  // Keep refs in sync with state so the scan loop always reads fresh values
  useEffect(() => { isLockedRef.current = isLocked; }, [isLocked]);
  useEffect(() => { barcodeModeRef.current = barcodeMode; }, [barcodeMode]);
  useEffect(() => { cameraReadyRef.current = cameraReady; }, [cameraReady]);

  // ─── AI Product Identification via backend /classify ──────────────────────
  const runInference = useCallback(async () => {
    if (
      !cameraRef.current ||
      !cameraReadyRef.current ||
      isAnalyzingRef.current ||
      isLockedRef.current ||
      barcodeModeRef.current
    ) return;

    isAnalyzingRef.current = true;
    setIsAnalyzing(true);

    try {
      // Capture photo
      const photo = await cameraRef.current.takePictureAsync({
        base64: false,
        skipProcessing: true,
      });

      // Resize to 224x224 and get base64 (sent to backend for proper decoding)
      const resized = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 224, height: 224 } }],
        { format: "jpeg", base64: true }
      );

      // Send to backend — Python PIL does the correct JPEG decode + normalize
      const res = await api.post("/classify", { image: resized.base64 });
      const { productName, confidence } = res.data;

      setPrediction({ productName, confidence });

      if (confidence >= 0.85) {
        setIsLocked(true);
        isLockedRef.current = true;
      }
    } catch (e) {
      // Silently skip transient camera / network errors
      console.log("Scan attempt skipped:", e?.message);
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }, []);

  // ─── Continuous scanning loop ──────────────────────────────────────
  // Starts 2s after the camera is ready, waits for each capture before the next
  useEffect(() => {
    if (barcodeMode || isLocked || !cameraReady) return;

    let active = true;
    const loop = async () => {
      // Give camera 2 s to fully settle (autofocus, exposure)
      await new Promise((res) => setTimeout(res, 2000));
      while (active && !isLockedRef.current && !barcodeModeRef.current) {
        await runInference();
        await new Promise((res) => setTimeout(res, 1200));
      }
    };
    loop();

    return () => { active = false; };
  }, [barcodeMode, isLocked, cameraReady, runInference]);

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

  // ─── NEW State for Barcode Cart ───────────────────────────────────────────
  const [scannedItems, setScannedItems] = useState([]);

  const [torchOn, setTorchOn] = useState(false);
  const [verificationProgress, setVerificationProgress] = useState({ active: false, count: 0 });

  // ─── Barcode scan handler ─────────────────────────────────────────────────
  const handleBarcodeScanned = async ({ data }) => {
    if (!barcodeMode || !data || isAnalyzing) return;

    const newBuffer = [...barcodeBuffer, data].slice(-5);
    setBarcodeBuffer(newBuffer);
    setVerificationProgress({ active: true, count: newBuffer.length });

    if (newBuffer.length === 5 && newBuffer.every((val) => val === data)) {
      setBarcodeBuffer([]);
      setVerificationProgress({ active: false, count: 0 });
      setIsAnalyzing(true); // Re-use this flag for locking camera temporarily

      try {
        if (route?.params?.mode === "inventory") {
          route.params.onScan(data);
          navigation.goBack();
          return;
        }

        // Lookup product
        const res = await api.post("/inventory/barcode-lookup", { barcode: data });
        if (res.data.found) {
          const prod = res.data.product;

          setScannedItems((prev) => {
            const existing = prev.find(item => item.barcode === prod.barcode);
            if (existing) {
              // Product is already in the list, don't auto-increment
              return prev;
            } else {
              return [...prev, {
                productName: prod.name,
                category: prod.category,
                price: Number(prod.price),
                stock: prod.stock,
                barcode: prod.barcode,
                qty: 1
              }];
            }
          });
        } else {
          Alert.alert(
            "Product Not Found",
            res.data.message || "No product with this barcode exists."
          );
        }
      } catch (err) {
        console.log("Barcode lookup error:", err.response?.data?.error || err.message);
        Alert.alert("Lookup Failed", "Could not fetch product details.");
      } finally {
        setTimeout(() => setIsAnalyzing(false), 800); // Temporary cooldown before next scan
      }
    }
  };

  const handleQuantityChange = (barcode, delta) => {
    setScannedItems((prev) => {
      return prev.map(item => {
        if (item.barcode === barcode) {
          const newQty = item.qty + delta;

          // Prevent going above max stock
          if (delta > 0 && item.stock !== null && newQty > item.stock) {
            Alert.alert("Max Stock", `Only ${item.stock} items available in inventory.`);
            return item;
          }

          return { ...item, qty: newQty > 0 ? newQty : 0 };
        }
        return item;
      }).filter(item => item.qty > 0);
    });
  };

  const handleReviewOrder = () => {
    if (scannedItems.length === 0) return;

    // Convert array format to how ConfirmProduct expects it
    const predictionObj = {
      productName: scannedItems[0].productName, // Legacy prop for compatibility
      cart: scannedItems,
      confidence: 1.0,
    };

    navigation.navigate("ConfirmProduct", {
      prediction: predictionObj,
      isCartFlow: true // newly added flag for target screen to handle array logic
    });
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
  const isDetected = isLocked && !barcodeMode;
  const cornerColor = isDetected ? "#2EFF00" : "#FFFFFF";

  return (
    <View style={styles.container}>
      {/* Camera */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        enableTorch={torchOn}
        onCameraReady={() => setCameraReady(true)}
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

      {/* Flashlight Toggle (Barcode Only) */}
      {barcodeMode && (
        <TouchableOpacity
          style={[styles.torchBtn, torchOn && styles.torchBtnActive]}
          onPress={() => setTorchOn(!torchOn)}
        >
          <AppText style={{ color: torchOn ? "#000" : "#FFF", fontSize: 18 }}>
            {torchOn ? "🔦" : "🔦"}
          </AppText>
        </TouchableOpacity>
      )}

      {/* Scanner Frame */}
      <View style={[styles.scannerFrame, barcodeMode && styles.scannerFrameBarcode]}>
        <View style={[styles.corner, styles.topLeft, { borderColor: cornerColor }]} />
        <View style={[styles.corner, styles.topRight, { borderColor: cornerColor }]} />
        <View style={[styles.corner, styles.bottomLeft, { borderColor: cornerColor }]} />
        <View style={[styles.corner, styles.bottomRight, { borderColor: cornerColor }]} />
      </View>

      {/* Mode Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleBtn, !barcodeMode && styles.toggleActive]}
          onPress={() => { setBarcodeMode(false); setPrediction(null); setBarcodeBuffer([]); setIsLocked(false); }}
        >
          <AppText style={[styles.toggleText, !barcodeMode && styles.toggleTextActive]}>
            Product Scan
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, barcodeMode && styles.toggleActive]}
          onPress={() => { setBarcodeMode(true); setPrediction(null); setBarcodeBuffer([]); setIsLocked(false); }}
        >
          <AppText style={[styles.toggleText, barcodeMode && styles.toggleTextActive]}>
            Barcode
          </AppText>
        </TouchableOpacity>
      </View>

      {/* ─── Verification Overlay (Barcode Mode Only) ─── */}
      {barcodeMode && verificationProgress.active && (
        <View style={styles.verificationOverlay}>
          <AppText style={styles.verificationText}>
            Verifying {verificationProgress.count}/5
          </AppText>
        </View>
      )}

      {/* Bottom sheet */}
      <View style={[styles.bottomSheet, barcodeMode && styles.bottomSheetCart]}>
        {barcodeMode ? (
          <View style={styles.cartContainer}>
            {/* Header */}
            <View style={styles.cartHeader}>
              <View>
                <AppText font="semibold" style={styles.cartTitle}>Scanned Items</AppText>
                <AppText style={styles.cartSubtitle}>{scannedItems.length} {scannedItems.length === 1 ? 'item' : 'items'} total</AppText>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <AppText style={styles.totalLabel}>TOTAL PRICE</AppText>
                <AppText font="bold" style={styles.totalValue}>
                  ₹{scannedItems.reduce((acc, curr) => acc + (curr.price * curr.qty), 0).toFixed(2)}
                </AppText>
              </View>
            </View>

            {/* List */}
            <ScrollView showsVerticalScrollIndicator={false} style={styles.cartList}>
              {scannedItems.length === 0 ? (
                <AppText style={styles.emptyCartText}>
                  Point camera at a barcode to scan.
                </AppText>
              ) : (
                scannedItems.map((item, idx) => (
                  <View key={item.barcode + idx} style={styles.cartItem}>
                    <View style={{ flex: 1 }}>
                      <AppText font="semibold" style={styles.itemName}>{item.productName}</AppText>
                      <AppText style={styles.itemPrice}>₹{item.price.toFixed(2)}</AppText>
                    </View>

                    {/* Quantity controls */}
                    <View style={styles.qtyBox}>
                      <TouchableOpacity onPress={() => handleQuantityChange(item.barcode, -1)} style={styles.qtyBtn}>
                        <AppText style={styles.qtyBtnText}>-</AppText>
                      </TouchableOpacity>
                      <AppText font="semibold" style={styles.qtyVal}>{item.qty}</AppText>
                      <TouchableOpacity onPress={() => handleQuantityChange(item.barcode, 1)} style={styles.qtyBtn}>
                        <AppText style={styles.qtyBtnText}>+</AppText>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Review Button */}
            <TouchableOpacity
              style={[styles.reviewBtn, scannedItems.length === 0 && styles.reviewBtnDisabled]}
              onPress={handleReviewOrder}
              disabled={scannedItems.length === 0}
            >
              <AppText font="semibold" style={styles.reviewBtnText}>Review Order</AppText>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <AppText font="regular" style={styles.detected}>
              {isLocked ? "Detected" : "Scanning..."}
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
              style={[styles.scanBtn, !isLocked && styles.scanBtnDisabled]}
              onPress={isLocked ? handleConfirm : null}
              disabled={!isLocked}
            >
              <Image
                source={require("../../assets/icons/Scan.png")}
                style={styles.scanIcon}
              />
            </TouchableOpacity>

            <View style={styles.fallback}>
              {prediction && (
                <AppText style={styles.wrong}>
                  Not this product?
                </AppText>
              )}
              <TouchableOpacity
                onPress={() => { setBarcodeMode(true); setPrediction(null); setIsLocked(false); }}
              >
                <AppText font="semibold" style={styles.manual}>
                  Switch to Barcode Scan
                </AppText>
              </TouchableOpacity>
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
  scannerFrameBarcode: {
    top: undefined, // Strip the generic top
    bottom: "55%",  // Mount right precisely upon the top of the 55% bottom sheet
    height: "25%",
  },

  torchBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  torchBtnActive: {
    backgroundColor: "#FFD700",
    borderColor: "#FFF",
  },
  corner: { width: 24, height: 24, position: "absolute" },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },

  toggleContainer: {
    position: "absolute",
    bottom: "65%",
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

  // ─── NEW: Cart UI Styles ───────────────────────────────────────────────
  bottomSheetCart: {
    paddingTop: 16,
    paddingBottom: 24,
    minHeight: 380,
    maxHeight: "55%",
    justifyContent: "flex-start",
  },
  cartContainer: { flex: 1 },
  cartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EAEAEA",
  },
  cartTitle: { fontSize: 18, color: "#111" },
  cartSubtitle: { fontSize: 12, color: "#666", marginTop: 2 },
  totalLabel: { fontSize: 10, color: "#666", fontWeight: "700", letterSpacing: 0.5 },
  totalValue: { fontSize: 18, color: "#2254C5", marginTop: 2 },

  cartList: { flex: 1, paddingBottom: 10 },
  emptyCartText: { textAlign: "center", color: "#999", marginTop: 40, fontStyle: "italic" },

  cartItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  itemName: { fontSize: 15, color: "#222", marginBottom: 4 },
  itemPrice: { fontSize: 13, color: "#666" },

  qtyBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7F8FA",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EAEAEA",
  },
  qtyBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  qtyBtnText: { fontSize: 18, color: "#555", fontWeight: "600", lineHeight: 20 },
  qtyVal: { fontSize: 15, paddingHorizontal: 4, minWidth: 20, textAlign: "center" },

  reviewBtn: {
    backgroundColor: "#2254C5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 10,
  },
  reviewBtnDisabled: { backgroundColor: "#B0C4DE" },
  reviewBtnText: { color: "#fff", fontSize: 16 },

  verificationOverlay: {
    position: "absolute",
    top: "10%",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    zIndex: 20,
  },
  verificationText: { color: "#FFF", fontWeight: "600", fontSize: 13 },
});