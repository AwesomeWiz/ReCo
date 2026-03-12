import React, { useState, useCallback, useContext } from "react";
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import AppText from "../components/AppText";
import api from "../api/api";
import { CartContext } from "../context/CartContext";
import { Modal, KeyboardAvoidingView, TextInput, Platform, Alert as RNAlert } from "react-native";

const BG = "#F5F1E8";
const WHITE = "#FFFFFF";
const ACCENT = "#3A6FF7";
const DANGER = "#DC2626";
const TEXT = "#111111";
const MUTED = "#888888";
const BORDER = "#EBEBEB";

// ─── Row item inside a settings card ─────────────────────────────────────────
function RowItem({ icon, label, value, onPress, danger }) {
  return (
    <TouchableOpacity
      style={s.rowItem}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={[s.rowIcon, { backgroundColor: danger ? "#FEE2E2" : "#EEF2FF" }]}>
        <Ionicons name={icon} size={16} color={danger ? DANGER : ACCENT} />
      </View>
      <AppText style={[s.rowLabel, danger && { color: DANGER }]}>{label}</AppText>
      <View style={{ flex: 1 }} />
      {value ? (
        <AppText style={s.rowValue} numberOfLines={1}>{value}</AppText>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={15} color={MUTED} />
      ) : null}
    </TouchableOpacity>
  );
}

// ─── ProfileScreen ────────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const [storeName, setStoreName] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [district, setDistrict] = useState("");
  const [phone, setPhone] = useState("");
  const [totalItems, setTotalItems] = useState(null);
  const [totalSales, setTotalSales] = useState(null);
  const [upiId, setUpiId] = useState("");
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [tempUpi, setTempUpi] = useState("");

  const { clearCart } = useContext(CartContext);

  useFocusEffect(
    useCallback(() => {
      // Load profile info from storage
      (async () => {
        const name = await AsyncStorage.getItem("store_name");
        const stateV = await AsyncStorage.getItem("state");
        const countryV = await AsyncStorage.getItem("country");
        const districtV = await AsyncStorage.getItem("district");
        const phoneV = await AsyncStorage.getItem("phone");
        const upiV = await AsyncStorage.getItem("upi_id");

        setStoreName(name || "My Store");
        setState(stateV || "");
        setDistrict(districtV || "");
        setCountry(countryV || "");
        setPhone(phoneV || "");
        setUpiId(upiV || "");
      })();

      // Fetch quick stats
      (async () => {
        try {
          const [invRes, sumRes] = await Promise.allSettled([
            api.get("/inventory"),
            api.get("/analytics/summary?period=monthly"),
          ]);
          if (invRes.status === "fulfilled") setTotalItems(invRes.value.data?.length ?? 0);
          if (sumRes.status === "fulfilled") {
            const d = sumRes.value.data;
            setTotalSales(d?.total_sales ?? 0);
          }
        } catch (_) { }
      })();
    }, [])
  );

  const handleSaveUpi = async () => {
    await AsyncStorage.setItem("upi_id", tempUpi);
    setUpiId(tempUpi);
    setShowUpiModal(false);
  };

  const handleLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove([
            "mfr_token",
            "store_name",
            "state",
            "district",
            "country",
            "phone"
          ]);
          clearCart();
          navigation.reset({
            index: 0,
            routes: [{ name: "Login" }],
          });
        },
      },
    ]);
  };

  const locationParts = [district, state, country].filter(Boolean).join(", ");
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── Title ───────────────────────────────────────────────────────────── */}
        <AppText font="satoshi" style={s.pageTitle}>Profile</AppText>

        {/* ── Avatar + store name ─────────────────────────────────────────────── */}
        <View style={s.avatarCard}>
          <View style={s.avatar}>
            <Ionicons name="storefront" size={34} color={WHITE} />
          </View>
          <AppText font="bold" style={s.storeName}>{storeName}</AppText>
          {locationParts ? (
            <View style={s.locationRow}>
              <Ionicons name="location-outline" size={13} color={MUTED} style={{ marginRight: 3 }} />
              <AppText style={s.locationText}>{locationParts}</AppText>
            </View>
          ) : null}
        </View>

        {/* ── Quick stats ─────────────────────────────────────────────────────── */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <AppText font="bold" style={s.statValue}>
              {totalItems !== null ? totalItems : "—"}
            </AppText>
            <AppText style={s.statLabel}>Products</AppText>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <AppText font="bold" style={s.statValue}>
              {totalSales !== null ? `₹${Number(totalSales).toLocaleString("en-IN")}` : "—"}
            </AppText>
            <AppText style={s.statLabel}>Revenue (30d)</AppText>
          </View>
        </View>

        {/* ── Store info ──────────────────────────────────────────────────────── */}
        <AppText style={s.groupLabel}>Store Details</AppText>
        <View style={s.card}>
          <RowItem icon="storefront-outline" label="Store name" value={storeName} />
          <View style={s.divider} />
          <RowItem icon="map-outline" label="District" value={district || "—"} />
          <View style={s.divider} />
          <RowItem icon="location-outline" label="State" value={state || "—"} />
          <View style={s.divider} />
          <RowItem icon="earth-outline" label="Country" value={country || "—"} />
          {phone ? (
            <>
              <View style={s.divider} />
              <RowItem icon="call-outline" label="Phone" value={phone} />
            </>
          ) : null}
          <View style={s.divider} />
          <RowItem
            icon="qr-code-outline"
            label="UPI ID"
            value={upiId || "Not set"}
            onPress={() => {
              setTempUpi(upiId);
              setShowUpiModal(true);
            }}
          />
        </View>

        {/* ── App section ─────────────────────────────────────────────────────── */}
        <AppText style={s.groupLabel}>App</AppText>
        <View style={s.card}>
          <RowItem icon="cube-outline" label="Inventory" onPress={() => navigation.navigate("Inventory")} />
          <View style={s.divider} />
          <RowItem icon="bar-chart-outline" label="Analytics" onPress={() => navigation.navigate("Analytics")} />
        </View>

        {/* ── Logout ──────────────────────────────────────────────────────────── */}
        <View style={s.card}>
          <RowItem icon="log-out-outline" label="Log out" onPress={handleLogout} danger />
        </View>

        <AppText style={s.versionText}>ReCo · v1.0</AppText>
        <AppText style={s.creditsText}>Made with love from Kakkanad 🌴</AppText>
        <AppText style={s.creditsSubText}>By Abhishikth, Arnold, Alen Abhraham Saji and Alan Jophy</AppText>
      </ScrollView>

      {/* ─── UPI Modal ──────────────────────────────────────────────────────── */}
      <Modal visible={showUpiModal} transparent={true} animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={s.modalContainer}
        >
          <View style={s.modalBox}>
            <AppText font="bold" style={s.modalTitle}>Set UPI ID</AppText>
            <AppText style={s.modalSubtitle}>Enter your store's UPI ID for payment QR generation</AppText>

            <TextInput
              style={s.textInput}
              value={tempUpi}
              onChangeText={setTempUpi}
              placeholder="e.g. yourname@upi"
              placeholderTextColor="#999"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <View style={s.modalBtnRow}>
              <TouchableOpacity
                style={[s.modalBtn, s.cancelBtn]}
                onPress={() => setShowUpiModal(false)}
              >
                <AppText style={{ color: "#333", fontWeight: "600" }}>Cancel</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.saveBtn]}
                onPress={handleSaveUpi}
              >
                <AppText style={{ color: "#FFF", fontWeight: "600" }}>Save</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  content: { padding: 20, paddingBottom: 48 },

  pageTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: TEXT,
    letterSpacing: -0.5,
    marginBottom: 20,
  },

  // Avatar card
  avatarCard: {
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  storeName: { fontSize: 20, color: TEXT, marginBottom: 6 },
  locationRow: { flexDirection: "row", alignItems: "center" },
  locationText: { fontSize: 13, color: MUTED },

  // Stats
  statsRow: {
    flexDirection: "row",
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statBox: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 20, color: TEXT, marginBottom: 3 },
  statLabel: { fontSize: 11, color: MUTED },
  statDivider: { width: 1, backgroundColor: BORDER, marginHorizontal: 8 },

  // Group label
  groupLabel: {
    fontSize: 12,
    color: MUTED,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
    paddingLeft: 4,
  },

  // Card
  card: {
    backgroundColor: WHITE,
    borderRadius: 18,
    paddingHorizontal: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  divider: { height: 1, backgroundColor: BORDER, marginLeft: 44 },

  // Row item
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  rowLabel: { fontSize: 14, color: TEXT },
  rowValue: { fontSize: 13, color: MUTED, maxWidth: 160, textAlign: "right" },

  // Footer
  versionText: {
    textAlign: "center",
    fontSize: 12,
    color: MUTED,
    marginTop: 8,
  },
  creditsText: {
    textAlign: "center",
    fontSize: 12,
    color: TEXT,
    fontWeight: "500",
    marginTop: 6,
  },
  creditsSubText: {
    textAlign: "center",
    fontSize: 10,
    color: MUTED,
    marginTop: 2,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalBox: {
    backgroundColor: "#FFF",
    width: "100%",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: { fontSize: 20, color: "#111", marginBottom: 6 },
  modalSubtitle: { fontSize: 14, color: "#666", marginBottom: 20 },
  textInput: {
    backgroundColor: "#F7F8FA",
    borderWidth: 1,
    borderColor: "#EAEAEA",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#111",
    marginBottom: 24,
  },
  modalBtnRow: { flexDirection: "row", gap: 12 },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelBtn: { backgroundColor: "#EAEAEA" },
  saveBtn: { backgroundColor: "#2254C5" },
});
