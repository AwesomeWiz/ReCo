import React, { useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import AppText from "../components/AppText";
import api from "../api/api";

export default function BarcodeScannerScreen({ navigation, route }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);

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
      // 🔹 INVENTORY MODE
      if (route?.params?.mode === "inventory") {
        route.params.onScan(data);
        navigation.goBack();
        return;
      }

      // 🔹 SALES MODE — lookup barcode in inventory
      const res = await api.post("/inventory/barcode-lookup", {
        barcode: data,
      });

      if (res.data.found) {
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
      />

      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => navigation.goBack()}
      >
        <AppText style={{ color: "#fff" }}>Close</AppText>
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
    padding: 10,
    borderRadius: 10,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});