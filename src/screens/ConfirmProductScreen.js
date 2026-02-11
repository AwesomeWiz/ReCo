import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image
} from "react-native";
import AppText from "../components/AppText";
import api from "../api/api";


export default function ConfirmProductScreen({ route, navigation }) {
  const { prediction } = route.params;

  const price = 20;
  const [quantity, setQuantity] = useState(1);
  const total = price * quantity;

  const handleConfirmSale = async () => {
  try {
    await api.post("/sale", {
      product_name: prediction.productName,
      category: prediction.category || "",
      price: price,
      quantity: quantity,
      total: total
    });

    navigation.replace("Main");
  } catch (err) {
    console.log(err.response?.data || err.message);
    alert("Failed to record sale");
  }
};


  return (
    <View style={styles.container}>

      {/* Back Button (fixed at top) */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
      >
        <Image
          source={require("../../assets/icons/Back.png")}
          style={styles.backIcon}
        />

      </TouchableOpacity>

      {/* Centered Content */}
      <View style={styles.content}>

        {/* Product Info */}
        <View style={styles.details}>
          <AppText style={styles.label}>
            Product : <AppText font="bold">{prediction.productName}</AppText>
          </AppText>

          <AppText style={styles.label}>
            Price : <AppText font="bold">Rs. {price}</AppText>
          </AppText>
        </View>

        {/* Quantity */}
        <View style={styles.qtyRow}>
          <AppText style={styles.label}>Quantity :</AppText>

          <View style={styles.qtyBox}>
            <TouchableOpacity
              onPress={() => quantity > 1 && setQuantity(quantity - 1)}
              style={styles.qtyBtn}
            >
              <AppText>-</AppText>
            </TouchableOpacity>

            <AppText style={styles.qtyText}>{quantity}</AppText>

            <TouchableOpacity
              onPress={() => setQuantity(quantity + 1)}
              style={styles.qtyBtn}
            >
              <AppText>+</AppText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Total */}
        <View style={styles.totalBox}>
          <AppText>Total</AppText>
          <AppText font="bold" style={styles.total}>
            Rs. {total}
          </AppText>
        </View>

        {/* Confirm */}
        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={handleConfirmSale}
        >
          <AppText style={styles.confirmText}>
            Confirm Sale
          </AppText>
        </TouchableOpacity>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F6EE"
  },

  backBtn: {
    position: "absolute",
    top: 50,
    left: 10,
    zIndex: 10
  },

  back: {
    fontSize: 24
  },

  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20
  },

  details: {
    marginBottom: 20
  },

  label: {
    fontSize: 16,
    marginBottom: 10
  },

  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10
  },

  qtyBox: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 10
  },

  qtyBtn: {
    width: 35,
    height: 35,
    borderWidth: 1,
    borderColor: "#ccc",
    justifyContent: "center",
    alignItems: "center"
  },

  qtyText: {
    marginHorizontal: 15,
    fontSize: 16
  },

  totalBox: {
    alignItems: "center",
    marginVertical: 30
  },

  total: {
    fontSize: 26,
    marginTop: 5
  },

  confirmBtn: {
    backgroundColor: "#2254C5",
    height: 55,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center"
  },

  confirmText: {
    color: "#fff",
    fontSize: 18
  }
});
