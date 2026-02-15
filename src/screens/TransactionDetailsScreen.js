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

const BG = "#F5F1E8";
const WHITE = "#FFFFFF";
const ACCENT = "#3A6FF7";

export default function TransactionDetailsScreen({ route }) {
  const { transactionId } = route.params;

  const [transaction, setTransaction] = useState(null);

  useEffect(() => {
    fetchTransaction();
  }, []);

  const fetchTransaction = async () => {
    try {
      const res = await api.get(`/transactions/${transactionId}`);
      setTransaction(res.data);
    } catch (err) {
      console.log("Fetch transaction error:", err.response?.data || err.message);
    }
  };

  if (!transaction) return null;

  const displayDate = new Date(
    transaction.created_at
  ).toLocaleDateString("en-GB");

  const displayTime = new Date(
    transaction.created_at
  ).toLocaleTimeString();

  const generatePDF = async () => {
    const rows = transaction.items
      .map(
        (item) => `
        <tr>
          <td>${item.description}</td>
          <td>${item.qty}</td>
          <td>${item.rate}</td>
          <td>${item.amount}</td>
        </tr>`
      )
      .join("");

    const html = `
      <html>
        <body style="font-family: Arial; padding: 20px;">
          <h2>SR BAKERY</h2>
          <p>${displayDate} ${displayTime}</p>
          <table width="100%" border="1" cellspacing="0" cellpadding="6">
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
            ${rows}
          </table>
          <h3>Total: ₹${Number(transaction.total).toFixed(2)}</h3>
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
          <AppText style={s.downloadText}>Download PDF</AppText>
        </TouchableOpacity>

        <View style={s.receipt}>
          <ZigzagEdge />

          <View style={s.receiptBody}>
            <AppText font="billbold" style={s.shopName}>
              SR BAKERY
            </AppText>
            <AppText font="billsemi" style={s.shopCity}>
              KOCHI, KERALA
            </AppText>

            <DottedLine />
            <AppText font="billbold" style={s.saleBanner}>
              RECEIPT
            </AppText>
            <DottedLine />

            <AppText font="billsemi" style={s.date}>
              {displayDate} {displayTime}
            </AppText>

            <AppText font="billsemi" style={s.txn}>
              {transaction.transaction_code}
            </AppText>

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
              TOTAL: ₹{Number(transaction.total).toFixed(2)}
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
