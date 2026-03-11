import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  SafeAreaView,
  SafeAreaView,
  RefreshControl,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { Ionicons } from "@expo/vector-icons";
import AppText from "../components/AppText";
import api from "../api/api";

const { width: SCREEN_W } = Dimensions.get("window");

const BG = "#F5F1E8";
const WHITE = "#FFFFFF";
const ACCENT = "#3A6FF7";
const DANGER = "#DC2626";
const WARN = "#D97706";
const OK = "#16A34A";
const TEXT = "#111111";
const MUTED = "#888888";
const BORDER = "#EBEBEB";

// ─── Risk level config ────────────────────────────────────────────────────────
const RISK_CFG = {
  high: { color: DANGER, label: "High Risk", dot: "#DC2626" },
  medium: { color: WARN, label: "Medium", dot: "#D97706" },
  low: { color: OK, label: "Low", dot: "#16A34A" },
  none: { color: ACCENT, label: "Safe", dot: "#3A6FF7" },
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
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

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={ACCENT} />
          <AppText style={s.loadText}>Calculating forecasts…</AppText>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={MUTED} />
          <AppText style={s.errorText}>{error}</AppText>
          <TouchableOpacity style={s.retryBtn} onPress={() => { setLoading(true); fetchAll(); }}>
            <AppText style={s.retryText}>Try again</AppText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const chartData = forecast?.length > 0 ? {
    labels: forecast.map(d => d.date.slice(5)),
    datasets: [{ data: forecast.map(d => Math.max(0, d.predicted_sales)) }],
  } : null;

  const activeDemand = (demand || []).filter(p => p.total_predicted_7d > 0);
  const avgPerSale = summary?.total_transactions > 0
    ? Math.round(summary.total_sales / summary.total_transactions)
    : 0;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
      >

        {/* ── Page title ─────────────────────────────────────────────────────── */}
        <AppText font="satoshi" style={s.pageTitle}>Analytics</AppText>

        {/* ── Period selector ────────────────────────────────────────────────── */}
        <View style={s.periodRow}>
          {[["Daily", "daily"], ["Weekly", "weekly"], ["Monthly", "monthly"]].map(([lbl, val]) => (
            <TouchableOpacity
              key={val}
              onPress={() => setPeriod(val)}
              style={[s.periodChip, period === val && s.periodChipActive]}
            >
              <AppText style={[s.periodLabel, period === val && s.periodLabelActive]}>
                {lbl}
              </AppText>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Hero revenue ───────────────────────────────────────────────────── */}
        {summary && (
          <View style={s.heroCard}>
            <AppText style={s.heroLabel}>Total Revenue</AppText>
            <AppText font="bold" style={s.heroValue}>
              ₹{Number(summary.total_sales).toLocaleString("en-IN")}
            </AppText>

            {/* ── 3 sub-stats ── */}
            <View style={s.subStatsRow}>
              <View style={s.subStat}>
                <AppText font="bold" style={s.subStatValue}>{summary.total_transactions}</AppText>
                <AppText style={s.subStatLabel}>Sales</AppText>
              </View>
              <View style={s.subStatDivider} />
              <View style={s.subStat}>
                <AppText font="bold" style={s.subStatValue}>{summary.total_items ?? 0}</AppText>
                <AppText style={s.subStatLabel}>Items sold</AppText>
              </View>
              <View style={s.subStatDivider} />
              <View style={s.subStat}>
                <AppText font="bold" style={s.subStatValue}>₹{avgPerSale.toLocaleString("en-IN")}</AppText>
                <AppText style={s.subStatLabel}>Avg / sale</AppText>
              </View>
            </View>

            {/* ── Top product + risk ── */}
            <View style={s.heroFooter}>
              <View style={s.heroFooterItem}>
                <AppText style={s.heroFooterLabel}>Top product</AppText>
                <AppText font="bold" style={s.heroFooterValue} numberOfLines={1}>
                  {summary.top_product ?? "N/A"}
                </AppText>
              </View>
              <View style={[s.riskPill, { backgroundColor: summary.stock_risk ? "#FEE2E2" : "#DCFCE7" }]}>
                <View style={[s.riskDot, { backgroundColor: summary.stock_risk ? DANGER : OK }]} />
                <AppText style={[s.riskPillText, { color: summary.stock_risk ? DANGER : OK }]}>
                  {summary.stock_risk ? "At risk" : "Stock OK"}
                </AppText>
              </View>
            </View>
          </View>
        )}

        {/* ── Revenue forecast ───────────────────────────────────────────────── */}
        {chartData && (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <AppText font="bold" style={s.sectionTitle}>Revenue Forecast</AppText>
              <AppText style={s.sectionSub}>Next 7 days · ARIMA</AppText>
            </View>
            <LineChart
              data={chartData}
              width={SCREEN_W - 48}
              height={160}
              chartConfig={{
                backgroundGradientFrom: WHITE,
                backgroundGradientTo: WHITE,
                decimalPlaces: 0,
                color: (o = 1) => `rgba(58,111,247,${o})`,
                labelColor: (o = 1) => `rgba(136,136,136,${o})`,
                propsForDots: { r: "3", strokeWidth: "2", stroke: ACCENT },
                propsForBackgroundLines: { stroke: BORDER },
              }}
              bezier
              style={{ borderRadius: 12, marginLeft: -10 }}
              withInnerLines={true}
              withOuterLines={false}
              withShadow={false}
            />
          </View>
        )}

        {/* ── Stockout risk ──────────────────────────────────────────────────── */}
        {stockout && stockout.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <AppText font="bold" style={s.sectionTitle}>Inventory Risk</AppText>
              <AppText style={s.sectionSub}>Based on 7-day demand</AppText>
            </View>
            {stockout.map((item, i) => {
              const cfg = RISK_CFG[item.risk_level] || RISK_CFG.none;
              return (
                <View
                  key={i}
                  style={[
                    s.riskRow,
                    { borderLeftColor: cfg.dot },
                    i < stockout.length - 1 && { marginBottom: 8 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <AppText font="bold" style={s.riskName} numberOfLines={1}>{item.product_name}</AppText>
                    <AppText style={s.riskMeta}>
                      Stock {item.stock} · ~{item.predicted_demand_7d} needed
                      {item.days_until_stockout != null ? ` · ${item.days_until_stockout}d left` : ""}
                    </AppText>
                  </View>
                  <AppText style={[s.riskLabel, { color: cfg.color }]}>{cfg.label}</AppText>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Demand forecast ────────────────────────────────────────────────── */}
        {activeDemand.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <AppText font="bold" style={s.sectionTitle}>Demand Forecast</AppText>
              <AppText style={s.sectionSub}>Next 7 days per product</AppText>
            </View>
            {activeDemand.map((prod, i) => (
              <View
                key={i}
                style={[
                  s.demandRow,
                  i < activeDemand.length - 1 && { borderBottomWidth: 1, borderBottomColor: BORDER },
                ]}
              >
                <AppText style={s.demandName} numberOfLines={1}>{prod.product_name}</AppText>
                <View style={s.demandChip}>
                  <AppText font="bold" style={s.demandChipText}>
                    {prod.total_predicted_7d} units
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },

  pageTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: TEXT,
    letterSpacing: -0.5,
    marginBottom: 16,
  },

  // ── Period selector ──
  periodRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  periodChip: {
    paddingVertical: 7,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  periodChipActive: {
    backgroundColor: TEXT,
    borderColor: TEXT,
  },
  periodLabel: { fontSize: 13, color: MUTED },
  periodLabelActive: { color: WHITE },

  // ── Hero card ──
  heroCard: {
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 22,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  heroLabel: { fontSize: 12, color: MUTED, marginBottom: 4, letterSpacing: 0.3 },
  heroValue: { fontSize: 36, color: TEXT, letterSpacing: -1, marginBottom: 20 },

  subStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 18,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    marginBottom: 18,
  },
  subStat: { flex: 1, alignItems: "center" },
  subStatValue: { fontSize: 18, color: TEXT, marginBottom: 2 },
  subStatLabel: { fontSize: 11, color: MUTED },
  subStatDivider: { width: 1, height: 28, backgroundColor: BORDER },

  heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroFooterItem: {},
  heroFooterLabel: { fontSize: 11, color: MUTED, marginBottom: 2 },
  heroFooterValue: { fontSize: 13, color: TEXT, maxWidth: 180 },

  riskPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  riskDot: { width: 6, height: 6, borderRadius: 3 },
  riskPillText: { fontSize: 12, fontWeight: "600" },

  // ── Sections ──
  section: {
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 15, color: TEXT },
  sectionSub: { fontSize: 11, color: MUTED },

  // ── Risk rows ──
  riskRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderRadius: 4,
    backgroundColor: "#FAFAFA",
    marginBottom: 8,
  },
  riskName: { fontSize: 13, color: TEXT, marginBottom: 2 },
  riskMeta: { fontSize: 11, color: MUTED },
  riskLabel: { fontSize: 12, fontWeight: "700", marginLeft: 8 },

  // ── Demand rows ──
  demandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
  },
  demandName: { fontSize: 13, color: TEXT, flex: 1, marginRight: 10 },
  demandChip: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  demandChipText: { fontSize: 12, color: ACCENT },

  // ── Loading / error ──
  loadText: { fontSize: 13, color: MUTED, marginTop: 10 },
  errorText: { fontSize: 13, color: MUTED, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { marginTop: 4, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: TEXT, borderRadius: 20 },
  retryText: { color: WHITE, fontSize: 13, fontWeight: "600" },
});
