import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import AppText from "../components/AppText";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function SplashScreen({ navigation }) {

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const token = await AsyncStorage.getItem("mfr_token");
        // Brief delay for splash branding
        setTimeout(() => {
          if (token) {
            navigation.replace("Main");
          } else {
            navigation.replace("SignUp");
          }
        }, 1500);
      } catch (error) {
        console.error("Splash Screen checkLogin error:", error);
        // Fallback to SignUp if something goes wrong
        navigation.replace("SignUp");
      }
    };
    checkLogin();
  }, []);

  return (
    <View style={styles.container}>
      <AppText font="satoshi" style={{fontSize:32}}>ReCo</AppText>
      <Text>Retail Made Smart</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  logo: { fontSize: 32, fontWeight: "bold" },
});
