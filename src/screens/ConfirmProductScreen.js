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
  const [finalTotal, setFinalTotal] = useState(0);

  const {
    transactionId,
    setTransactionId,
    cartItems,
    setCartItems,
    clearCart,
    selectedDate
  } = useContext(CartContext);

  const isCartFlow = route.params?.isCartFlow || false;
  const cartData = routePrediction.cart || [];
  const fromScreen = route.params?.fromScreen || "Scan"; // "BarcodeScanner" or "Scan"

  // Single item logic
  const price = product.price ?? 0;
  const stock = product.stock ?? null;
  const isOutOfStock = stock !== null && stock <= 0;
  const totalItem = price * quantity;

  // Cart flow logic
  const activeCartItems = isCartFlow ? cartItems : cartData;
  const cartModeTotal = isCartFlow
    ? cartItems.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    : cartData.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);

  // ─── Data fetch on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (routeBarcode && !routePrediction.productName && !isCartFlow) {
      lookupBarcode(routeBarcode);
    }

    if (isCartFlow && transactionId) {
      fetchCart(transactionId);
    }

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
        const startRes = await api.post("/transactions/start", selectedDate ? { date: selectedDate } : {});
        activeId = startRes.data.transaction_id;
        setTransactionId(activeId);
      }

      if (!isCartFlow) {
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
        await api.post("/transactions/complete", { transaction_id: activeId });
        setFinalTotal(cartModeTotal);
        setTransactionId(null);
        setCartItems([]);
        setShowSuccess(true);
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
      setFinalTotal(cartTotal);
      setTransactionId(null);
      setCartItems([]);
      setShowSuccess(true);
    } catch (err) {
      alert("Checkout failed");
    }
  };

  const handleContinueScan = () => {
    if (fromScreen === "BarcodeScanner") {
      navigation.navigate("BarcodeScanner", { mode: "sales" });
    } else {
      navigation.navigate("Scan");
    }
  };

  const cartTotal = cartItems.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}>

        {/* ── Header ─────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backCircle} onPress={() => navigation.goBack()}>
            <Image source={require("../../assets/icons/Back.png")} style={{ width: 20, height: 20 }} />
          </TouchableOpacity>
          <AppText font="bold" style={styles.headerTitle}>
            {isCartFlow ? "Order Review" : "Confirm Product"}
          </AppText>
          <View style={{ width: 40 }} />
        </View>

        {/* ── Summary Card ───────────────────────────── */}
        <View style={styles.card}>
          <AppText font="bold" style={styles.cardHeading}>
            {isCartFlow ? "Cart Summary" : "Product Details"}
          </AppText>

          {isCartFlow ? (
            <>
              {activeCartItems.map((item, idx) => (
                <View key={idx} style={styles.lineRow}>
                  <View style={{ flex: 1 }}>
                    <AppText font="semibold" style={styles.lineName} numberOfLines={1}>
                      {item.productName || item.description}
                    </AppText>
                    <AppText style={styles.lineUnit}>
                      ₹{(item.price ?? (item.amount / item.qty)).toFixed(2)} × {item.qty}
                    </AppText>
                  </View>
                  <AppText font="bold" style={styles.lineAmt}>
                    ₹{(item.amount || (item.price * item.qty)).toFixed(2)}
                  </AppText>
                </View>
              ))}

              <View style={styles.divider} />

              <View style={styles.totalRow}>
                <AppText font="bold" style={styles.totalLabel}>Total</AppText>
                <AppText font="bold" style={styles.totalAmt}>₹{cartModeTotal.toFixed(2)}</AppText>
              </View>
            </>
          ) : (
            <>
              <View style={styles.productRow}>
                <View style={styles.productIconBox}>
                  <AppText style={{ fontSize: 22 }}>🛍</AppText>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText font="bold" style={styles.productName}>
                    {product.productName || "Unknown Product"}
                  </AppText>
                  {product.category ? (
                    <AppText style={styles.productCat}>{product.category}</AppText>
                  ) : null}
                </View>
                <AppText font="bold" style={styles.productPrice}>₹{price}</AppText>
              </View>

              {stock !== null && (
                <View style={[styles.stockPill, isOutOfStock && styles.stockPillRed]}>
                  <AppText style={[styles.stockText, isOutOfStock && styles.stockTextRed]}>
                    {isOutOfStock ? "Out of Stock" : `${stock} in stock`}
                  </AppText>
                </View>
              )}

              {product.inInventory === false ? (
                <View style={styles.warnBox}>
                  <AppText style={styles.warnText}>
                    ⚠ Not in your inventory. Please add it before selling.
                  </AppText>
                </View>
              ) : isOutOfStock ? (
                <View style={styles.warnBox}>
                  <AppText style={styles.warnText}>⚠ This product is out of stock.</AppText>
                </View>
              ) : (
                <>
                  <View style={styles.qtySection}>
                    <AppText style={styles.qtyLabel}>Quantity</AppText>
                    <View style={styles.qtyPill}>
                      <TouchableOpacity
                        onPress={() => quantity > 1 && setQuantity(quantity - 1)}
                        style={styles.qtyBtn}
                      >
                        <AppText style={styles.qtyBtnText}>−</AppText>
                      </TouchableOpacity>
                      <AppText font="bold" style={styles.qtyVal}>{quantity}</AppText>
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
                        <AppText style={styles.qtyBtnText}>+</AppText>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.totalRow}>
                    <AppText font="bold" style={styles.totalLabel}>Item Total</AppText>
                    <AppText font="bold" style={styles.totalAmt}>₹{totalItem.toFixed(2)}</AppText>
                  </View>
                </>
              )}
            </>
          )}
        </View>

        {/* ── Global Cart (single-product mode) ─────── */}
        {!isCartFlow && cartItems.length > 0 && (
          <View style={[styles.card, { marginTop: 16 }]}>
            <AppText font="bold" style={styles.cardHeading}>Cart</AppText>

            {cartItems.map((item, idx) => (
              <View key={idx} style={styles.lineRow}>
                <AppText style={{ flex: 1, color: "#555", fontSize: 14 }}>
                  {item.qty}× {item.description}
                </AppText>
                <AppText font="semibold" style={styles.lineAmt}>₹{item.amount.toFixed(2)}</AppText>
              </View>
            ))}

            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <AppText font="bold" style={styles.totalLabel}>Cart Total</AppText>
              <AppText font="bold" style={styles.totalAmt}>₹{cartTotal.toFixed(2)}</AppText>
            </View>

            <TouchableOpacity style={styles.checkoutAllBtn} onPress={handleCheckout}>
              <AppText font="bold" style={{ color: "#FFF", fontSize: 15 }}>Checkout All Items</AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                Alert.alert("Clear Cart", "Remove all items?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Clear", onPress: () => clearCart(), style: "destructive" }
                ]);
              }}
            >
              <AppText font="semibold" style={{ color: "#E53935" }}>Clear Cart</AppText>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* ── Sticky Bottom (action bar + continue scan) ── */}
      <View style={styles.stickyBottom}>
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => navigation.navigate("Main", { screen: "Dashboard" })}
          >
            <AppText font="semibold" style={styles.cancelText}>Cancel</AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.confirmBtn,
              (!isCartFlow && (isOutOfStock || product.inInventory === false)) && styles.confirmBtnOff,
              loading && { opacity: 0.7 }
            ]}
            onPress={handleAddItem}
            disabled={(!isCartFlow && (isOutOfStock || product.inInventory === false)) || loading}
          >
            <AppText font="bold" style={styles.confirmText}>
              {loading
                ? (isCartFlow ? "Processing..." : "Adding...")
                : (isCartFlow ? "Checkout →" : "Add to Cart")}
            </AppText>
          </TouchableOpacity>
        </View>

        {!isCartFlow && (
          <TouchableOpacity style={styles.continueBtn} onPress={handleContinueScan}>
            <AppText font="semibold" style={styles.continueBtnText}>+ Continue Scanning</AppText>
          </TouchableOpacity>
        )}
      </View>


      {/* ── Loading Modal ── */}
      <Modal visible={loading} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={ACCENT} />
            <AppText style={styles.loadingText}>
              {isCartFlow ? "Processing Checkout..." : "Looking up product..."}
            </AppText>
          </View>
        </View>
      </Modal>

      {/* ── Success Modal (bottom sheet) ── */}
      <Modal visible={showSuccess} transparent animationType="slide">
        <View style={styles.successOverlay}>
          <View style={styles.successSheet}>
            <View style={styles.successIcon}>
              <AppText style={{ fontSize: 28, color: "#FFF" }}>✓</AppText>
            </View>
            <AppText font="bold" style={styles.successTitle}>Sale Complete!</AppText>
            <AppText style={styles.successSub}>Transaction recorded successfully.</AppText>

            {upiId ? (
              <View style={styles.qrCard}>
                <AppText font="semibold" style={styles.qrHead}>Scan to Pay via UPI</AppText>
                <View style={styles.qrWrap}>
                  <QRCode
                    value={`upi://pay?pa=${upiId}&pn=${encodeURIComponent(storeName)}&am=${finalTotal.toFixed(2)}&cu=INR`}
                    size={200}
                    color="#2254C5"
                    backgroundColor="white"
                  />
                </View>
                <AppText font="bold" style={styles.qrAmt}>₹{finalTotal.toFixed(2)}</AppText>
                <AppText style={styles.qrId}>{upiId}</AppText>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => {
                setShowSuccess(false);
                navigation.navigate("Main", { screen: "Dashboard" });
              }}
            >
              <AppText font="bold" style={{ color: "#FFF", fontSize: 16 }}>Done</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F6FA" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#FFF",
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  headerTitle: { fontSize: 18, color: "#111" },

  // Card
  card: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  cardHeading: { fontSize: 16, color: "#333", marginBottom: 16, letterSpacing: 0.2 },

  // Line rows (cart items)
  lineRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F2F2F2",
  },
  lineName: { fontSize: 14, color: "#111" },
  lineUnit: { fontSize: 12, color: "#999", marginTop: 2 },
  lineAmt: { fontSize: 14, color: "#1A2B4A", marginLeft: 12 },

  divider: { height: 1, backgroundColor: "#EAEAEA", marginVertical: 14 },

  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 15, color: "#444" },
  totalAmt: { fontSize: 22, color: "#2254C5" },

  // Single product
  productRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  productIconBox: {
    width: 50, height: 50, borderRadius: 14,
    backgroundColor: "#EEF2FF",
    justifyContent: "center", alignItems: "center", marginRight: 14,
  },
  productName: { fontSize: 16, color: "#111", marginBottom: 3 },
  productCat: { fontSize: 12, color: "#888" },
  productPrice: { fontSize: 18, color: "#2254C5" },

  stockPill: {
    alignSelf: "flex-start", backgroundColor: "#E8F5E9",
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 16,
  },
  stockPillRed: { backgroundColor: "#FFEBEE" },
  stockText: { fontSize: 12, color: "#2E7D32", fontWeight: "600" },
  stockTextRed: { color: "#C62828" },

  warnBox: {
    backgroundColor: "#FFEBEE", padding: 14,
    borderRadius: 12, marginBottom: 8,
  },
  warnText: { color: "#C62828", fontSize: 13, fontWeight: "600", textAlign: "center" },

  // Qty
  qtySection: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 4,
  },
  qtyLabel: { fontSize: 14, color: "#555" },
  qtyPill: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F0F3FA", borderRadius: 12, overflow: "hidden",
  },
  qtyBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  qtyBtnText: { fontSize: 20, color: "#2254C5", fontWeight: "700" },
  qtyVal: { fontSize: 16, minWidth: 28, textAlign: "center", color: "#111" },

  // Cart actions
  checkoutAllBtn: {
    backgroundColor: "#2254C5", paddingVertical: 14,
    borderRadius: 14, alignItems: "center", marginTop: 12,
  },
  clearBtn: {
    borderWidth: 1, borderColor: "#FFCDD2",
    paddingVertical: 12, borderRadius: 14,
    alignItems: "center", marginTop: 10, backgroundColor: "#FFF8F8",
  },

  // Sticky bottom wrapper
  stickyBottom: {
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#EFEFEF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
    paddingBottom: 12,
  },

  // Action row inside stickyBottom
  actionBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 0,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 15, borderRadius: 14,
    backgroundColor: "#F0F0F0", alignItems: "center", marginRight: 10,
  },
  cancelText: { color: "#555", fontSize: 15 },
  confirmBtn: {
    flex: 2, paddingVertical: 15, borderRadius: 14,
    backgroundColor: "#2254C5", alignItems: "center",
    shadowColor: "#2254C5", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  confirmBtnOff: { backgroundColor: "#C0C8D8", shadowOpacity: 0 },
  confirmText: { color: "#FFF", fontSize: 15 },

  // Continue scan row
  continueBtn: {
    alignSelf: "center",
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: "#2254C5",
    backgroundColor: "#EEF2FF",
  },
  continueBtnText: { color: "#2254C5", fontSize: 14, fontWeight: "700" },


  // Loading
  loadingOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center", alignItems: "center",
  },
  loadingBox: {
    backgroundColor: "#FFF", padding: 28, borderRadius: 20, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 10, elevation: 5,
  },
  loadingText: { marginTop: 14, fontSize: 15, color: "#444" },

  // Success bottom sheet
  successOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end",
  },
  successSheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 28, alignItems: "center", paddingBottom: 40,
  },
  successIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#4CAF50",
    justifyContent: "center", alignItems: "center", marginBottom: 16,
    shadowColor: "#4CAF50", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  successTitle: { fontSize: 22, color: "#111", marginBottom: 6 },
  successSub: { fontSize: 13, color: "#888", textAlign: "center", marginBottom: 20, lineHeight: 18 },

  // QR
  qrCard: {
    alignItems: "center", backgroundColor: "#FAFBFF",
    borderRadius: 18, padding: 20, marginBottom: 20,
    borderWidth: 1, borderColor: "#E5EAFF", width: "100%",
  },
  qrHead: { fontSize: 15, color: "#2254C5", marginBottom: 14 },
  qrWrap: {
    padding: 12, backgroundColor: "#FFF", borderRadius: 12,
    borderWidth: 1, borderColor: "#EAEAEA",
  },
  qrAmt: { fontSize: 22, color: "#2254C5", marginTop: 14 },
  qrId: { fontSize: 12, color: "#AAA", marginTop: 4 },

  doneBtn: {
    backgroundColor: "#2254C5", width: "100%",
    paddingVertical: 16, borderRadius: 16, alignItems: "center",
    shadowColor: "#2254C5", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28, shadowRadius: 8, elevation: 5,
  },
});
