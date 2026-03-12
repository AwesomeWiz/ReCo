import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import AppText from "../components/AppText";
import api from "../api/api";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BG = "#F5F1E8";
const WHITE = "#FFFFFF";
const ACCENT = "#3A6FF7";

export default function SalesHistoryScreen({ navigation }) {
  const [transactions, setTransactions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const fetchTransactions = async (dateObj) => {
    try {
      const formatted = dateObj.toLocaleDateString("en-CA");
      const res = await api.get(`/transactions/by-date?date=${formatted}`);
      setTransactions(res.data || []);
    } catch (err) {
      console.log("Fetch error:", err.response?.data || err.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTransactions(selectedDate);
    }, [selectedDate])
  );

  const displayDate = selectedDate.toLocaleDateString("en-GB");

  const onDateChange = (event, date) => {
    if (Platform.OS === "android") setShowPicker(false);
    if (date) setSelectedDate(date);
  };

  // Grand total for the day
  const grandTotal = transactions.reduce((sum, t) => sum + Number(t.total || 0), 0);

  // Download today's sales as PDF (Itemized)
  const downloadDailyReport = async () => {
    try {
      const formatted = selectedDate.toLocaleDateString("en-CA");
      // Fetch detailed items for this date
      const res = await api.get(`/sales/today?date=${formatted}`);
      const items = res.data || [];

      // Aggregate items by description (product name)
      const aggregated = items.reduce((acc, item) => {
        const name = item.description;
        if (!acc[name]) {
          acc[name] = { qty: 0, amount: 0, rate: item.rate };
        }
        acc[name].qty += Number(item.qty);
        acc[name].amount += Number(item.amount);
        return acc;
      }, {});

      const storeName = (await AsyncStorage.getItem("store_name")) || "My Store";
      const state = (await AsyncStorage.getItem("state")) || "";

      const rows = Object.keys(aggregated)
        .sort()
        .map((name) => {
          const data = aggregated[name];
          return `<tr>
              <td>${name}</td>
              <td style="text-align:right">${data.qty}</td>
              <td style="text-align:right">₹${Number(data.rate).toFixed(2)}</td>
              <td style="text-align:right">₹${Number(data.amount).toFixed(2)}</td>
            </tr>`;
        })
        .join("");

      const totalValue = Object.values(aggregated).reduce((sum, item) => sum + item.amount, 0);

      const html = `
        <html>
          <body style="font-family: Arial; padding: 24px;">
            <h2 style="text-align:center; letter-spacing:3px">${storeName.toUpperCase()}</h2>
            <p style="text-align:center; color:#666">${state.toUpperCase()}</p>
            <hr/>
            <h3 style="text-align:center">DAILY SALES REPORT</h3>
            <p style="text-align:center">${displayDate}</p>
            <hr/>
            <table width="100%" border="1" cellspacing="0" cellpadding="8" style="border-collapse:collapse">
              <tr style="background:#eee">
                <th style="text-align:left">Product</th>
                <th style="text-align:right">Qty</th>
                <th style="text-align:right">Rate</th>
                <th style="text-align:right">Amount</th>
              </tr>
              ${rows}
            </table>
            <p style="text-align:right; font-size:16px; font-weight:bold; margin-top:16px">
              TOTAL: ₹${totalValue.toFixed(2)}
            </p>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (err) {
      console.log("PDF error:", err.message);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <AppText font="satoshi" style={s.title}>
          Transactions
        </AppText>

        {/* Date picker + Download button row */}
        <View style={s.topRow}>
          <TouchableOpacity
            style={s.dateBtn}
            onPress={() => setShowPicker(true)}
          >
            <AppText style={s.dateText}>{displayDate}</AppText>
          </TouchableOpacity>

          <TouchableOpacity style={s.pdfBtn} onPress={downloadDailyReport}>
            <AppText style={s.pdfText}>⬇ PDF</AppText>
          </TouchableOpacity>
        </View>

        {Platform.OS === "ios" ? (
          <Modal visible={showPicker} transparent animationType="slide">
            <View style={s.modalOverlay}>
              <View style={s.modalContent}>
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="inline"
                  onChange={onDateChange}
                  maximumDate={new Date()}
                  themeVariant="light"
                />
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <AppText style={s.done}>Done</AppText>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        ) : (
          showPicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={onDateChange}
              maximumDate={new Date()}
            />
          )
        )}

        {transactions.length === 0 ? (
          <AppText style={s.empty}>
            No transactions on this date.
          </AppText>
        ) : (
          <>
            {transactions.map((txn) => (
              <TouchableOpacity
                key={txn.id}
                style={s.card}
                onPress={() =>
                  navigation.navigate("TransactionDetails", {
                    transactionId: txn.id,
                  })
                }
              >
                <View>
                  <AppText font="billbold">
                    {txn.transaction_code}
                  </AppText>
                  <AppText style={s.small}>
                    {txn.formatted_time}
                  </AppText>
                </View>

                <AppText font="billbold" style={s.total}>
                  ₹{Number(txn.total).toFixed(2)}
                </AppText>
              </TouchableOpacity>
            ))}

            {/* Grand Total Footer */}
            <View style={s.grandTotalRow}>
              <AppText font="satoshi" style={s.grandLabel}>
                Day Total
              </AppText>
              <AppText font="satoshi" style={s.grandAmount}>
                ₹{grandTotal.toFixed(2)}
              </AppText>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  content: { padding: 16 },
  title: { fontSize: 32, marginBottom: 16 },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },

  dateBtn: {
    backgroundColor: WHITE,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  dateText: { color: ACCENT, fontWeight: "600" },

  pdfBtn: {
    backgroundColor: ACCENT,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  pdfText: { color: "#fff", fontWeight: "600" },

  card: {
    backgroundColor: WHITE,
    padding: 16,
    borderRadius: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  total: { fontSize: 18 },
  small: { fontSize: 12, color: "#666" },
  empty: { textAlign: "center", marginTop: 30 },

  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#000",
    padding: 16,
    borderRadius: 18,
    marginTop: 4,
  },
  grandLabel: { color: "#fff", fontSize: 16, fontWeight: "600" },
  grandAmount: { color: "#fff", fontSize: 20, fontWeight: "700" },

  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalContent: { backgroundColor: WHITE, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  done: { textAlign: "center", marginTop: 10, color: ACCENT },
});
