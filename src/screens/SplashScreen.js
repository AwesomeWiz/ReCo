import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import AppText from "../components/AppText";

export default function SplashScreen({ navigation }) {

  useEffect(() => {
    setTimeout(() => {
      navigation.replace("SignUp");
    }, 2000);
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
