import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AppText from "../components/AppText";
import api from "../api/api";
import labelData from "../data/labelMapping.json";

const BG = "#F5F1E8";
const WHITE = "#FFFFFF";
const ACCENT = "#3A6FF7";
const DANGER = "#E53935";

export default function InventoryScreen({ navigation }) {
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

      fetchInventory();

      setProductName("");
      setSearchQuery("");
      setCategory("");
      setPrice("");
      setStock("");
      setBarcode("");
      setShowAdd(false);

    } catch (err) {
      console.log("ERROR:", err.response?.data || err.message);
      Alert.alert("Failed to save product");
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
          onPress={() => setShowAdd(!showAdd)}
        >
          <AppText font="satoshi" style={s.addText}>
            {showAdd ? "Cancel" : "Add Product"}
          </AppText>
        </TouchableOpacity>

        {/* ADD FORM */}
        {showAdd && (
          <View style={s.formCard}>
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
                navigation.navigate("BarcodeScanner", {
                  mode: "inventory",
                  onScan: (code) => setBarcode(code),
                })
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

            <TextInput
              placeholder="Price"
              keyboardType="numeric"
              style={s.input}
              value={price}
              onChangeText={setPrice}
            />

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
              </View>
            </View>
          ))
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

  leftSection: { width: "80%" },

  rightSection: {
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
  },

  categoryWrapper: { marginBottom: 12 },

  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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

  productName: { flexWrap: "wrap" },

  price: { marginTop: 6, fontWeight: "600" },

  category: { fontSize: 12, color: "#666", marginTop: 2 },

  stock: { fontSize: 14, fontWeight: "600" },

  empty: { textAlign: "center", marginTop: 40 },
});