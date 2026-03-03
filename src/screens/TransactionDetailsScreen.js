import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import AppText from "../components/AppText";
import api from "../api/api";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BG = "#F5F1E8";
const WHITE = "#FFFFFF";
const ACCENT = "#3A6FF7";

export default function TransactionDetailsScreen({ route }) {
  const { transactionId } = route.params;

  const [transaction, setTransaction] = useState(null);
  const [storeName, setStoreName] = useState("My Store");
  const [storeState, setStoreState] = useState("");
  const [storeDistrict, setStoreDistrict] = useState("");

  useEffect(() => {
    fetchTransaction();
    loadStoreInfo();
  }, []);

  const loadStoreInfo = async () => {
    const name = await AsyncStorage.getItem("store_name");
    const state = await AsyncStorage.getItem("state");
    const district = await AsyncStorage.getItem("district");
    if (name) setStoreName(name);
    if (state) setStoreState(state);
    if (district) setStoreDistrict(district);
  };

  const fetchTransaction = async () => {
    try {
      const res = await api.get(`/transactions/${transactionId}`);
      setTransaction(res.data);
    } catch (err) {
      console.log("Fetch transaction error:", err.response?.data || err.message);
    }
  };

  if (!transaction) return null;

  const dateObj = new Date(transaction.created_at);
  const displayDate = isNaN(dateObj)
    ? "—"
    : dateObj.toLocaleDateString("en-GB");
  const displayTime = isNaN(dateObj)
    ? "—"
    : dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Total: use backend value if available, otherwise sum from items (fallback for old Flask)
  const itemsTotal = (transaction.items || []).reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );
  const total = Number(transaction.total) > 0 ? Number(transaction.total) : itemsTotal;

  const generatePDF = async () => {
    const rows = transaction.items
      .map(
        (item) => `
        <tr>
          <td>${item.description}</td>
          <td style="text-align:right">${Number(item.qty).toFixed(2)}</td>
          <td style="text-align:right">₹${Number(item.rate).toFixed(2)}</td>
          <td style="text-align:right">₹${Number(item.amount).toFixed(2)}</td>
        </tr>`
      )
      .join("");

    const html = `
      <html>
        <body style="font-family: Arial; padding: 24px;">
          <h2 style="text-align:center; letter-spacing:3px">${storeName.toUpperCase()}</h2>
          <p style="text-align:center; color:#666">${storeDistrict ? storeDistrict + ", " : ""}${storeState.toUpperCase()}</p>
          <hr/>
          <h3 style="text-align:center">RECEIPT</h3>
          <hr/>
          <p style="text-align:right; font-size:12px">${displayDate} ${displayTime}</p>
          <p style="text-align:right; font-size:12px">${transaction.transaction_code || ""}</p>
          <table width="100%" border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse">
            <tr style="background:#eee">
              <th style="text-align:left">Description</th>
              <th style="text-align:right">Qty</th>
              <th style="text-align:right">Rate</th>
              <th style="text-align:right">Amount</th>
            </tr>
            ${rows}
          </table>
          <p style="text-align:right; font-size:16px; font-weight:bold; margin-top:16px">
            TOTAL: ₹${total.toFixed(2)}
          </p>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri);
  };

  function DottedLine() {
    return (
      <View style={s.dotRow}>
        {Array.from({ length: 42 }).map((_, i) => (
          <View key={i} style={s.dot} />
        ))}
      </View>
    );
  }

  function ZigzagEdge({ flip = false }) {
    return (
      <View style={[s.zigRow, flip ? { bottom: -3 } : { top: -3 }]}>
        {Array.from({ length: 24 }).map((_, i) => (
          <View key={i} style={s.zigNotch} />
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <TouchableOpacity style={s.downloadBtn} onPress={generatePDF}>
          <AppText style={s.downloadText}>⬇ Download PDF</AppText>
        </TouchableOpacity>

        <View style={s.receipt}>
          <ZigzagEdge />

          <View style={s.receiptBody}>
            {/* Store name from AsyncStorage */}
            <AppText font="billbold" style={s.shopName}>
              {storeName.toUpperCase()}
            </AppText>
            {storeDistrict ? (
              <AppText font="billsemi" style={s.shopCity}>
                {storeDistrict.toUpperCase()}
              </AppText>
            ) : null}
            <AppText font="billsemi" style={s.shopCity}>
              {storeState.toUpperCase()}
            </AppText>

            <DottedLine />
            <AppText font="billbold" style={s.saleBanner}>
              RECEIPT
            </AppText>
            <DottedLine />

            {/* Date and time */}
            <AppText font="billsemi" style={s.date}>
              {displayDate}{"  "}{displayTime}
            </AppText>

            {/* Transaction code */}
            <AppText font="billsemi" style={s.txn}>
              {transaction.transaction_code}
            </AppText>

            {/* Items header */}
            <View style={s.row}>
              <AppText font="billbold" style={[s.cell, s.colDesc]}>
                DESCRIPTION
              </AppText>
              <AppText font="billbold" style={[s.cell, s.colNum]}>
                QTY
              </AppText>
              <AppText font="billbold" style={[s.cell, s.colNum]}>
                RATE
              </AppText>
              <AppText font="billbold" style={[s.cell, s.colNum]}>
                AMOUNT
              </AppText>
            </View>

            <DottedLine />

            {transaction.items.map((item, index) => (
              <View style={s.row} key={index}>
                <AppText font="billsemi" style={[s.cell, s.colDesc]}>
                  {item.description}
                </AppText>
                <AppText font="billsemi" style={[s.cell, s.colNum]}>
                  {Number(item.qty).toFixed(2)}
                </AppText>
                <AppText font="billsemi" style={[s.cell, s.colNum]}>
                  {Number(item.rate).toFixed(2)}
                </AppText>
                <AppText font="billsemi" style={[s.cell, s.colNum]}>
                  {Number(item.amount).toFixed(2)}
                </AppText>
              </View>
            ))}

            <DottedLine />

            <AppText font="billbold" style={s.total}>
              TOTAL: ₹{total.toFixed(2)}
            </AppText>
          </View>

          <ZigzagEdge flip />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  content: { padding: 14 },
  receipt: { backgroundColor: WHITE, position: "relative" },
  receiptBody: { paddingHorizontal: 16, paddingVertical: 8 },
  shopName: { fontSize: 21, textAlign: "center", letterSpacing: 3 },
  shopCity: { fontSize: 11, textAlign: "center", marginBottom: 10 },
  saleBanner: { textAlign: "center", marginVertical: 6 },
  date: { textAlign: "right", fontSize: 11 },
  txn: { textAlign: "right", fontSize: 11, marginBottom: 6 },
  row: { flexDirection: "row", paddingVertical: 3 },
  cell: { fontSize: 11 },
  colDesc: { flex: 2.4 },
  colNum: { flex: 1, textAlign: "right" },
  total: { textAlign: "right", marginTop: 8 },
  dotRow: { flexDirection: "row", justifyContent: "space-between" },
  dot: { width: 4, height: 1.5, backgroundColor: "#999" },
  zigRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    height: 6,
  },
  zigNotch: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: BG,
    marginVertical: -5.5,
  },
  downloadBtn: {
    backgroundColor: ACCENT,
    padding: 12,
    borderRadius: 20,
    alignSelf: "flex-end",
    marginBottom: 16,
  },
  downloadText: { color: "#fff", fontWeight: "600" },
});
