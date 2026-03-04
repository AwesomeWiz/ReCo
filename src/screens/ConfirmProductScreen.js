import React, { useState, useEffect, useContext } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert
} from "react-native";
import AppText from "../components/AppText";
import api from "../api/api";
import { CartContext } from "../context/CartContext";

const BG = "#F9F6EE";
const ACCENT = "#2254C5";

export default function ConfirmProductScreen({ route, navigation }) {
  const routePrediction = route.params?.prediction || {};
  const routeBarcode = route.params?.barcode || null;

  const [product, setProduct] = useState(routePrediction);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const {
    transactionId,
    setTransactionId,
    cartItems,
    setCartItems,
    clearCart
  } = useContext(CartContext);

  const price = product.price ?? 0;
  const stock = product.stock ?? null; // null = unknown (ML), number = from inventory
  const isOutOfStock = stock !== null && stock <= 0;
  const totalItem = price * quantity;

  // ─── Barcode Lookup on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (routeBarcode && !routePrediction.productName) {
      lookupBarcode(routeBarcode);
    }
  }, [routeBarcode]);

  const lookupBarcode = async (barcode) => {
    setLoading(true);
    try {
      const res = await api.post("/inventory/barcode-lookup", { barcode });

      if (res.data.found) {
        setProduct({
          productName: res.data.product.name,
          category: res.data.product.category,
          price: res.data.product.price,
          stock: res.data.product.stock,
          barcode: res.data.product.barcode,
          confidence: 1.0,
        });
      } else {
        Alert.alert(
          "Product Not Found",
          res.data.message || "No product with this barcode exists in your inventory.",
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      Alert.alert("Lookup Failed", errorMsg, [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ─── Cart helpers ─────────────────────────────────────────────────────────
  const fetchCart = async (id) => {
    try {
      const res = await api.get(`/transactions/${id}`);
      setCartItems(res.data.items || []);
    } catch (err) {
      console.log("fetchCart error:", err.response?.data || err.message);
    }
  };

  const handleAddItem = async () => {
    if (isOutOfStock) {
      Alert.alert("Out of Stock", "This product is currently out of stock.");
      return;
    }

    if (stock !== null && quantity > stock) {
      Alert.alert("Insufficient Stock", `Only ${stock} items available.`);
      return;
    }

    try {
      let activeId = transactionId;

      if (!activeId) {
        const startRes = await api.post("/transactions/start");
        activeId = startRes.data.transaction_id;
        setTransactionId(activeId);
      }

      await api.post("/transactions/add-item", {
        transaction_id: activeId,
        product_name: product.productName,
        category: product.category || "",
        barcode: product.barcode || null,
        price,
        quantity,
        total: totalItem
      });

      await fetchCart(activeId);
      setQuantity(1);

    } catch (err) {
      console.log(err.response?.data || err.message);
      alert("Failed to add item");
    }
  };

  const handleCheckout = async () => {
    try {
      await api.post("/transactions/complete", {
        transaction_id: transactionId
      });

      setTransactionId(null);
      setCartItems([]);
      navigation.navigate("Main");

    } catch (err) {
      alert("Checkout failed");
    }
  };

  const handleContinueScan = () => {
    navigation.navigate("Scan");
  };

  const cartTotal = cartItems.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  // ─── Loading State ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <AppText style={{ marginTop: 16, color: "#808080" }}>Looking up barcode…</AppText>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Back */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Image
            source={require("../../assets/icons/Back.png")}
            style={{ width: 24, height: 24 }}
          />
        </TouchableOpacity>

        {/* Current Product */}
        <View style={styles.card}>
          <AppText style={styles.label}>
            Product: <AppText font="bold">{product.productName || "Unknown"}</AppText>
          </AppText>

          <AppText style={styles.label}>
            Price: <AppText font="bold">₹{price}</AppText>
          </AppText>

          {stock !== null && (
            <AppText style={[styles.label, isOutOfStock && { color: "#E53935" }]}>
              Stock: <AppText font="bold">{isOutOfStock ? "Out of Stock" : stock}</AppText>
            </AppText>
          )}

          {isOutOfStock ? (
            <View style={styles.outOfStockBanner}>
              <AppText style={styles.outOfStockText}>
                ⚠ This product is out of stock and cannot be added to the cart.
              </AppText>
            </View>
          ) : (
            <>
              <View style={styles.qtyRow}>
                <TouchableOpacity
                  onPress={() => quantity > 1 && setQuantity(quantity - 1)}
                  style={styles.qtyBtn}
                >
                  <AppText>-</AppText>
                </TouchableOpacity>

                <AppText style={styles.qtyText}>{quantity}</AppText>

                <TouchableOpacity
                  onPress={() => {
                    if (stock !== null && quantity >= stock) {
                      Alert.alert("Max Stock", `Only ${stock} items available.`);
                    } else {
                      setQuantity(quantity + 1);
                    }
                  }}
                  style={styles.qtyBtn}
                >
                  <AppText>+</AppText>
                </TouchableOpacity>
              </View>

              <AppText style={styles.totalItem}>
                Item Total: ₹{totalItem}
              </AppText>

              <TouchableOpacity
                style={styles.addBtn}
                onPress={handleAddItem}
              >
                <AppText style={styles.btnText}>
                  Add to Cart
                </AppText>
              </TouchableOpacity>
            </>
          )}

          {/* Continue Scan Button */}
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={handleContinueScan}
          >
            <AppText style={styles.scanText}>
              Continue Scan
            </AppText>
          </TouchableOpacity>
        </View>

        {/* Cart Preview */}
        {cartItems.length > 0 && (
          <View style={styles.cartCard}>
            <AppText font="bold" style={{ marginBottom: 10 }}>
              Cart Preview
            </AppText>

            {cartItems.map((item, index) => (
              <View key={index} style={styles.cartRow}>
                <AppText>{item.description} x{item.qty}</AppText>
                <AppText>₹{item.amount}</AppText>
              </View>
            ))}

            <View style={styles.divider} />

            <View style={styles.cartRow}>
              <AppText font="bold">TOTAL</AppText>
              <AppText font="bold">₹{cartTotal}</AppText>
            </View>

            <TouchableOpacity
              style={styles.checkoutBtn}
              onPress={handleCheckout}
            >
              <AppText style={styles.btnText}>
                Checkout
              </AppText>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 16
  },
  backBtn: {
    marginLeft: 10,
    marginTop: 10,
    marginBottom: 10
  },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    margin: 10,
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 6
  },
  outOfStockBanner: {
    backgroundColor: "#FFEBEE",
    padding: 12,
    borderRadius: 10,
    marginVertical: 10,
  },
  outOfStockText: {
    color: "#C62828",
    textAlign: "center",
    fontWeight: "600"
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10
  },
  qtyBtn: {
    width: 35,
    height: 35,
    borderWidth: 1,
    borderColor: "#ddd",
    justifyContent: "center",
    alignItems: "center"
  },
  qtyText: {
    marginHorizontal: 15
  },
  totalItem: {
    marginBottom: 12,
    fontWeight: "bold"
  },
  addBtn: {
    backgroundColor: ACCENT,
    padding: 12,
    borderRadius: 24,
    alignItems: "center",
    marginBottom: 10
  },
  scanBtn: {
    borderWidth: 1.5,
    borderColor: ACCENT,
    padding: 12,
    borderRadius: 24,
    alignItems: "center"
  },
  btnText: {
    color: "#fff",
    fontWeight: "600"
  },
  scanText: {
    color: ACCENT,
    fontWeight: "600"
  },
  cartCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    margin: 10,
    marginBottom: 20,
  },
  cartRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 4
  },
  divider: {
    height: 1,
    backgroundColor: "#ddd",
    marginVertical: 8
  },
  checkoutBtn: {
    marginTop: 10,
    backgroundColor: "#000",
    padding: 12,
    borderRadius: 24,
    alignItems: "center"
  }
});
