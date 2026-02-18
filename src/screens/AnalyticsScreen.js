import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, ScrollView } from "react-native";
import AppText from "../components/AppText";
import api from "../api/api";

export default function AnalyticsScreen() {
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchForecast = async () => {
    try {
      const res = await api.get("/analytics/forecast");
      console.log("Forecast data:", res.data);
      setForecast(res.data);
    } catch (err) {
      console.log(
        "Forecast error:",
        err.response?.data || err.message
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <AppText font="bold" style={{ fontSize: 22 }}>
        Sales Forecast (ARIMA)
      </AppText>

      {forecast.length === 0 ? (
        <AppText style={{ marginTop: 20 }}>
          No forecast data available.
        </AppText>
      ) : (
        forecast.map((item, index) => (
          <View
            key={index}
            style={{
              marginTop: 15,
              padding: 15,
              backgroundColor: "#F3F4F6",
              borderRadius: 12,
            }}
          >
            <AppText>Date: {item.date}</AppText>
            <AppText>
              Predicted Sales: ₹{item.predicted_sales}
            </AppText>
          </View>
        ))
      )}
    </ScrollView>
  );
}
