import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import AppText from "../components/AppText";
import api from "../api/api";

export default function BarcodeScannerScreen({ navigation, route }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <AppText>Camera permission required</AppText>
        <TouchableOpacity onPress={requestPermission}>
          <AppText style={{ color: "#3A6FF7" }}>
            Grant Permission
          </AppText>
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

    // 🔹 SALES MODE
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
        },
      });
    } else {
      Alert.alert("No product found in inventory");
      setIsScanning(false); // allow scanning again
      return;
    }

  } catch (err) {
    console.log(err.response?.data || err.message);
    Alert.alert("No product found in inventory");
    setIsScanning(false);
  }
};

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{
          barcodeTypes: [
            "ean13",
            "ean8",
            "code128",
            "upc_a",
            "upc_e",
          ],
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