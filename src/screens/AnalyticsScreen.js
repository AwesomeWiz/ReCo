import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppText from "../components/AppText";
import api from "../api/api";

const BG = "#F5F1E8";
const WHITE = "#FFFFFF";
const ACCENT = "#3A6FF7";
const DANGER = "#DC2626";
const WARN = "#D97706";
const OK = "#16A34A";
const TEXT = "#111111";
const MUTED = "#888888";
const BORDER = "#EBEBEB";

// ─── Category colour palette ───────────────────────────────────────────────────
const CAT_COLORS = ["#3A6FF7", "#16A34A", "#D97706", "#9333EA", "#DC2626", "#0891B2", "#059669", "#C026D3"];

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
              ₹{Math.round(Number(summary.total_sales)).toLocaleString("en-IN")}
            </AppText>

            {/* ── 3 sub-stats ── */}
            <View style={s.subStatsRow}>
              <View style={s.subStat}>
                <AppText font="bold" style={s.subStatValue}>{summary.total_transactions}</AppText>
                <AppText style={s.subStatLabel}>Sales</AppText>
              </View>
              <View style={s.subStatDivider} />
              <View style={s.subStat}>
                <AppText font="bold" style={s.subStatValue}>{Math.round(summary.total_items ?? 0)}</AppText>
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

        {/* ── Top Selling Products ────────────────────────────────────────────── */}
        {activeDemand.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <AppText font="bold" style={s.sectionTitle}>Top Selling Products</AppText>
              <AppText style={s.sectionSub}>By predicted 7-day demand</AppText>
            </View>
            {(() => {
              const maxDemand = Math.max(...activeDemand.map(p => p.total_predicted_7d), 1);
              return activeDemand
                .sort((a, b) => b.total_predicted_7d - a.total_predicted_7d)
                .slice(0, 6)
                .map((prod, i) => {
                  const pct = Math.round((prod.total_predicted_7d / maxDemand) * 100);
                  return (
                    <View key={i} style={s.topProductRow}>
                      <View style={s.topProductRank}>
                        <AppText font="bold" style={s.topProductRankText}>#{i + 1}</AppText>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={s.topProductNameRow}>
                          <AppText font="semibold" style={s.topProductName} numberOfLines={1}>
                            {prod.product_name}
                          </AppText>
                          <AppText font="bold" style={s.topProductUnits}>
                            {Math.round(prod.total_predicted_7d)} units
                          </AppText>
                        </View>
                        <View style={s.topProductBarBg}>
                          <View style={[s.topProductBar, { width: `${pct}%` }]} />
                        </View>
                      </View>
                    </View>
                  );
                });
            })()}
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
                      Stock {Math.round(item.stock)} · ~{Math.round(item.predicted_demand_7d)} needed
                      {item.days_until_stockout != null ? ` · ${Math.round(item.days_until_stockout)}d left` : ""}
                    </AppText>
                  </View>
                  <AppText style={[s.riskLabel, { color: cfg.color }]}>{cfg.label}</AppText>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Sales by Category ───────────────────────────────────────────── */}
        {summary && (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <AppText font="bold" style={s.sectionTitle}>Sales by Category</AppText>
              <AppText style={s.sectionSub}>Revenue share</AppText>
            </View>
            {summary.categories?.length > 0 ? (
              summary.categories.map((cat, i) => {
                const color = CAT_COLORS[i % CAT_COLORS.length];
                const pct = Math.round(Number(cat.percentage) || 0);
                return (
                  <View key={i} style={s.catRow}>
                    <View style={s.catLabelRow}>
                      <View style={[s.catDot, { backgroundColor: color }]} />
                      <AppText style={s.catName} numberOfLines={1}>
                        {cat.category || "Uncategorised"}
                      </AppText>
                      <AppText font="bold" style={[s.catPct, { color }]}>{pct}%</AppText>
                    </View>
                    <View style={s.catBarBg}>
                      <View style={[s.catBar, { width: `${pct}%`, backgroundColor: color }]} />
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={s.emptyState}>
                <Ionicons name="pie-chart-outline" size={32} color={MUTED} />
                <AppText style={s.emptyStateText}>No sales in this period</AppText>
                <AppText style={s.emptyStateHint}>Try switching to Weekly or Monthly</AppText>
              </View>
            )}
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

  // ── Category rows ──
  catRow: {
    marginBottom: 14,
  },
  catLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  catName: { fontSize: 13, color: TEXT, flex: 1 },
  catPct: { fontSize: 13 },
  catBarBg: {
    height: 6,
    backgroundColor: "#F0F0F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  catBar: {
    height: 6,
    borderRadius: 3,
  },

  // ── Loading / error ──
  loadText: { fontSize: 13, color: MUTED, marginTop: 10 },
  errorText: { fontSize: 13, color: MUTED, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { marginTop: 4, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: TEXT, borderRadius: 20 },
  retryText: { color: WHITE, fontSize: 13, fontWeight: "600" },

  // ── Empty state ──
  emptyState: { alignItems: "center", paddingVertical: 20, gap: 6 },
  emptyStateText: { fontSize: 13, color: MUTED, textAlign: "center", marginTop: 8 },
  emptyStateHint: { fontSize: 11, color: MUTED, textAlign: "center" },

  // ── Top Selling Products ──
  topProductRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F2",
  },
  topProductRank: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  topProductRankText: { fontSize: 11, color: ACCENT },
  topProductNameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  topProductName: { fontSize: 13, color: TEXT, flex: 1, marginRight: 8 },
  topProductUnits: { fontSize: 13, color: ACCENT },
  topProductBarBg: {
    height: 5,
    backgroundColor: "#E8EEFF",
    borderRadius: 3,
    overflow: "hidden",
  },
  topProductBar: {
    height: 5,
    backgroundColor: ACCENT,
    borderRadius: 3,
  },
});


