import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import AppText from "../components/AppText";
import api from "../api/api";

export default function ConfirmProductScreen({ route, navigation }) {
  const { prediction } = route.params;

  const confirmSale = async () => {
    await api.post("/sales", {
      product_id: prediction.productId,
      confidence: prediction.confidence,
      timestamp: new Date().toISOString()
    });

    navigation.replace("Dashboard");
  };

  return (
    <View style={styles.container}>
      <AppText font="bold" style={styles.name}>
        {prediction.productName}
      </AppText>

      <AppText style={styles.conf}>
        Confidence: {(prediction.confidence * 100).toFixed(1)}%
      </AppText>

      <TouchableOpacity style={styles.btn} onPress={confirmSale}>
        <AppText style={{ color: "#fff" }}>Confirm Sale</AppText>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <AppText style={{ marginTop: 20 }}>Rescan</AppText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  name: { fontSize: 24, marginBottom: 10 },
  conf: { fontSize: 16, color: "#666" },
  btn: {
    marginTop: 30,
    backgroundColor: "#2254C5",
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 30
  }
});
