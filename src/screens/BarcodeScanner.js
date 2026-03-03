import React, { useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import AppText from "../components/AppText";
import api from "../api/api";

export default function BarcodeScannerScreen({ navigation, route }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // ✅ Hooks MUST be before any conditional returns
  useEffect(() => {
    const testConnection = async () => {
      try {
        console.log("Testing connection to:", api.defaults.baseURL);
        const healthCheck = await api.get("/inventory");
        console.log("Health check (GET /inventory):", healthCheck.status);

        try {
          await api.post("/inventory/barcode-lookup", {});
        } catch (err) {
          console.log(
            "Route check (POST /inventory/barcode-lookup):",
            err.response?.status,
            err.response?.data
          );
        }
      } catch (err) {
        console.log("Connection test failed:", err.message);
      }
    };
    testConnection();
  }, []);

  // ✅ Conditional returns AFTER all hooks
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

  const handleScan = async ({ data }) => {
    if (isScanning) return;
    setIsScanning(true);

    try {
      // 🔹 INVENTORY MODE — pass barcode back to Inventory tab
      if (route?.params?.mode === "inventory") {
        setTorchOn(false);
        navigation.navigate("Main", {
          screen: "Inventory",
          params: { scannedBarcode: data },
        });
        return;
      }

      // 🔹 SALES MODE — lookup barcode in inventory
      const res = await api.post("/inventory/barcode-lookup", {
        barcode: data,
      });

      if (res.data.found) {
        setTorchOn(false);
        navigation.replace("ConfirmProduct", {
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
        setIsScanning(false);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      console.log("Barcode lookup error:", errorMsg);
      Alert.alert("Lookup Failed", errorMsg);
      setIsScanning(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "code128", "upc_a", "upc_e"],
        }}
        onBarcodeScanned={handleScan}
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