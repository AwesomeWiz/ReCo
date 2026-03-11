import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import AppText from "../components/AppText";
import api from "../api/api";

const REQUIRED_SCANS = 5;

export default function BarcodeScannerScreen({ navigation, route }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const bufferRef = useRef([]);

  useEffect(() => {
    const testConnection = async () => {
      try {
        console.log("Testing connection to:", api.defaults.baseURL);
        await api.get("/inventory");
      } catch (err) {
        console.log("Connection test failed:", err.message);
      }
    };
    testConnection();
  }, []);

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <AppText>Camera permission required</AppText>
        <TouchableOpacity onPress={requestPermission}>
          <AppText style={{ color: "#3A6FF7" }}>Grant Permission</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  const handleScan = ({ data }) => {
    if (isProcessing || !data) return;

    // Add to buffer (keep last REQUIRED_SCANS)
    const newBuffer = [...bufferRef.current, data].slice(-REQUIRED_SCANS);
    bufferRef.current = newBuffer;
    setScanCount(newBuffer.filter((v) => v === data).length);

    // Check if we have REQUIRED_SCANS identical consecutive reads
    if (
      newBuffer.length === REQUIRED_SCANS &&
      newBuffer.every((val) => val === data)
    ) {
      bufferRef.current = [];
      setScanCount(0);
      processBarcode(data);
    }
  };

  const processBarcode = async (data) => {
    setIsProcessing(true);

    try {
      // INVENTORY MODE — pass barcode back
      if (route?.params?.mode === "inventory") {
        setTorchOn(false);
        navigation.navigate("Main", {
          screen: "Inventory",
          params: { scannedBarcode: data },
        });
        return;
      }

      // SALES MODE — lookup barcode in inventory
      const res = await api.post("/inventory/barcode-lookup", {
        barcode: data,
      });

      if (res.data.found) {
        setTorchOn(false);
        navigation.replace("ConfirmProduct", {
          fromScreen: "BarcodeScanner",
          prediction: {
            productName: res.data.product.name,
            category: res.data.product.category,
            price: res.data.product.price,
            stock: res.data.product.stock,
            barcode: res.data.product.barcode,
            confidence: 1.0,
          },
        });
      } else {
        Alert.alert(
          "Product Not Found",
          res.data.message || "No product with this barcode exists."
        );
        setIsProcessing(false);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      console.log("Barcode lookup error:", errorMsg);
      Alert.alert("Lookup Failed", errorMsg);
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "code128", "upc_a", "upc_e"],
        }}
        onBarcodeScanned={isProcessing ? undefined : handleScan}
        enableTorch={torchOn}
      />

      {/* Close button */}
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => {
          setTorchOn(false);
          navigation.goBack();
        }}
      >
        <AppText style={{ color: "#fff" }}>✕ Close</AppText>
      </TouchableOpacity>

      {/* Verification counter */}
      <View style={styles.verifyBadge}>
        <AppText style={styles.verifyText}>
          Verification: {scanCount}/{REQUIRED_SCANS}
        </AppText>
      </View>

      {/* Flashlight toggle */}
      <TouchableOpacity
        style={[styles.torchBtn, torchOn && styles.torchBtnOn]}
        onPress={() => setTorchOn((prev) => !prev)}
      >
        <AppText style={styles.torchIcon}>{torchOn ? "🔦" : "🔦"}</AppText>
        <AppText style={styles.torchLabel}>
          {torchOn ? "Flash ON" : "Flash OFF"}
        </AppText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },

  closeBtn: {
    position: "absolute",
    top: 60,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },

  verifyBadge: {
    position: "absolute",
    bottom: 110,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  verifyText: {
    color: "#2254C5",
    fontWeight: "600",
    fontSize: 14,
  },

  torchBtn: {
    position: "absolute",
    bottom: 50,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    gap: 8,
  },

  torchBtnOn: {
    backgroundColor: "rgba(255,220,0,0.25)",
    borderColor: "#FFD700",
  },

  torchIcon: {
    fontSize: 20,
  },

  torchLabel: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
    letterSpacing: 0.5,
  },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});