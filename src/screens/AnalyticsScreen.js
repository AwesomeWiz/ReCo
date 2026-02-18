import React, { useEffect, useState } from "react";
import {
  View,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { PieChart } from "react-native-chart-kit";
import AppText from "../components/AppText";
import api from "../api/api";

const screenWidth = Dimensions.get("window").width;

export default function AnalyticsScreen() {
  const [period, setPeriod] = useState("daily");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async (selectedPeriod = period) => {
    try {
      setLoading(true);
      const res = await api.get(
        `/analytics/summary?period=${selectedPeriod}`
      );
      setData(res.data);
    } catch (err) {
      console.log("Analytics error:", err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const toggleButton = (label, value) => (
    <TouchableOpacity
      onPress={() => setPeriod(value)}
      style={{
        paddingVertical: 6,
        paddingHorizontal: 18,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#2254C5",
        backgroundColor: period === value ? "#2254C5" : "#fff",
        marginRight: 10,
      }}
    >
      <AppText
        style={{
          color: period === value ? "#fff" : "#2254C5",
          fontWeight: "600",
        }}
      >
        {label}
      </AppText>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AppText>No analytics available</AppText>
      </View>
    );
  }

  const pieData =
    data.categories?.map((item, index) => ({
      name: item.category,
      population: item.percentage,
      color: ["#FF6B6B", "#FFD166", "#06D6A0", "#118AB2", "#9B5DE5"][index % 5],
      legendFontColor: "#333",
      legendFontSize: 12,
    })) || [];

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <AppText font="bold" style={{ fontSize: 26, marginBottom: 15 }}>
        Analytics
      </AppText>

      {/* Toggle Buttons */}
      <View style={{ flexDirection: "row", marginBottom: 20 }}>
        {toggleButton("Daily", "daily")}
        {toggleButton("Weekly", "weekly")}
        {toggleButton("Monthly", "monthly")}
      </View>

      {/* Summary Card */}
      <View
        style={{
          backgroundColor: "#F3F4F6",
          padding: 18,
          borderRadius: 16,
          marginBottom: 25,
        }}
      >
        <AppText style={{ marginBottom: 6 }}>
          Total Sales: <AppText font="bold">Rs. {data.total_sales}</AppText>
        </AppText>

        <AppText style={{ marginBottom: 6 }}>
          Total Transactions:{" "}
          <AppText font="bold">{data.total_transactions}</AppText>
        </AppText>

        <AppText style={{ marginBottom: 6 }}>
          Top Selling Product:{" "}
          <AppText font="bold">{data.top_product}</AppText>
        </AppText>

        <AppText
          style={{
            marginTop: 6,
            color: data.stock_risk ? "#FF4D4D" : "#2ECC71",
            fontWeight: "600",
          }}
        >
          {data.stock_risk
            ? "⚠ Risk of stockout"
            : "✅ No risk of stockout"}
        </AppText>
      </View>

      {/* Pie Chart */}
      {pieData.length > 0 && (
        <View
          style={{
            backgroundColor: "#F3F4F6",
            padding: 20,
            borderRadius: 16,
            alignItems: "center",
          }}
        >
          <PieChart
            data={pieData}
            width={screenWidth - 60}
            height={220}
            chartConfig={{
              backgroundColor: "#fff",
              backgroundGradientFrom: "#fff",
              backgroundGradientTo: "#fff",
              color: (opacity = 1) => `rgba(34, 84, 197, ${opacity})`,
            }}
            accessor={"population"}
            backgroundColor={"transparent"}
            paddingLeft={"10"}
            absolute
          />
        </View>
      )}
    </ScrollView>
  );
}
