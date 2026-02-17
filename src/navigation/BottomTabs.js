import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import DashboardScreen from "../screens/DashboardScreen";
import InventoryScreen from "../screens/InventoryScreen";
import AnalyticsScreen from "../screens/AnalyticsScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator();

function ScanButton() {
  const navigation = useNavigation();

  return (
    <TouchableOpacity
      style={styles.scanButton}
      onPress={() => navigation.navigate("Scan")}
    >
      <Ionicons name="scan-outline" size={28} color="#fff" />
    </TouchableOpacity>
  );
}

export default function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: true,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube" size={size} color={color} />
          ),
        }}
      />

      {/* CENTER CTA BUTTON */}
      <Tab.Screen
        name="ScanButton"
        component={View}
        options={{
          tabBarButton: () => <ScanButton />,
        }}
      />

      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart" size={size} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 70,
    paddingBottom: 8,
  },

scanButton: {
  position: "absolute",
  top: -25,          // 👈 raises above tab bar
  alignSelf: "center",
  width: 70,
  height: 70,
  borderRadius: 35,
  backgroundColor: "#2F6BFF",
  justifyContent: "center",
  alignItems: "center",

  shadowColor: "#000",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.3,
  shadowRadius: 6,
  elevation: 10,
},

});
