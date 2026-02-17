import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import SplashScreen from "../screens/SplashScreen";
import SignUpScreen from "../screens/SignUpScreen";
import LoginScreen from "../screens/LoginScreen";
import ScanScreen from "../screens/ScanScreen";
import ConfirmProductScreen from "../screens/ConfirmProductScreen";
import SalesHistoryScreen from '../screens/SalesHistory';
import TransactionDetailsScreen from "../screens/TransactionDetailsScreen";
import BottomTabs from "./BottomTabs";


const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />

        {/* Bottom Tabs */}
        <Stack.Screen name="Main" component={BottomTabs} />

        {/* Full Screen Flow Screens (NO bottom tabs) */}
        <Stack.Screen name="Scan" component={ScanScreen} />
        <Stack.Screen name="ConfirmProduct" component={ConfirmProductScreen} />
        <Stack.Screen name="SalesHistory" component={SalesHistoryScreen} />
        <Stack.Screen name="TransactionDetails" component={TransactionDetailsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

