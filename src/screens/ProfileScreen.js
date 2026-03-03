import React, { useState, useCallback } from "react";
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
  const [district, setDistrict] = useState("");
  const [country, setCountry] = useState("");
  const [district, setDistrict] = useState("");
  const [phone, setPhone] = useState("");
  const [totalItems, setTotalItems] = useState(null);
  const [totalSales, setTotalSales] = useState(null);

  useFocusEffect(
    useCallback(() => {
      // Load profile info from storage
      (async () => {
        const name = await AsyncStorage.getItem("store_name");
        const stateV = await AsyncStorage.getItem("state");
        const districtV = await AsyncStorage.getItem("district");
        const countryV = await AsyncStorage.getItem("country");
        const districtV = await AsyncStorage.getItem("district");
        const phoneV = await AsyncStorage.getItem("phone");
        setStoreName(name || "My Store");
        setState(stateV || "");
        setDistrict(districtV || "");
        setCountry(countryV || "");
        setDistrict(districtV || "");
        setPhone(phoneV || "");
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

  const handleLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove(["token", "store_name", "state", "district", "country", "phone"]);
          navigation.replace("Login");
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
      </ScrollView>
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
});
