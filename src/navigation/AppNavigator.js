import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import SplashScreen from "../screens/SplashScreen";
import SignUpScreen from "../screens/SignUpScreen";
import LoginScreen from "../screens/LoginScreen";
import DashboardScreen from "../screens/DashboardScreen";
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
        <Stack.Screen name="Main" component={BottomTabs} />
        <Stack.Screen
          name="ConfirmProduct"
          component={ConfirmProductScreen}
        />
        <Stack.Screen name="SalesHistory" component={SalesHistoryScreen} />
        <Stack.Screen
          name="TransactionDetails"
          component={TransactionDetailsScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
