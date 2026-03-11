import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AppText from "../components/AppText";
import api from "../api/api";
import labelData from "../data/labelMapping.json";
import { Ionicons } from "@expo/vector-icons";

const BG = "#F5F1E8";
const WHITE = "#FFFFFF";
const ACCENT = "#3A6FF7";
const DANGER = "#E53935";

export default function InventoryScreen({ navigation, route }) {
  const [inventory, setInventory] = useState([]);
  const [showAdd, setShowAdd] = useState(false);

  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [barcode, setBarcode] = useState("");

  const productList = Object.values(labelData.product_names);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);

  // Edit states
  const [showEdit, setShowEdit] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editBarcode, setEditBarcode] = useState("");

  const CATEGORIES = [
    "Beverages",
    "Snacks",
    "Bakery",
    "Personal Care",
    "Groceries",
  ];

  const fetchInventory = async () => {
    try {
      const res = await api.get("/inventory");
      setInventory(res.data || []);
    } catch (err) {
      console.log(err.response?.data || err.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchInventory();
    }, [])
  );

  // When returning from BarcodeScanner, process the scanned barcode
  useEffect(() => {
    const code = route.params?.scannedBarcode;
    if (!code) return;
    navigation.setParams({ scannedBarcode: undefined });
    setBarcode(code);
    setShowAdd(true); // Re-open the form in case it collapsed on navigation
    // Auto-fill from existing product if barcode matches
    api.post("/inventory/barcode-lookup", { barcode: code })
      .then((res) => {
        if (res.data.found) {
          const p = res.data.product;
          setProductName(p.name);
          setSearchQuery(p.name);
          setPrice(String(p.price));
          setCategory(p.category || "");
          // Stock is intentionally left blank so user can enter the new quantity to add
        }
      })
      .catch(() => {
        // Not found or failed — user fills manually, barcode is still set
      });
  }, [route.params?.scannedBarcode]);

  const handleAddProduct = async () => {
    if (!category) {
      Alert.alert("Please select a category");
      return;
    }

    try {
      const res = await api.post("/inventory/add", {
        name: productName || searchQuery,
        category,
        barcode: barcode || null,
        price: Number(price),
        stock: Number(stock),
      });

      const wasMerged = res.data?.merged;
      Alert.alert(
        wasMerged ? "Stock Updated" : "Product Added",
        wasMerged
          ? `Stock added to existing product.`
          : `New product saved to inventory.`
      );

      fetchInventory();

      setProductName("");
      setSearchQuery("");
      setCategory("");
      setPrice("");
      setStock("");
      setBarcode("");
      setShowAdd(false);
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || err.message);
    }
  }; 

      const handleDeleteProduct = (id) => {
        Alert.alert(
          "Remove Product",
          "Are you sure you want to delete this product?",
          [
            { text: "No", style: "cancel" },
            {
              text: "Yes, Delete",
              style: "destructive",
              onPress: async () => {
                try {
                  await api.delete(`/inventory/${id}`);
                  fetchInventory();
                } catch (err) {
                  Alert.alert("Error", "Could not delete product");
                }
              }
            }
          ]
        );
      };

      const startEdit = (item) => {
        setEditingItem(item);
        setEditName(item.product_name);
        setEditCategory(item.category || "");
        setEditPrice(String(item.price));
        setEditStock(String(item.stock));
        setEditBarcode(item.barcode || "");
        setShowEdit(true);
      };

      const handleUpdateProduct = async () => {
        if (!editName || !editCategory) {
          Alert.alert("Missing fields", "Please provide a name and category.");
          return;
        }

        try {
          await api.put(`/inventory/${editingItem.id}`, {
            product_name: editName,
            category: editCategory,
            price: Number(editPrice),
            stock: Number(editStock),
            barcode: editBarcode || null
          });

          Alert.alert("Success", "Product updated");
          setShowEdit(false);
          fetchInventory();
        } catch (err) {
          Alert.alert("Update Failed", err.response?.data?.error || err.message);
        }
      };

      const handleSearch = (text) => {
        setSearchQuery(text);

        if (text.length === 0) {
          setFilteredProducts([]);
          return;
        }

        const results = productList.filter((item) =>
          item.toLowerCase().includes(text.toLowerCase())
        );

        setFilteredProducts(results.slice(0, 5));
      };

      return (
        <SafeAreaView style={s.safe}>
          <ScrollView contentContainerStyle={s.content}>
            <AppText font="satoshi" style={s.title}>
              Inventory
            </AppText>

            {/* ADD BUTTON */}
            <TouchableOpacity
              style={s.addBtn}
              onPress={() => {
                if (showAdd) {
                  // Clear all form fields when cancelling
                  setProductName("");
                  setSearchQuery("");
                  setCategory("");
                  setPrice("");
                  setStock("");
                  setBarcode("");
                  setFilteredProducts([]);
                }
                setShowAdd(!showAdd);
                
              }}
            >
              <AppText font="satoshi" style={s.addText}>
                {showAdd ? "Cancel" : "Add Product"}
              </AppText>
            </TouchableOpacity>

            {/* ADD FORM */}
            {showAdd && (
              <View style={s.formCard}>
                <AppText style={{ marginBottom: 4, fontWeight: "600" }}>
                  Product Name
                </AppText>
                <TextInput
                  placeholder="Search or Enter Product Name"
                  style={s.input}
                  value={searchQuery}
                  onChangeText={handleSearch}
                />

                {filteredProducts.length > 0 && (
                  <View style={s.dropdown}>
                    {filteredProducts.map((item, index) => (
                      <TouchableOpacity
                        key={index}
                        style={s.dropdownItem}
                        onPress={() => {
                          setProductName(item);
                          setSearchQuery(item);
                          setFilteredProducts([]);
                        }}
                      >
                        <AppText>{item}</AppText>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* SCAN BARCODE BUTTON */}
                <TouchableOpacity
                  style={s.scanBarcodeBtn}
                  onPress={() =>
                    navigation.navigate("BarcodeScanner", { mode: "inventory" })
                  }
                >
                  <AppText style={s.scanBarcodeText}>
                    Scan Barcode
                  </AppText>
                </TouchableOpacity>

                {barcode ? (
                  <AppText style={s.barcodeText}>
                    Barcode: {barcode}
                  </AppText>
                ) : null}

                {/* CATEGORY */}
                <View style={s.categoryWrapper}>
                  <AppText style={{ marginBottom: 8, fontWeight: "600" }}>
                    Select Category
                  </AppText>

                  <View style={s.categoryRow}>
                    {CATEGORIES.map((item) => (
                      <TouchableOpacity
                        key={item}
                        style={[
                          s.categoryBtn,
                          category === item && s.categorySelected,
                        ]}
                        onPress={() => setCategory(item)}
                      >
                        <AppText
                          style={[
                            s.categoryText,
                            category === item && { color: "#fff" },
                          ]}
                        >
                          {item}
                        </AppText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <AppText style={{ marginBottom: 4, fontWeight: "600" }}>
                  Price
                </AppText>
                <TextInput
                  placeholder="Price"
                  keyboardType="numeric"
                  style={s.input}
                  value={price}
                  onChangeText={setPrice}
                />
                <AppText style={{ marginBottom: 4, fontWeight: "600" }}>
                  Stock
                </AppText>
                <TextInput
                  placeholder="Stock"
                  keyboardType="numeric"
                  style={s.input}
                  value={stock}
                  onChangeText={setStock}
                />

                <TouchableOpacity style={s.saveBtn} onPress={handleAddProduct}>
                  <AppText font="satoshi" style={s.saveText}>
                    Save Product
                  </AppText>
                </TouchableOpacity>
              </View>
            )}

            {/* INVENTORY LIST */}
            {inventory.length === 0 ? (
              <AppText style={s.empty}>
                No products in inventory.
              </AppText>
            ) : (
              inventory.map((item) => (
                <View key={item.id} style={s.card}>
                  <View style={s.leftSection}>
                    <AppText font="semibold" style={s.productName}>
                      {item.product_name}
                    </AppText>

                    <AppText style={s.category}>
                      {item.category}
                    </AppText>

                    {item.barcode ? (
                      <AppText style={s.barcode}>
                        📦 {item.barcode}
                      </AppText>
                    ) : null}

                    <AppText style={s.price}>
                      ₹{Number(item.price).toFixed(2)}
                    </AppText>
                  </View>

                  <View style={s.rightSection}>
                    <AppText
                      style={[
                        s.stock,
                        item.stock <= 5 && item.stock > 0 && { color: DANGER },
                        item.stock === 0 && {
                          color: DANGER,
                          fontWeight: "bold",
                        },
                      ]}
                    >
                      Stock: {item.stock}
                    </AppText>

                      <View style={s.actionRow}>
                        <TouchableOpacity
                          style={s.iconBtn}
                          onPress={() => startEdit(item)}
                        >
                          <Ionicons name="create-outline" size={22} color={ACCENT} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.iconBtn}
                          onPress={() => handleDeleteProduct(item.id)}
                        >
                          <Ionicons name="trash-outline" size={22} color={DANGER} />
                        </TouchableOpacity>
                      </View>
                  </View>
                </View>
              ))
            )}

            {/* EDIT MODAL */}
            {showEdit && (
              <Modal visible={showEdit} transparent animationType="slide">
                <View style={s.modalOverlay}>
                  <View style={s.modalContent}>
                    <AppText font="bold" style={s.modalTitle}>Edit Product</AppText>

                    <ScrollView>
                      <AppText style={s.fieldLabel}>Product Name</AppText>
                      <TextInput
                        style={s.input}
                        value={editName}
                        onChangeText={setEditName}
                      />

                      <AppText style={s.fieldLabel}>Category</AppText>
                      <View style={s.categoryRow}>
                        {CATEGORIES.map((item) => (
                          <TouchableOpacity
                            key={item}
                            style={[
                              s.categoryBtn,
                              editCategory === item && s.categorySelected,
                            ]}
                            onPress={() => setEditCategory(item)}
                          >
                            <AppText style={[s.categoryText, editCategory === item && { color: "#fff" }]}>
                              {item}
                            </AppText>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <AppText style={s.fieldLabel}>Price (₹)</AppText>
                      <TextInput
                        style={s.input}
                        keyboardType="numeric"
                        value={editPrice}
                        onChangeText={setEditPrice}
                      />

                      <AppText style={s.fieldLabel}>Stock</AppText>
                      <TextInput
                        style={s.input}
                        keyboardType="numeric"
                        value={editStock}
                        onChangeText={setEditStock}
                      />

                      <AppText style={s.fieldLabel}>Barcode</AppText>
                      <TextInput
                        style={s.input}
                        value={editBarcode}
                        onChangeText={setEditBarcode}
                      />

                      <View style={s.btnRow}>
                        <TouchableOpacity
                          style={[s.modalBtn, { backgroundColor: "#ccc" }]}
                          onPress={() => setShowEdit(false)}
                        >
                          <AppText style={{ color: "#333" }}>Cancel</AppText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.modalBtn, { backgroundColor: ACCENT }]}
                          onPress={handleUpdateProduct}
                        >
                          <AppText style={{ color: "#fff" }}>Save Changes</AppText>
                        </TouchableOpacity>
                      </View>
                    </ScrollView>
                  </View>
                </View>
              </Modal>
            )}
          </ScrollView>
        </SafeAreaView>
      );
    }

const s = StyleSheet.create({
      safe: { flex: 1, backgroundColor: BG },
      content: { padding: 16 },
      title: { fontSize: 32, marginBottom: 20 },

      addBtn: {
        backgroundColor: ACCENT,
        padding: 12,
        borderRadius: 25,
        alignItems: "center",
        marginBottom: 20,
      },
      addText: { color: "#fff", fontWeight: "600", fontSize: 16 },

      formCard: {
        backgroundColor: WHITE,
        padding: 16,
        borderRadius: 16,
        marginBottom: 20,
      },

      input: {
        borderWidth: 1,
        borderColor: "#ddd",
        padding: 10,
        borderRadius: 12,
        marginBottom: 10,
        color: "#1a1a1a",
      },

      scanBarcodeBtn: {
        backgroundColor: ACCENT,
        padding: 10,
        borderRadius: 12,
        alignItems: "center",
        marginBottom: 10,
      },

      scanBarcodeText: {
        color: "#fff",
        fontWeight: "600",
      },

      barcodeText: {
        marginBottom: 10,
        fontWeight: "600",
        color: "#333",
      },

      saveBtn: {
        backgroundColor: "#000",
        padding: 12,
        borderRadius: 25,
        alignItems: "center",
      },
      saveText: { color: "#fff", fontWeight: "600", fontSize: 16 },

      card: {
        backgroundColor: WHITE,
        padding: 16,
        borderRadius: 18,
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 12,
      },

      leftSection: { width: "70%" },

      rightSection: {
        width: "30%",
        justifyContent: "center",
        alignItems: "flex-end",
      },

      dropdown: {
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 12,
        marginBottom: 10,
      },

      dropdownItem: {
        padding: 10,
        borderBottomWidth: 1,
        borderColor: "#eee",
        color: "#1a1a1a",
      },

      categoryWrapper: { marginBottom: 12 },

      categoryRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 10,
      },

      categoryBtn: {
        borderWidth: 1,
        borderColor: ACCENT,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        marginRight: 8,
        marginBottom: 8,
      },

      categorySelected: { backgroundColor: ACCENT },

      categoryText: {
        fontSize: 12,
        color: ACCENT,
        fontWeight: "600",
      },

      productName: { flexWrap: "wrap", color: "#1a1a1a", fontSize: 16 },

      price: { marginTop: 6, fontWeight: "600", color: "#1a1a1a" },

      category: { fontSize: 12, color: "#666", marginTop: 2 },

      barcode: { fontSize: 11, color: "#999", marginTop: 2 },

      stock: { fontSize: 14, fontWeight: "600", color: "#1a1a1a" },

      actionRow: {
        flexDirection: 'row',
        marginTop: 10,
        gap: 12,
      },

      iconBtn: {
        padding: 4,
      },

      iconImg: {
        width: 20,
        height: 20,
        resizeMode: "contain",
      },

      modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
      },
      modalContent: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: "80%",
      },
      modalTitle: {
        fontSize: 20,
        color: "#1a1a1a",
        marginBottom: 20,
        textAlign: "center",
      },
      fieldLabel: {
        fontSize: 14,
        color: "#666",
        marginBottom: 6,
        fontWeight: "600",
      },
      btnRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 20,
        gap: 12,
      },
      modalBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
      },

      empty: { textAlign: "center", marginTop: 40, color: "#808080" },
    });