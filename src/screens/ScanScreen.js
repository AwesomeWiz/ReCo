import React, { useState, useRef, useCallback, useEffect, useContext } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  TextInput,
  FlatList,
  LayoutAnimation,
  Platform,
  UIManager,
  Alert
} from "react-native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import AppText from "../components/AppText";
import api from "../api/api";
import { CartContext } from "../context/CartContext";

export default function ScanScreen({ navigation, route }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [scanMode, setScanMode] = useState("product"); // "product", "barcode", "manual"
  const [barcodeBuffer, setBarcodeBuffer] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const { transactionId, cartItems, setTransactionId, setCartItems, clearCart, selectedDate } = useContext(CartContext);

  // New UI states merged in
  const [searchQuery, setSearchQuery] = useState("");
  const [inventoryList, setInventoryList] = useState([]);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [torchOn, setTorchOn] = useState(false);
  const [verificationProgress, setVerificationProgress] = useState({ active: false, count: 0 });
  const [scannedItems, setScannedItems] = useState([]);


  // Stable refs — avoid stale closure problems in the scan loop
  const isAnalyzingRef = useRef(false);
  const isLockedRef = useRef(false);
  const scanModeRef = useRef("product");
  const cameraReadyRef = useRef(false);
  const cameraRef = useRef(null);

  // Keep refs in sync with state so the scan loop always reads fresh values
  useEffect(() => { isLockedRef.current = isLocked; }, [isLocked]);
  useEffect(() => { scanModeRef.current = scanMode; }, [scanMode]);
  useEffect(() => { cameraReadyRef.current = cameraReady; }, [cameraReady]);


  const switchMode = (newMode) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setScanMode(newMode);
    setPrediction(null);
    setBarcodeBuffer([]);
    setSearchQuery("");
    setIsLocked(false);
    // Reset camera ready so the scan loop doesn't fire during mode transition
    setCameraReady(false);
    cameraReadyRef.current = false;
  };

  // ─── AI Product Identification via backend /classify ──────────────────────
  const runInference = useCallback(async () => {
    if (
      !cameraRef.current ||
      !cameraReadyRef.current ||
      isAnalyzingRef.current ||
      isLockedRef.current ||
      scanModeRef.current !== "product"
    ) return;

    isAnalyzingRef.current = true;
    setIsAnalyzing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1.0,
        shutterSound: false,
      });

      // Resize to 224x224 and get base64 (sent to backend for proper decoding)
      const resized = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 224, height: 224 } }],
        { format: "jpeg", base64: true }
      );

      // Send to backend — Python PIL does the correct JPEG decode + normalize
      const res = await api.post("/classify", { image: resized.base64 });
      setPrediction(res.data);

      const conf = res.data.confidence || 0;
      console.log(`[ScanScreen] Predicted: ${res.data.productName} (${Math.round(conf * 100)}%) | InInv: ${res.data.inInventory}`);

      if (conf >= 0.20) {
        setIsLocked(true);
        isLockedRef.current = true;
      }
    } catch (e) {
      console.log("Scan attempt failed:", e?.message || "Unknown error", e);
      // More informative alert for APK users
      if (e.response) {
        // Backend returned an error (e.g., 503, 500)
        const details = e.response.data?.details || e.response.data?.error || "Check server logs";
        Alert.alert("Server Error", `Scanning service unavailable.\n\nStatus: ${e.response.status}\nDetails: ${details}`);
      } else if (e.request) {
        // No response received (Network error)
        Alert.alert("Connection Error", "Could not reach the server. Please check your internet connection and keep the phone steady.");
      } else {
        // Something else went wrong
        Alert.alert("Scan Error", "An unexpected error occurred during scanning. Please restart the scanner.");
      }
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }, []);

  // ─── Continuous scanning loop ──────────────────────────────────────
  // Starts 2s after the camera is ready, waits for each capture before the next
  useEffect(() => {
    if (scanMode !== "product" || isLocked || !cameraReady) return;

    let active = true;
    const loop = async () => {
      // Give camera 2 s to fully settle (autofocus, exposure)
      await new Promise((res) => setTimeout(res, 2000));
      while (active && !isLockedRef.current && scanModeRef.current === "product") {
        await runInference();
        await new Promise((res) => setTimeout(res, 1200));
      }
    };
    loop();

    return () => { active = false; };
  }, [scanMode, isLocked, cameraReady, runInference]);

  // ─── Sync Cart from Context/Backend ─────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (transactionId) {
        // Fetch current transaction items to keep ScanScreen sync'd
        api.get(`/transactions/${transactionId}`)
          .then(res => {
            const backendItems = res.data.items || [];
            // Map backend items to local scannedItems format
            const mapped = backendItems.map(item => ({
              productName: item.description,
              category: item.category,
              price: item.rate,
              stock: null, // We don't have stock info in transaction items, assume null or fetch separately if needed
              barcode: item.barcode,
              qty: item.qty
            }));
            setScannedItems(mapped);
          })
          .catch(err => console.log("Focus cart fetch error:", err));
      } else {
        // If no active transaction, clear local scanned items
        setScannedItems([]);
      }
    }, [transactionId])
  );

  // ─── Confirm prediction → navigate ───────────────────────────────────────
  const handleConfirm = () => {
    if (!prediction) return;
    setTorchOn(false); // Always turn off torch when leaving scan screen
    navigation.navigate("ConfirmProduct", {
      prediction: prediction,
    });
  };

  const handleRescan = () => {
    setIsLocked(false);
    isLockedRef.current = false;
    setPrediction(null);
  };

  // ─── Search states and logic ──────────────────────────────────────────────
  useEffect(() => {
    if (scanMode === "manual" && inventoryList.length === 0) {
      api.get("/inventory")
        .then(res => {
          setInventoryList(res.data || []);
          setFilteredInventory(res.data || []);
        })
        .catch(err => console.log("Inventory fetch error:", err));
    }
  }, [scanMode]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredInventory(inventoryList);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredInventory(
        inventoryList.filter((item) => {
          const nm = item.name || item.product_name || item.productName || "";
          return nm.toLowerCase().includes(q);
        })
      );
    }
  }, [searchQuery, inventoryList]);

  // ─── Backend Sync Helper ──────────────────────────────────────────────
  const syncWithBackend = async (item, targetQty) => {
    try {
      let activeId = transactionId;
      if (!activeId) {
        const startRes = await api.post("/transactions/start", selectedDate ? { date: selectedDate } : {});
        activeId = startRes.data.transaction_id;
        setTransactionId(activeId);
      }

      console.log(`Syncing ${item.productName}, qty: ${targetQty}`);

      const existingItem = scannedItems.find(i => i.barcode === item.barcode || i.productName === item.productName);

      if (targetQty === 0) {
        await api.post("/transactions/remove-item", {
          transaction_id: activeId,
          product_name: item.productName,
          barcode: item.barcode
        });
      } else if (existingItem) {
        await api.post("/transactions/update-item-qty", {
          transaction_id: activeId,
          product_name: item.productName,
          barcode: item.barcode,
          quantity: targetQty
        });
      } else {
        await api.post("/transactions/add-item", {
          transaction_id: activeId,
          product_name: item.productName,
          category: item.category || "",
          barcode: item.barcode,
          price: item.price,
          quantity: targetQty,
          total: item.price * targetQty
        });
      }
    } catch (err) {
      console.log("Sync error:", err.response?.data || err.message);
    }
  };

  const handleManualSelect = (prod) => {
    if (prod.stock !== null && prod.stock <= 0) {
      Alert.alert("Out of Stock", "This item has no available stock.");
      return;
    }

    const newItem = {
      productName: prod.name || prod.product_name || prod.productName || "Unknown",
      category: prod.category,
      price: Number(prod.price),
      stock: prod.stock,
      barcode: prod.barcode,
      qty: 1
    };

    setScannedItems((prev) => {
      const existing = prev.find(item => item.barcode === prod.barcode);
      if (existing) {
        syncWithBackend(newItem, existing.qty + 1);
        return prev.map(i => i.barcode === prod.barcode ? { ...i, qty: i.qty + 1 } : i);
      }
      syncWithBackend(newItem, 1);
      return [...prev, newItem];
    });
    setSearchQuery("");
  };

  // ─── Barcode scan handler ─────────────────────────────────────────────────
  const handleBarcodeScanned = async ({ data }) => {
    if (scanMode !== "barcode" || !data || isAnalyzing) return;

    const newBuffer = [...barcodeBuffer, data].slice(-5);
    setBarcodeBuffer(newBuffer);
    setVerificationProgress({ active: true, count: newBuffer.length });

    if (newBuffer.length === 5 && newBuffer.every((val) => val === data)) {
      setBarcodeBuffer([]);
      setVerificationProgress({ active: false, count: 0 });
      setIsAnalyzing(true);

      try {
        if (route?.params?.mode === "inventory") {
          route.params.onScan(data);
          navigation.goBack();
          return;
        }

        const res = await api.post("/inventory/barcode-lookup", { barcode: data });
        if (res.data.found) {
          const prod = res.data.product;
          const newItem = {
            productName: prod.name,
            category: prod.category,
            price: Number(prod.price),
            stock: prod.stock,
            barcode: prod.barcode,
            qty: 1
          };

          setScannedItems((prev) => {
            const existing = prev.find(item => item.barcode === prod.barcode);
            if (existing) {
              syncWithBackend(newItem, existing.qty + 1);
              return prev.map(i => i.barcode === prod.barcode ? { ...i, qty: i.qty + 1 } : i);
            } else {
              syncWithBackend(newItem, 1);
              return [...prev, newItem];
            }
          });
        } else {
          Alert.alert("Product Not Found", res.data.message || "No product with this barcode exists.");
        }
      } catch (err) {
        console.log("Barcode lookup error:", err.response?.data?.error || err.message);
      } finally {
        setTimeout(() => setIsAnalyzing(false), 800);
      }
    }
  };

  const handleQuantityChange = (barcode, delta) => {
    setScannedItems((prev) => {
      const item = prev.find(i => i.barcode === barcode);
      if (!item) return prev;

      const newQty = item.qty + delta;

      if (delta > 0 && item.stock !== null && newQty > item.stock) {
        Alert.alert("Max Stock", `Only ${item.stock} items available in inventory.`);
        return prev;
      }

      syncWithBackend(item, Math.max(0, newQty));

      if (newQty <= 0) {
        return prev.filter(i => i.barcode !== barcode);
      }

      return prev.map(i => i.barcode === barcode ? { ...i, qty: newQty } : i);
    });
  };

  const handleReviewOrder = () => {
    if (scannedItems.length === 0) return;
    setTorchOn(false); // Turn off flashlight when leaving scan screen

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
  const isDetected = isLocked && scanMode === "product";
  const cornerColor = isDetected ? "#2EFF00" : "#FFFFFF";

  return (
    <View style={styles.container}>
      {/* Camera */}
      {scanMode !== "manual" && (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          enableTorch={torchOn}
          onCameraReady={() => setCameraReady(true)}
          onBarcodeScanned={scanMode === "barcode" ? handleBarcodeScanned : undefined}
          barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"] }}
        />
      )}


      {/* Floating UI Elements (Top Level) */}
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => {
          clearCart();
          navigation.navigate("Main", { screen: "Dashboard" });
        }}
      >
        <AppText style={{ fontSize: 18 }}>✕</AppText>
      </TouchableOpacity>

      {(scanMode === "barcode" || scanMode === "product") && (
        <TouchableOpacity
          style={[styles.torchBtn, torchOn && styles.torchBtnActive]}
          onPress={() => setTorchOn(!torchOn)}
        >
          <AppText style={{ color: torchOn ? "#000" : "#FFF", fontSize: 18 }}>
            🔦
          </AppText>
        </TouchableOpacity>
      )}

      {/* Scanner Frame */}
      {scanMode !== "manual" && (
        <View style={scanMode === "barcode" ? styles.barcodeTargetFrame : styles.scannerFrame}>
          <View style={[styles.corner, styles.topLeft, { borderColor: cornerColor }]} />
          <View style={[styles.corner, styles.topRight, { borderColor: cornerColor }]} />
          <View style={[styles.corner, styles.bottomLeft, { borderColor: cornerColor }]} />
          <View style={[styles.corner, styles.bottomRight, { borderColor: cornerColor }]} />
        </View>
      )}


      {/* ─── Verification Overlay (Barcode Mode Only) ─── */}
      {scanMode === "barcode" && verificationProgress.active && (
        <View style={styles.verificationOverlay}>
          <AppText style={styles.verificationText}>
            Verifying {verificationProgress.count}/5
          </AppText>
        </View>
      )}

      {/* Bottom sheet */}
      <View style={[styles.bottomSheet, scanMode === "barcode" && styles.bottomSheetCart, scanMode === "manual" && styles.bottomSheetManual]}>

        {/* Full-Width Mode Toggle enclosed in Bottom Sheet */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleBtn, scanMode === "product" && styles.toggleActive]}
            onPress={() => switchMode("product")}
          >
            <AppText style={[styles.toggleText, scanMode === "product" && styles.toggleTextActive]}>
              Product Scan
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, scanMode === "barcode" && styles.toggleActive]}
            onPress={() => switchMode("barcode")}
          >
            <AppText style={[styles.toggleText, scanMode === "barcode" && styles.toggleTextActive]}>
              Barcode
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, scanMode === "manual" && styles.toggleActive]}
            onPress={() => switchMode("manual")}
          >
            <AppText style={[styles.toggleText, scanMode === "manual" && styles.toggleTextActive]}>
              Manual
            </AppText>
          </TouchableOpacity>
        </View>

        {scanMode !== "product" ? (
          <View style={styles.cartContainer}>
            {scanMode === "manual" && (
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search product by name..."
                  placeholderTextColor="#888"
                  autoCapitalize="words"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                />
                {(searchQuery.length > 0) && (
                  <View style={styles.dropdown}>
                    {filteredInventory.length === 0 ? (
                      <AppText style={styles.noResultsText}>No products found.</AppText>
                    ) : (
                      <FlatList
                        data={filteredInventory}
                        keyExtractor={(item) => item.id.toString()}
                        keyboardShouldPersistTaps="handled"
                        style={{ maxHeight: 200 }}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={[styles.dropdownRow, (item.stock !== null && item.stock <= 0) && styles.outOfStockRow]}
                            onPress={() => handleManualSelect(item)}
                            disabled={item.stock !== null && item.stock <= 0}
                          >
                            <View style={{ flex: 1 }}>
                              <AppText font="semibold" style={{ color: (item.stock !== null && item.stock <= 0) ? "#999" : "#111" }}>
                                {item.name || item.product_name || item.productName || "Unknown"}
                              </AppText>
                              <AppText style={{ color: (item.stock !== null && item.stock <= 0) ? "#E53935" : "#666", fontSize: 12 }}>
                                {(item.stock !== null && item.stock <= 0) ? "Out of Stock" : `${item.stock === null ? "Infinite" : item.stock} in stock`}
                              </AppText>
                            </View>
                            <AppText font="bold" style={{ color: (item.stock !== null && item.stock <= 0) ? "#999" : "#2254C5" }}>
                              ₹{Number(item.price).toFixed(2)}
                            </AppText>
                          </TouchableOpacity>
                        )}
                      />
                    )}
                  </View>
                )}
              </View>
            )}
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
                  {scanMode === "barcode" ? "Point camera at a barcode to scan." : "Search and add products."}
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
                <>
                  <AppText style={styles.wrong}>
                    Not this product?
                  </AppText>
                  <TouchableOpacity
                    style={{ marginBottom: 16, marginTop: 4 }}
                    onPress={handleRescan}
                  >
                    <AppText font="semibold" style={{ color: "#E53935", fontSize: 16 }}>
                      Tap to Rescan
                    </AppText>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                onPress={() => switchMode("barcode")}
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
    top: "12.5%",
    left: "10%",
    width: "80%",
    height: "25%",
  },
  barcodeTargetFrame: {
    position: "absolute",
    left: "10%",
    width: "80%",
    top: "12.5%",
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
    flexDirection: "row",
    backgroundColor: "#EAEAEA",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    width: "100%",
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  toggleActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleText: { color: "#666", fontWeight: "600" },
  toggleTextActive: { color: "#2254C5", fontWeight: "bold" },

  bottomSheet: {
    backgroundColor: "#F9F6EE",
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: 420,
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
    height: 420,
    justifyContent: "flex-start",
  },
  bottomSheetManual: {
    flex: 1,
    paddingTop: 50,
    paddingBottom: 24,
    justifyContent: "flex-start",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
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

  // ─── Manual Search UI Styles ──────────────────────────────────────────────
  searchContainer: {
    marginBottom: 16,
    zIndex: 10,
  },
  searchInput: {
    backgroundColor: "#F7F8FA",
    borderWidth: 1,
    borderColor: "#EAEAEA",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#222",
  },
  dropdown: {
    position: "absolute",
    top: 55,
    left: 0,
    right: 0,
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EAEAEA",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 100,
  },
  dropdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  outOfStockRow: {
    backgroundColor: "#FAFAFA",
    opacity: 0.7,
  },
  noResultsText: {
    padding: 16,
    textAlign: "center",
    color: "#888",
  },
});