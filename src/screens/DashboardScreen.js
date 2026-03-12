import React, { useEffect, useState, useCallback, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import api from "../api/api";
import AppText from "../components/AppText";
import { CartContext } from "../context/CartContext";
import DateTimePicker from "@react-native-community/datetimepicker";

// ─── Design tokens ───────────────────────────────────────────────────────────
const BG = "#F5F1E8";
const WHITE = "#FFFFFF";
const ACCENT = "#3A6FF7";

// ─── Data ────────────────────────────────────────────────────────────────────
const TODAY = "20/01/2026";

// ─── Pie chart helpers ───────────────────────────────────────────────────────
const PIE_SIZE = 220;
const CX = PIE_SIZE / 2;
const CY = PIE_SIZE / 2;
const R = 98;

function deg2rad(deg) { return (deg - 90) * (Math.PI / 180); }

function point(deg) {
  const rad = deg2rad(deg);
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
}

function slicePath(startDeg, endDeg) {
  const s = point(startDeg);
  const e = point(endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M${CX},${CY} L${s.x},${s.y} A${R},${R} 0 ${large},1 ${e.x},${e.y} Z`;
}

function midPoint(startDeg, endDeg, factor = 0.62) {
  const mid = deg2rad(startDeg + (endDeg - startDeg) / 2);
  return {
    x: CX + R * factor * Math.cos(mid),
    y: CY + R * factor * Math.sin(mid),
  };
}

// ─── PieChart ────────────────────────────────────────────────────────────────
function PieChart({ segments }) {
  let cursor = 0;
  const slices = segments.map((seg) => {
    const start = cursor;
    const end = cursor + (seg.pct / 100) * 360;
    cursor = end;
    return { ...seg, start, end };
  });

  return (
    <View style={{ width: PIE_SIZE, height: PIE_SIZE }}>
      {/* SVG arcs */}
      <Svg width={PIE_SIZE} height={PIE_SIZE} style={StyleSheet.absoluteFill}>
        {slices.map((sl, i) => (
          <Path key={i} d={slicePath(sl.start, sl.end)} fill={sl.color} />
        ))}
      </Svg>

      {/* Text labels */}
      {slices.map((sl, i) => {
        const mid = midPoint(sl.start, sl.end);
        return (
          <View
            key={i}
            style={[pie.label, { left: mid.x - 34, top: mid.y - 18 }]}
          >
            <Text style={pie.labelName}>{sl.label}</Text>
            <Text style={pie.labelPct}>{sl.pct}%</Text>
          </View>
        );
      })}
    </View>
  );
}

const pie = StyleSheet.create({
  label: {
    position: "absolute",
    width: 68,
    alignItems: "center",
  },
  labelName: {
    color: WHITE,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  labelPct: {
    color: WHITE,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

// ─── DottedLine ──────────────────────────────────────────────────────────────
function DottedLine() {
  return (
    <View style={s.dotRow}>
      {Array.from({ length: 42 }).map((_, i) => (
        <View key={i} style={s.dot} />
      ))}
    </View>
  );
}

// ─── ZigzagEdge ──────────────────────────────────────────────────────────────
// Simulates the perforated/jagged receipt edge via half-circles
function ZigzagEdge({ flip = false }) {
  return (
    <View style={[
      s.zigRow,
      flip ? { bottom: -3 } : { top: -3 }
    ]}>
      {Array.from({ length: 24 }).map((_, i) => (
        <View key={i} style={s.zigNotch} />
      ))}
    </View>
  );
}

// ─── SaleRow ─────────────────────────────────────────────────────────────────
function SaleRow({ item }) {
  return (
    <View style={s.row}>
      <AppText font="billsemi" style={[s.cell, s.colDesc]} numberOfLines={1}>
        {item.description}
      </AppText>
      <AppText font="billsemi" style={[s.cell, s.colNum]}>{Number(item.qty || 0).toFixed(2)}</AppText>
      <AppText font="billsemi" style={[s.cell, s.colNum]}>{Number(item.rate || 0).toFixed(2)}</AppText>
      <AppText font="billsemi" style={[s.cell, s.colNum]}>{Number(item.amount || 0).toFixed(2)}</AppText>
    </View>
  );
}

// ─── DashboardScreen ─────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const [sales, setSales] = useState([]);
  const [shopName, setShopName] = useState("");
  const [shopLocation, setShopLocation] = useState("");
  const [daySummary, setDaySummary] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { selectedDate, setSelectedDate } = useContext(CartContext);

  // Use the analytics summary for revenue (same source as Analytics screen)
  const totalRevenue = daySummary?.total_sales ?? sales.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const totalItems = daySummary?.total_items ?? sales.reduce((sum, s) => sum + Number(s.qty || 0), 0);
  const totalTransactions = daySummary?.total_transactions ?? sales.length;

  const [loading, setLoading] = useState(false);

  const fetchTodaySales = async (dateStr) => {
    try {
      setLoading(true);
      const dateParam = dateStr || selectedDate;
      const salesUrl = dateParam ? `/sales/today?date=${dateParam}` : "/sales/today";
      const [salesRes, summaryRes] = await Promise.allSettled([
        api.get(salesUrl),
        api.get("/analytics/summary?period=daily"),
      ]);
      if (salesRes.status === "fulfilled") setSales(salesRes.value.data || []);
      if (summaryRes.status === "fulfilled") setDaySummary(summaryRes.value.data);
    } catch (err) {
      console.log("Failed to fetch today's sales", err);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch whenever the selected date changes
  useEffect(() => {
    fetchTodaySales(selectedDate);
  }, [selectedDate]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchTodaySales();
      (async () => {
        try {
          const name = await AsyncStorage.getItem("store_name");
          const state = await AsyncStorage.getItem("state");
          const country = await AsyncStorage.getItem("country");
          setShopName((name || "My Store").toUpperCase());
          const parts = [state, country].filter(Boolean);
          setShopLocation(parts.join(", ").toUpperCase());
        } catch (error) {
          console.error("Dashboard failed to load shop metadata:", error);
          setShopName("MY STORE");
        }
      })();
    }, [])
  );

  const todayDate = new Date().toLocaleDateString("en-GB");

  const navigation = useNavigation();

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Title ── */}
        <AppText font="satoshi" style={s.title}>Dashboard</AppText>

        {/* ── Receipt ── */}
        <View style={s.receipt}>
          <ZigzagEdge />

          <View style={s.receiptBody}>
            <AppText font="billbold" style={s.shopName}>{shopName}</AppText>
            <AppText font="billsemi" style={s.shopCity}>{shopLocation}</AppText>

            <DottedLine />
            <AppText font="billbold" style={s.saleBanner}>TODAY'S SALE</AppText>
            <DottedLine />

            <TouchableOpacity 
              onPress={() => setShowDatePicker(true)}
              style={s.dateRow}
            >
              <AppText font="billsemi" style={s.date}>
                DATE: {selectedDate ? new Date(selectedDate).toLocaleDateString("en-GB") : todayDate}
              </AppText>
              <AppText font="billsemi" style={[s.date, { marginLeft: 4, color: ACCENT }]}>
                {selectedDate ? "(Historical)" : "(Today) ✎"}
              </AppText>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={selectedDate ? new Date(selectedDate) : new Date()}
                mode="date"
                display="default"
                maximumDate={new Date()}
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) {
                    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
                    const formatted = offsetDate.toISOString().split("T")[0];
                    // If it's today, we might want to keep it null to represent "Live"
                    const todayOffset = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000);
                    const isToday = formatted === todayOffset.toISOString().split("T")[0];
                    setSelectedDate(isToday ? null : formatted);
                  }
                }}
              />
            )}

            {/* Table header */}
            <View style={s.row}>
              <AppText font="billbold" style={[s.cell, s.colDesc, s.thCell]}>
                DESCRIPTION
              </AppText>
              <AppText font="billbold" style={[s.cell, s.colNum, s.thCell]}>
                QTY
              </AppText>
              <AppText font="billbold" style={[s.cell, s.colNum, s.thCell]}>
                RATE
              </AppText>
              <AppText font="billbold" style={[s.cell, s.colNum, s.thCell]}>
                AMOUNT
              </AppText>
            </View>

            <DottedLine />

            {/* Sales rows - show only latest 5 */}
            {sales.length === 0 && !loading ? (
              <AppText font="billsemi" style={{ fontSize: 11, marginTop: 8, textAlign: "center", color: "#999" }}>
                No sales recorded today.
              </AppText>
            ) : (
              sales.slice(0, 6).map((item, index) => (
                <SaleRow key={index.toString()} item={item} />
              ))
            )}
          </View>

          <ZigzagEdge flip />
        </View>

        {/* View Full / Transactions row */}
        <View style={s.viewFullWrap}>
          <TouchableOpacity onPress={() => navigation.navigate("TodaySales")}>
            <AppText font="satoshi" style={s.viewFull}>
              View Full Sales {sales.length > 6 && `(${sales.length} total)`}
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("SalesHistory")} style={s.txnBtn}>
            <AppText font="satoshi" style={s.txnBtnText}>
              Transactions
            </AppText>
          </TouchableOpacity>
        </View>

        {/* ── Analytics Card ── */}
        <View style={s.analyticsCard}>
          <AppText font="satoshi" style={s.analyticsTitle}>
            TODAY'S ANALYTICS
          </AppText>

          <View style={s.analyticsRow}>
            <View style={s.analyticsBox}>
              <AppText font="billbold" style={s.analyticsValue}>
                ₹{totalRevenue.toFixed(2)}
              </AppText>
              <AppText font="regular" style={s.analyticsLabel}>
                Revenue
              </AppText>
            </View>

            <View style={s.analyticsBox}>
              <AppText font="billbold" style={s.analyticsValue}>
                {totalItems}
              </AppText>
              <AppText font="regular" style={s.analyticsLabel}>
                Items Sold
              </AppText>
            </View>

            <View style={s.analyticsBox}>
              <AppText font="billbold" style={s.analyticsValue}>
                {totalTransactions}
              </AppText>
              <AppText font="regular" style={s.analyticsLabel}>
                Transactions
              </AppText>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },

  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#000000",
    letterSpacing: -0.5,
    marginBottom: 18,
  },

  // ── Receipt card ──
  receipt: {
    backgroundColor: WHITE,
    marginBottom: 14,
    position: "relative",
    overflow: "visible",
    paddingVertical: 0,
  },

  // Zigzag / perforated edges
  zigRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "transparent",
    height: 6,
    zIndex: 10,
  },
  zigNotch: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: BG,
    // Half-circles peeking out: negative margin pulls them beyond card edge
    marginVertical: -5.5,
  },

  receiptBody: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  shopName: {
    fontSize: 21,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 3,
    color: "#111",
    marginBottom: 2,
  },
  shopCity: {
    fontSize: 11,
    textAlign: "center",
    letterSpacing: 2,
    color: "#666",
    marginBottom: 10,
  },

  saleBanner: {
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 3,
    color: "#111",
    marginVertical: 6,
  },

  dotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dot: {
    width: 4,
    height: 1.5,
    backgroundColor: "#999",
    borderRadius: 1,
  },

  dateRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 6,
  },
  date: {
    fontSize: 11,
    color: "#333",
  },

  // Table
  row: {
    flexDirection: "row",
    paddingVertical: 3,
  },
  cell: {
    fontSize: 11,
    color: "#222",
  },
  thCell: {
    fontWeight: "700",
    fontSize: 10,
    color: "#444",
  },
  colDesc: {
    flex: 2.4,
    paddingRight: 4,
  },
  colNum: {
    flex: 1,
    textAlign: "right",
  },

  viewFullWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: -8,
    marginBottom: 16,
    paddingHorizontal: 14,
  },
  viewFull: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },

  txnBtn: {
    backgroundColor: ACCENT,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  txnBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },

  // ── Analytics card ──
  analyticsCard: {
    backgroundColor: WHITE,
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  analyticsTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 16,
    letterSpacing: 1,
  },

  analyticsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },

  analyticsBox: {
    alignItems: "center",
    flex: 1,
  },

  analyticsValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111",
  },

  analyticsLabel: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
  },
});