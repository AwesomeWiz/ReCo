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


  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <AppText font="satoshi" style={s.title}>
          Transactions
        </AppText>

        <TouchableOpacity
          style={s.dateBtn}
          onPress={() => setShowPicker(true)}
        >
          <AppText style={s.dateText}>{displayDate}</AppText>
        </TouchableOpacity>

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
 transactions.map((txn) => {
    console.log("Transaction data:", txn);
  return (
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
          {txn.formatted_time}  {/* Use pre-formatted time from backend */}
        </AppText>
      </View>

      <AppText font="billbold" style={s.total}>
        ₹{Number(txn.total).toFixed(2)}
      </AppText>
    </TouchableOpacity>
  );
})

        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  content: { padding: 16 },
  title: { fontSize: 32, marginBottom: 16 },

  dateBtn: {
    backgroundColor: WHITE,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: ACCENT,
    marginBottom: 20,
    alignSelf: "flex-start",
  },
  dateText: { color: ACCENT, fontWeight: "600" },

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
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalContent: { backgroundColor: WHITE, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  done: { textAlign: "center", marginTop: 10, color: ACCENT },
});
