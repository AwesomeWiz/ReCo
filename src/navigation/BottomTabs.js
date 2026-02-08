import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import DashboardScreen from "../screens/DashboardScreen";
import ScanScreen from "../screens/ScanScreen";
import AnalyticsScreen from "../screens/AnalyticsScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator();

export default function BottomTabs(){
  return(
    <Tab.Navigator screenOptions={{ headerShown:false }}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Scan" component={ScanScreen} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
