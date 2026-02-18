import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, Image } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import AppText from "../components/AppText";

export default function ScanScreen({ navigation, route }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [barcodeMode, setBarcodeMode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // 🔹 Mock ML output (replace later with TFLite)
  const prediction = {
    productName: "Coca Cola 250 ml Bottle",
    category: "Soft Drinks",
    confidence: 0.92
  };

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <AppText>Camera permission required</AppText>
        <TouchableOpacity onPress={requestPermission}>
          <AppText style={{ color: "#2254C5" }}>
            Grant Permission
          </AppText>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = ({ data }) => {
    if (isScanning) return;

    setIsScanning(true);
    setBarcodeMode(false);

    // 🔹 If coming from Inventory Screen
    if (route?.params?.mode === "inventory") {
      route.params.onScan(data);
      navigation.goBack();
      return;
    }

    // 🔹 Default behavior (sales flow)
    navigation.navigate("ConfirmProduct", {
      barcode: data
    });

    setTimeout(() => setIsScanning(false), 1000);
  };

  return (
    <View style={styles.container}>

      {/* Camera */}
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{
          barcodeTypes: [
            "ean13",
            "ean8",
            "code128",
            "upc_a",
            "upc_e"
          ]
        }}
        onBarcodeScanned={barcodeMode ? handleBarcodeScanned : undefined}
      />

      {/* Close button */}
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() =>
          navigation.navigate("Main", {
            screen: "Dashboard",
          })
        }
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

      {/* Barcode Toggle Button */}
      <TouchableOpacity
        style={styles.barcodeBtn}
        onPress={() => setBarcodeMode(true)}
      >
        <AppText style={{ color: "#fff", fontWeight: "600" }}>
          Scan Barcode
        </AppText>
      </TouchableOpacity>

      {/* Bottom Sheet (ML UI) */}
      <View style={styles.bottomSheet}>
        <AppText font="regular" style={styles.detected}>
          Detected
        </AppText>

        <AppText font="semibold" style={styles.product}>
          {prediction.productName}
        </AppText>

        <AppText font="regular" style={styles.category}>
          Category: {prediction.category}
        </AppText>

        {/* Confirm ML Prediction */}
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={() =>
            navigation.navigate("ConfirmProduct", {
              prediction
            })
          }
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000"
  },

  camera: {
    flex: 1
  },

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
    zIndex: 10
  },

  barcodeBtn: {
    position: "absolute",
    bottom: "35%",
    alignSelf: "center",
    backgroundColor: "#3A6FF7",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    zIndex: 10
  },

  scannerFrame: {
    position: "absolute",
    top: "15%",
    left: "10%",
    width: "80%",
    height: "45%"
  },

  corner: {
    width: 24,
    height: 24,
    borderColor: "#2EFF00",
    position: "absolute"
  },

  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3
  },

  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3
  },

  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3
  },

  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3
  },

  bottomSheet: {
    backgroundColor: "#F9F6EE",
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24
  },

  detected: {
    textAlign: "center",
    color: "#808080",
    marginBottom: 6
  },

  product: {
    fontSize: 20,
    textAlign: "center"
  },

  category: {
    textAlign: "center",
    marginBottom: 20
  },

  scanBtn: {
    alignSelf: "center",
    backgroundColor: "#2254C5",
    width: 100,
    height: 100,
    borderRadius: 50, // FIXED
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20
  },

  scanIcon: {
    width: 60,
    height: 60,
    tintColor: "#fff"
  },

  fallback: {
    alignItems: "center"
  },

  wrong: {
    color: "#808080"
  },

  manual: {
    marginTop: 4
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  }
});