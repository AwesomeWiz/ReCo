import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { Ionicons } from "@expo/vector-icons";
import AppText from "../components/AppText";
import api from "../api/api";

const { width: SCREEN_W } = Dimensions.get("window");

// ── Design tokens (matches Dashboard / Inventory) ────────────────────────────
const BG = "#F5F1E8";
const WHITE = "#FFFFFF";
const ACCENT = "#3A6FF7";
const DANGER = "#E53935";
const WARN = "#F59E0B";
const OK = "#16A34A";
const TEXT = "#111111";
const SUB = "#666666";
const BORDER = "#E5E7EB";

// ── Risk badge ────────────────────────────────────────────────────────────────
function RiskBadge({ level }) {
  const cfg = {
    high: { bg: "#FEE2E2", border: DANGER, text: "HIGH RISK", icon: "alert-circle" },
    medium: { bg: "#FEF3C7", border: WARN, text: "MEDIUM", icon: "warning" },
    low: { bg: "#DCFCE7", border: OK, text: "LOW", icon: "checkmark-circle" },
    none: { bg: "#EFF6FF", border: ACCENT, text: "SAFE", icon: "shield-checkmark" },
  }[level] || { bg: "#EFF6FF", border: ACCENT, text: "SAFE", icon: "shield-checkmark" };

  return (
    <View style={[s.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Ionicons name={cfg.icon} size={11} color={cfg.border} style={{ marginRight: 3 }} />
      <AppText font="bold" style={[s.badgeText, { color: cfg.border }]}>{cfg.text}</AppText>
    </View>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ icon, title }) {
  return (
    <View style={s.sectionHeader}>
      <Ionicons name={icon} size={17} color={ACCENT} style={{ marginRight: 8 }} />
      <AppText font="bold" style={s.sectionTitle}>{title}</AppText>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
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

      setSummary(sumRes.status === "fulfilled" ? sumRes.value.data : null);
      setForecast(fcastRes.status === "fulfilled" ? fcastRes.value.data : null);
      setDemand(demRes.status === "fulfilled" ? demRes.value.data : null);
      setStockout(soRes.status === "fulfilled" ? soRes.value.data : null);

      const allFailed = [sumRes, fcastRes, demRes, soRes].every(r => r.status === "rejected");
      if (allFailed) {
        const e = sumRes.reason;
        setError(e?.response?.data?.error || e?.message || "Failed to load analytics");
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

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[s.safe, s.centered]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <AppText style={[s.sub, { marginTop: 14 }]}>Running ARIMA models…</AppText>
      </SafeAreaView>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <SafeAreaView style={[s.safe, s.centered]}>
        <Ionicons name="cloud-offline-outline" size={48} color={DANGER} />
        <AppText style={[s.sub, { marginTop: 12, color: DANGER }]}>{error}</AppText>
        <TouchableOpacity style={s.retryBtn} onPress={() => { setLoading(true); fetchAll(); }}>
          <AppText font="bold" style={{ color: "#fff" }}>Retry</AppText>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Chart data ──────────────────────────────────────────────────────────────
  const chartData = forecast?.length > 0 ? {
    labels: forecast.map(d => d.date.slice(5)),
    datasets: [{ data: forecast.map(d => d.predicted_sales) }],
  } : null;

  // ── Filtered demand (hide zero-demand products) ─────────────────────────────
  const activeDemand = (demand || []).filter(p => p.total_predicted_7d > 0);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
      >
        {/* ── Title ─────────────────────────────────────────────────────────── */}
        <AppText font="satoshi" style={s.title}>Analytics</AppText>

        {/* ── Period toggle ──────────────────────────────────────────────────── */}
        <View style={s.periodBar}>
          {[["Daily", "daily"], ["Weekly", "weekly"], ["Monthly", "monthly"]].map(([lbl, val]) => (
            <TouchableOpacity
              key={val}
              onPress={() => setPeriod(val)}
              style={[s.periodBtn, period === val && s.periodBtnActive]}
            >
              <AppText
                font={period === val ? "bold" : "regular"}
                style={[s.periodBtnText, period === val && s.periodBtnTextActive]}
              >
                {lbl}
              </AppText>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Summary metrics ────────────────────────────────────────────────── */}
        {summary && (
          <>
            {/* Row 1: Revenue + Transactions */}
            <View style={s.metricsRow}>
              <View style={s.metricCard}>
                <Ionicons name="cash-outline" size={20} color={ACCENT} style={{ marginBottom: 6 }} />
                <AppText font="bold" style={s.metricValue}>
                  ₹{summary.total_sales?.toLocaleString("en-IN")}
                </AppText>
                <AppText style={s.metricLabel}>Revenue</AppText>
              </View>

              <View style={s.metricCard}>
                <Ionicons name="receipt-outline" size={20} color={ACCENT} style={{ marginBottom: 6 }} />
                <AppText font="bold" style={s.metricValue}>
                  {summary.total_transactions}
                </AppText>
                <AppText style={s.metricLabel}>Transactions</AppText>
              </View>
            </View>

            {/* Row 2: Items Sold + Avg per Sale */}
            <View style={s.metricsRow}>
              <View style={s.metricCard}>
                <Ionicons name="cube-outline" size={20} color={ACCENT} style={{ marginBottom: 6 }} />
                <AppText font="bold" style={s.metricValue}>
                  {summary.total_items ?? 0}
                </AppText>
                <AppText style={s.metricLabel}>Items Sold</AppText>
              </View>

              <View style={s.metricCard}>
                <Ionicons name="trending-up-outline" size={20} color={ACCENT} style={{ marginBottom: 6 }} />
                <AppText font="bold" style={s.metricValue}>
                  ₹{summary.total_transactions > 0
                    ? Math.round(summary.total_sales / summary.total_transactions).toLocaleString("en-IN")
                    : 0}
                </AppText>
                <AppText style={s.metricLabel}>Avg per Sale</AppText>
              </View>
            </View>

            {/* Top Product + Stock Risk */}
            <View style={s.card}>
              <View style={s.rowBetween}>
                <View style={s.iconRow}>
                  <Ionicons name="trophy-outline" size={17} color={WARN} style={{ marginRight: 8 }} />
                  <AppText style={s.sub}>Top Product</AppText>
                </View>
                <AppText font="bold" style={s.topProduct} numberOfLines={1}>
                  {summary.top_product}
                </AppText>
              </View>

              <View style={[s.rowBetween, s.dividerRow]}>
                <View style={s.iconRow}>
                  <Ionicons
                    name="cube-outline"
                    size={17}
                    color={summary.stock_risk ? DANGER : OK}
                    style={{ marginRight: 8 }}
                  />
                  <AppText style={s.sub}>Stockout Risk</AppText>
                </View>
                <View style={[s.badge, {
                  backgroundColor: summary.stock_risk ? "#FEE2E2" : "#DCFCE7",
                  borderColor: summary.stock_risk ? DANGER : OK,
                }]}>
                  <AppText font="bold" style={[s.badgeText, { color: summary.stock_risk ? DANGER : OK }]}>
                    {summary.stock_risk ? "⚠ AT RISK" : "✓ SAFE"}
                  </AppText>
                </View>
              </View>
            </View>
          </>
        )}

        {/* ── Revenue Forecast Chart ─────────────────────────────────────────── */}
        {chartData && (
          <View style={s.card}>
            <SectionHeader icon="trending-up" title="7-Day Revenue Forecast" />
            <AppText style={[s.sub, { marginBottom: 12 }]}>
              ARIMA model prediction based on historical sales
            </AppText>
            <LineChart
              data={chartData}
              width={SCREEN_W - 72}
              height={180}
              chartConfig={{
                backgroundGradientFrom: WHITE,
                backgroundGradientTo: WHITE,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(58, 111, 247, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(102, 102, 102, ${opacity})`,
                propsForDots: { r: "4", strokeWidth: "2", stroke: ACCENT },
              }}
              bezier
              style={{ borderRadius: 8, marginLeft: -10 }}
              withInnerLines={false}
              withOuterLines={false}
            />
          </View>
        )}

        {/* ── Stockout Risk List ─────────────────────────────────────────────── */}
        {stockout && stockout.length > 0 && (
          <View style={s.card}>
            <SectionHeader icon="alert-circle-outline" title="Stockout Risk Analysis" />
            {stockout.map((item, i) => (
              <View
                key={i}
                style={[
                  s.riskRow,
                  i < stockout.length - 1 && { borderBottomWidth: 1, borderBottomColor: BORDER },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <AppText font="bold" style={s.riskName}>{item.product_name}</AppText>
                  <AppText style={s.riskDetail}>
                    Stock: {item.stock} · Demand/7d: ~{item.predicted_demand_7d}
                    {item.days_until_stockout != null
                      ? `\n⏳ ~${item.days_until_stockout} days left`
                      : ""}
                  </AppText>
                </View>
                <RiskBadge level={item.risk_level} />
              </View>
            ))}
          </View>
        )}

        {stockout && stockout.length === 0 && (
          <View style={s.card}>
            <SectionHeader icon="cube-outline" title="Stockout Risk Analysis" />
            <AppText style={[s.sub, { textAlign: "center", paddingVertical: 12 }]}>
              No inventory items configured yet.{"\n"}Add products to inventory to enable risk analysis.
            </AppText>
          </View>
        )}

        {/* ── Demand Forecast per Product ────────────────────────────────────── */}
        {activeDemand.length > 0 && (
          <View style={s.card}>
            <SectionHeader icon="bar-chart-outline" title="Demand Forecast (Next 7 Days)" />
            <AppText style={[s.sub, { marginBottom: 12 }]}>
              Per-product ARIMA demand prediction
            </AppText>
            {activeDemand.map((prod, i) => (
              <View
                key={i}
                style={[
                  s.demandRow,
                  i < activeDemand.length - 1 && { borderBottomWidth: 1, borderBottomColor: BORDER },
                ]}
              >
                <View style={s.iconRow}>
                  <Ionicons name="cube-outline" size={14} color={ACCENT} style={{ marginRight: 6 }} />
                  <AppText font="bold" style={s.demandName}>{prod.product_name}</AppText>
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                  <AppText font="bold" style={s.demandQty}>{prod.total_predicted_7d}</AppText>
                  <AppText style={s.demandUnit}> units</AppText>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({});   // unused — all in `s`

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  centered: { justifyContent: "center", alignItems: "center", padding: 24 },
  content: { padding: 16, paddingBottom: 40 },

  title: { fontSize: 32, fontWeight: "800", color: TEXT, letterSpacing: -0.5, marginBottom: 18 },

  // Period toggle
  periodBar: {
    flexDirection: "row",
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  periodBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  periodBtnActive: { backgroundColor: ACCENT },
  periodBtnText: { fontSize: 13, color: SUB },
  periodBtnTextActive: { color: "#fff" },

  // Metric cards
  metricsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  metricCard: {
    flex: 1,
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  metricValue: { fontSize: 20, color: TEXT, marginBottom: 2 },
  metricLabel: { fontSize: 11, color: SUB },

  // Generic card
  card: {
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconRow: { flexDirection: "row", alignItems: "center" },
  dividerRow: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: BORDER },

  sub: { fontSize: 12, color: SUB },
  topProduct: { fontSize: 14, color: TEXT, maxWidth: "55%", textAlign: "right" },

  // Section header
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 15, color: TEXT },

  // Badge
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontSize: 10 },

  // Risk rows
  riskRow: { paddingVertical: 12, flexDirection: "row", alignItems: "center" },
  riskName: { fontSize: 14, color: TEXT, marginBottom: 3 },
  riskDetail: { fontSize: 11, color: SUB, lineHeight: 16 },

  // Demand rows
  demandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  demandName: { fontSize: 13, color: TEXT },
  demandQty: { fontSize: 16, color: ACCENT },
  demandUnit: { fontSize: 11, color: SUB },

  // Retry
  retryBtn: { marginTop: 16, backgroundColor: ACCENT, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 25 },
});
