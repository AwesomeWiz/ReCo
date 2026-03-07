import React, { useState, useEffect, useContext } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal
} from "react-native";
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [showSuccess, setShowSuccess] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [upiId, setUpiId] = useState("");
  const [storeName, setStoreName] = useState("My Store");

  const {
    transactionId,
    setTransactionId,
    cartItems,
    setCartItems,
    clearCart
  } = useContext(CartContext);

  const isCartFlow = route.params?.isCartFlow || false;
  const cartData = routePrediction.cart || [];

  // Single item logic
  const price = product.price ?? 0;
  const stock = product.stock ?? null;
  const isOutOfStock = stock !== null && stock <= 0;
  const totalItem = price * quantity;

  // Cart flow logic
  const cartModeTotal = cartData.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);

  // ─── Data fetch on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (routeBarcode && !routePrediction.productName && !isCartFlow) {
      lookupBarcode(routeBarcode);
    }

    // Fetch UPI details for payment QR
    (async () => {
      const savedUpi = await AsyncStorage.getItem("upi_id");
      const savedName = await AsyncStorage.getItem("store_name");
      if (savedUpi) setUpiId(savedUpi);
      if (savedName) setStoreName(savedName);
    })();
  }, [routeBarcode, isCartFlow]);

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
    // Basic validation for single item mode
    if (!isCartFlow) {
      if (isOutOfStock) {
        Alert.alert("Out of Stock", "This product is currently out of stock.");
        return;
      }
      if (stock !== null && quantity > stock) {
        Alert.alert("Insufficient Stock", `Only ${stock} items available.`);
        return;
      }
    }

    setLoading(true);
    try {
      let activeId = transactionId;

      if (!activeId) {
        const startRes = await api.post("/transactions/start");
        activeId = startRes.data.transaction_id;
        setTransactionId(activeId);
      }

      if (isCartFlow) {
        // Sequentially add all cart items
        for (const item of cartData) {
          // Verify stock locally before adding if we can
          if (item.stock !== null && item.qty > item.stock) {
            Alert.alert("Warning", `Only ${item.stock} left for ${item.productName}, adjusting quantity.`);
            item.qty = item.stock;
          }
          if (item.qty > 0) {
            await api.post("/transactions/add-item", {
              transaction_id: activeId,
              product_name: item.productName,
              category: item.category || "",
              barcode: item.barcode || null,
              price: item.price,
              quantity: item.qty,
              total: item.price * item.qty
            });
          }
        }
      } else {
        // Single item flow
        await api.post("/transactions/add-item", {
          transaction_id: activeId,
          product_name: product.productName,
          category: product.category || "",
          barcode: product.barcode || null,
          price,
          quantity,
          total: totalItem
        });
      }

      await fetchCart(activeId);
      if (!isCartFlow) setQuantity(1);

      if (isCartFlow) {
        // Complete the transaction seamlessly in 1-click
        await api.post("/transactions/complete", { transaction_id: activeId });
        setTransactionId(null);
        setCartItems([]);
        setShowSuccess(true); // Trigger the beautiful success modal
      } else {
        Alert.alert("Success", "Added to Cart!");
      }
    } catch (err) {
      console.log("Checkout Error:", err.response?.data || err.message);
      const errorMsg = err.response?.data?.error || err.message || "Unknown error";
      Alert.alert("Checkout Failed", errorMsg);
    } finally {
      setLoading(false);
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

  // ─── Render ──────────────────────────────────────────────────────────────

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

        {/* Current Product(s) */}
        <View style={styles.card}>
          {isCartFlow ? (
            <>
              <AppText style={[styles.label, { marginBottom: 12, fontSize: 18, fontWeight: "bold" }]}>
                Scanned Items
              </AppText>

              {cartData.map((item, idx) => (
                <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <AppText style={{ flex: 1 }}>{item.qty}x {item.productName}</AppText>
                  <AppText>₹{(item.price * item.qty).toFixed(2)}</AppText>
                </View>
              ))}

              <View style={{ height: 1, backgroundColor: "#EAEAEA", marginVertical: 12 }} />

              <AppText style={styles.totalItem}>
                Cart Total: ₹{cartModeTotal.toFixed(2)}
              </AppText>

              {/* --- QR Moved to Success Modal --- */}

              <View style={styles.checkoutBtnRow}>
                <TouchableOpacity
                  style={[styles.checkoutBtn, styles.cancelBtn]}
                  onPress={() => navigation.navigate("Main", { screen: "Dashboard" })}
                >
                  <AppText style={[styles.btnText, { color: "#333" }]}>Cancel</AppText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.checkoutBtn, styles.confirmBtn]}
                  onPress={handleAddItem}
                >
                  <AppText style={styles.btnText}>Checkout</AppText>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
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
            </>
          )}

          {/* Continue Scan Button (Only for Single Product) */}
          {!isCartFlow && (
            <TouchableOpacity
              style={styles.scanBtn}
              onPress={handleContinueScan}
            >
              <AppText style={styles.scanText}>
                Continue Scan
              </AppText>
            </TouchableOpacity>
          )}

        </View>

      </ScrollView>

      {/* ─── Loading Overlay Modal ─── */}
      <Modal
        visible={loading}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={ACCENT} />
            <AppText style={styles.loadingText}>
              {isCartFlow ? "Processing Checkout..." : "Looking up barcode..."}
            </AppText>
          </View>
        </View>
      </Modal>

      {/* ─── Premium Success Modal ─── */}
      <Modal
        visible={showSuccess}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalBox}>
            <View style={styles.modalIconContainer}>
              <AppText style={{ fontSize: 28, color: "#FFF" }}>✓</AppText>
            </View>
            <AppText font="bold" style={styles.modalTitle}>Checkout Complete!</AppText>
            <AppText style={styles.modalText}>Your transaction has been successfully recorded.</AppText>

            {/* ─── UPI Payment QR Code ─── */}
            {isCartFlow && upiId ? (
              <View style={styles.qrContainer}>
                <AppText style={styles.qrTitle}>Pay via UPI</AppText>
                <View style={styles.qrWrapper}>
                  <QRCode
                    value={`upi://pay?pa=${upiId}&pn=${encodeURIComponent(storeName)}&am=${cartModeTotal.toFixed(2)}&cu=INR`}
                    size={220}
                    color="#2254C5"
                    backgroundColor="white"
                  />
                </View>
                <AppText style={styles.qrSubtitle}>Total: ₹{cartModeTotal.toFixed(2)}</AppText>
                <AppText style={{ fontSize: 13, color: "#888", marginTop: 4 }}>{upiId}</AppText>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => {
                setShowSuccess(false);
                navigation.navigate("Main", { screen: "Dashboard" });
              }}
            >
              <AppText font="bold" style={{ color: "#FFF", fontSize: 16 }}>Payment Complete</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingBox: {
    backgroundColor: "#FFF",
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#444",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalBox: {
    backgroundColor: "#FFF",
    width: "90%",
    borderRadius: 24,
    padding: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    color: "#2254C5",
    marginBottom: 4,
    textAlign: "center",
  },
  modalText: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 18,
  },
  modalBtn: {
    backgroundColor: "#2254C5",
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  checkoutBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  checkoutBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: "center",
  },
  cancelBtn: {
    backgroundColor: "#ccc",
    marginRight: 8,
  },
  confirmBtn: {
    backgroundColor: "#2254C5",
    marginLeft: 8,
  },
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
  },
  qrContainer: {
    alignItems: "center",
    marginVertical: 16,
    padding: 16,
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EAEAEA",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#444",
    marginBottom: 12,
  },
  qrWrapper: {
    padding: 10,
    backgroundColor: "#FFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EAEAEA",
  },
  qrSubtitle: {
    fontSize: 14,
    marginTop: 10,
    color: "#2254C5",
    fontWeight: "bold",
  }
});
