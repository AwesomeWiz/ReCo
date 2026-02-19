import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { LineChart, PieChart } from "react-native-chart-kit";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AppText from "../components/AppText";
import api from "../api/api";

const { width: SCREEN_W } = Dimensions.get("window");

// ── Colors ──────────────────────────────────────────────────────────
const C = {
  bg: "#0F1523",
  card: "#1A2236",
  cardBord: "#263050",
  accent: "#4A80F5",
  accent2: "#7B5EA7",
  textMain: "#E8EDF5",
  textSub: "#7A8AAE",
  high: "#FF4757",
  medium: "#FFA502",
  low: "#2ED573",
  none: "#4A80F5",
  cat: ["#4A80F5", "#FF6B9D", "#FFD166", "#06D6A0", "#9B5DE5"],
};

// ── Reusable Card ────────────────────────────────────────────────────
function Card({ children, style }) {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

// ── Section header ───────────────────────────────────────────────────
function SectionHeader({ icon, title }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={18} color={C.accent} style={{ marginRight: 8 }} />
      <AppText font="bold" style={styles.sectionTitle}>{title}</AppText>
    </View>
  );
}

// ── Risk badge ───────────────────────────────────────────────────────
function RiskBadge({ level }) {
  const cfg = {
    high: { bg: "#FF47571A", border: C.high, text: "HIGH RISK", icon: "alert-circle" },
    medium: { bg: "#FFA5021A", border: C.medium, text: "MEDIUM", icon: "warning" },
    low: { bg: "#2ED5731A", border: C.low, text: "LOW", icon: "checkmark-circle" },
    none: { bg: "#4A80F51A", border: C.none, text: "SAFE", icon: "shield-checkmark" },
  }[level] || { bg: "#4A80F51A", border: C.none, text: "SAFE", icon: "shield-checkmark" };

  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Ionicons name={cfg.icon} size={11} color={cfg.border} style={{ marginRight: 3 }} />
      <AppText font="bold" style={[styles.badgeText, { color: cfg.border }]}>{cfg.text}</AppText>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────
export default function AnalyticsScreen() {
  const [period, setPeriod] = useState("daily");
  const [summary, setSummary] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [demand, setDemand] = useState(null);
  const [stockout, setStockout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async (sel = period) => {
    try {
      setError(null);
      const [sumRes, fcastRes, demRes, soRes] = await Promise.allSettled([
        api.get(`/analytics/summary?period=${sel}`),
        api.get("/analytics/forecast"),
        api.get("/analytics/demand"),
        api.get("/analytics/stockout-risk"),
      ]);

      // Each result is independent — set data if fulfilled, null if rejected
      setSummary(sumRes.status === "fulfilled" ? sumRes.value.data : null);
      setForecast(fcastRes.status === "fulfilled" ? fcastRes.value.data : null);
      setDemand(demRes.status === "fulfilled" ? demRes.value.data : null);
      setStockout(soRes.status === "fulfilled" ? soRes.value.data : null);

      // Only show error if ALL endpoints failed
      const allFailed = [sumRes, fcastRes, demRes, soRes].every(
        (r) => r.status === "rejected"
      );
      if (allFailed) {
        const firstErr = sumRes.reason;
        setError(firstErr?.response?.data?.error || firstErr?.message || "Failed to load analytics");
      }
    } catch (e) {
      setError(e.message || "Failed to load analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { setLoading(true); fetchAll(period); }, [period]);

  const onRefresh = () => { setRefreshing(true); fetchAll(period); };

  // ── Period bar ──────────────────────────────────────────────────────
  const PeriodBar = () => (
    <View style={styles.periodBar}>
      {[["Daily", "daily"], ["Weekly", "weekly"], ["Monthly", "monthly"]].map(([lbl, val]) => (
        <TouchableOpacity
          key={val}
          onPress={() => setPeriod(val)}
          style={[styles.periodBtn, period === val && styles.periodBtnActive]}
        >
          <AppText
            font={period === val ? "bold" : "regular"}
            style={[styles.periodBtnText, period === val && styles.periodBtnTextActive]}
          >
            {lbl}
          </AppText>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ── Loading ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.accent} />
        <AppText style={[styles.subText, { marginTop: 16 }]}>Running ARIMA models…</AppText>
      </View>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="cloud-offline" size={48} color={C.high} />
        <AppText style={[styles.subText, { marginTop: 12, color: C.high }]}>{error}</AppText>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchAll(); }}>
          <AppText font="bold" style={{ color: "#fff" }}>Retry</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Revenue forecast chart data ──────────────────────────────────────
  const chartData = forecast?.length > 0
    ? {
      labels: forecast.map((d) => d.date.slice(5)),          // "MM-DD"
      datasets: [{ data: forecast.map((d) => d.predicted_sales) }],
    }
    : null;

  // ── Pie data ─────────────────────────────────────────────────────────
  const pieData = summary?.categories?.map((item, i) => ({
    name: item.category || "Other",
    population: parseFloat(item.percentage) || 0,
    color: C.cat[i % C.cat.length],
    legendFontColor: C.textSub,
    legendFontSize: 11,
  })) || [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <LinearGradient
        colors={["#1A2A5E", "#0F1523"]}
        style={styles.header}
      >
        <AppText font="bold" style={styles.headerTitle}>Analytics</AppText>
        <AppText style={styles.headerSub}>AI-powered insights for your store</AppText>
      </LinearGradient>

      <View style={styles.content}>
        {/* ── Period toggle ─────────────────────────────────────────── */}
        <PeriodBar />

        {/* ── Summary cards ─────────────────────────────────────────── */}
        {summary && (
          <>
            <View style={styles.metricsRow}>
              <LinearGradient colors={["#1E3A8A", "#2254C5"]} style={styles.metricCard}>
                <Ionicons name="cash" size={22} color="#fff" style={{ marginBottom: 6 }} />
                <AppText font="bold" style={styles.metricValue}>
                  ₹{summary.total_sales?.toLocaleString("en-IN")}
                </AppText>
                <AppText style={styles.metricLabel}>Total Revenue</AppText>
              </LinearGradient>

              <LinearGradient colors={["#4B1D96", "#7B5EA7"]} style={styles.metricCard}>
                <Ionicons name="receipt" size={22} color="#fff" style={{ marginBottom: 6 }} />
                <AppText font="bold" style={styles.metricValue}>
                  {summary.total_transactions}
                </AppText>
                <AppText style={styles.metricLabel}>Transactions</AppText>
              </LinearGradient>
            </View>

            <Card style={{ marginBottom: 14 }}>
              <View style={styles.rowBetween}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="trophy" size={18} color={C.medium} style={{ marginRight: 8 }} />
                  <AppText style={styles.subText}>Top Product</AppText>
                </View>
                <AppText font="bold" style={styles.topProduct}>{summary.top_product}</AppText>
              </View>
              <View style={[styles.rowBetween, { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.cardBord }]}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="cube" size={18} color={summary.stock_risk ? C.high : C.low} style={{ marginRight: 8 }} />
                  <AppText style={styles.subText}>Stockout Risk</AppText>
                </View>
                <View style={[styles.badge, {
                  backgroundColor: summary.stock_risk ? "#FF47571A" : "#2ED5731A",
                  borderColor: summary.stock_risk ? C.high : C.low,
                }]}>
                  <AppText font="bold" style={[styles.badgeText, { color: summary.stock_risk ? C.high : C.low }]}>
                    {summary.stock_risk ? "⚠ AT RISK" : "✓ SAFE"}
                  </AppText>
                </View>
              </View>
            </Card>
          </>
        )}

        {/* ── Revenue Forecast (ARIMA) ──────────────────────────────── */}
        {chartData && (
          <Card style={{ marginBottom: 14 }}>
            <SectionHeader icon="trending-up" title="7-Day Revenue Forecast" />
            <AppText style={[styles.subText, { marginBottom: 12 }]}>
              ARIMA model prediction based on historical sales
            </AppText>
            <LineChart
              data={chartData}
              width={SCREEN_W - 72}
              height={180}
              chartConfig={{
                backgroundGradientFrom: C.card,
                backgroundGradientTo: C.card,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(74, 128, 245, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(122, 138, 174, ${opacity})`,
                propsForDots: { r: "4", strokeWidth: "2", stroke: C.accent },
              }}
              bezier
              style={{ borderRadius: 8, marginLeft: -10 }}
              withInnerLines={false}
              withOuterLines={false}
            />
          </Card>
        )}

        {/* ── Stockout Risk List ────────────────────────────────────── */}
        {stockout && stockout.length > 0 && (
          <Card style={{ marginBottom: 14 }}>
            <SectionHeader icon="alert-circle" title="Stockout Risk Analysis" />
            {stockout.map((item, i) => (
              <View
                key={i}
                style={[
                  styles.riskRow,
                  i < stockout.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.cardBord },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <AppText font="bold" style={styles.riskName}>{item.product_name}</AppText>
                  <AppText style={styles.riskDetail}>
                    Stock: {item.stock} · Demand/7d: ~{item.predicted_demand_7d}
                    {item.days_until_stockout != null
                      ? `\n⏳ ~${item.days_until_stockout} days left`
                      : ""}
                  </AppText>
                </View>
                <RiskBadge level={item.risk_level} />
              </View>
            ))}
          </Card>
        )}

        {stockout && stockout.length === 0 && (
          <Card style={{ marginBottom: 14 }}>
            <SectionHeader icon="cube" title="Stockout Risk Analysis" />
            <AppText style={[styles.subText, { textAlign: "center", paddingVertical: 12 }]}>
              No inventory items configured yet.{"\n"}Add products to inventory to enable risk analysis.
            </AppText>
          </Card>
        )}

        {/* ── Demand Forecast per product ───────────────────────────── */}
        {demand && demand.length > 0 && (
          <Card style={{ marginBottom: 14 }}>
            <SectionHeader icon="bar-chart" title="Demand Forecast (Next 7 Days)" />
            <AppText style={[styles.subText, { marginBottom: 12 }]}>
              Per-product ARIMA demand prediction
            </AppText>
            {demand.map((prod, i) => (
              <View
                key={i}
                style={[
                  styles.demandRow,
                  i < demand.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.cardBord },
                ]}
              >
                <View style={styles.demandLeft}>
                  <Ionicons name="cube-outline" size={14} color={C.accent} style={{ marginRight: 6 }} />
                  <AppText font="bold" style={styles.demandName}>{prod.product_name}</AppText>
                </View>
                <View style={styles.demandRight}>
                  <AppText font="bold" style={styles.demandQty}>{prod.total_predicted_7d}</AppText>
                  <AppText style={styles.demandUnit}> units</AppText>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* ── Category Pie ─────────────────────────────────────────── */}
        {pieData.length > 0 && (
          <Card>
            <SectionHeader icon="pie-chart" title="Sales by Category" />
            <PieChart
              data={pieData}
              width={SCREEN_W - 72}
              height={180}
              chartConfig={{
                color: (opacity = 1) => `rgba(255,255,255,${opacity})`,
              }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="10"
              absolute={false}
              style={{ marginLeft: -16 }}
            />
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  centered: { flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center", padding: 24 },
  header: { paddingTop: 56, paddingBottom: 28, paddingHorizontal: 24 },
  headerTitle: { fontSize: 28, color: C.textMain, marginBottom: 4 },
  headerSub: { fontSize: 13, color: C.textSub },
  content: { padding: 16 },

  periodBar: { flexDirection: "row", backgroundColor: C.card, borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: C.cardBord },
  periodBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  periodBtnActive: { backgroundColor: C.accent },
  periodBtnText: { fontSize: 13, color: C.textSub },
  periodBtnTextActive: { color: "#fff" },

  metricsRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
  metricCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: "center" },
  metricValue: { fontSize: 22, color: "#fff", marginBottom: 2 },
  metricLabel: { fontSize: 11, color: "rgba(255,255,255,0.7)" },

  card: { backgroundColor: C.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.cardBord },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  subText: { fontSize: 12, color: C.textSub },
  topProduct: { fontSize: 15, color: C.textMain },

  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 15, color: C.textMain },

  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontSize: 10 },

  riskRow: { paddingVertical: 12, flexDirection: "row", alignItems: "center" },
  riskName: { fontSize: 14, color: C.textMain, marginBottom: 3 },
  riskDetail: { fontSize: 11, color: C.textSub, lineHeight: 16 },

  demandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  demandLeft: { flexDirection: "row", alignItems: "center" },
  demandName: { fontSize: 13, color: C.textMain },
  demandRight: { flexDirection: "row", alignItems: "baseline" },
  demandQty: { fontSize: 16, color: C.accent },
  demandUnit: { fontSize: 11, color: C.textSub },

  retryBtn: { marginTop: 16, backgroundColor: C.accent, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
});
