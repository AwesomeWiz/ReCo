import React, { useState } from "react";
import {
  View, StyleSheet, TextInput, TouchableOpacity, Image, Alert
} from "react-native";
import api from "../api/api";
import AppText from "../components/AppText";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const res = await api.post("/login", { phone, password });

      console.log("Login response:", res.data);

      if (!res.data || !res.data.token) {
        throw new Error("Invalid response from server: Missing token");
      }

      // Explicitly convert all stored values to strings to prevent native bridge crashes on Android
      await AsyncStorage.setItem("mfr_token", String(res.data.token));
      await AsyncStorage.setItem("store_name", String(res.data.store_name || "My Store"));
      await AsyncStorage.setItem("state", String(res.data.state || ""));
      await AsyncStorage.setItem("country", String(res.data.country || ""));
      await AsyncStorage.setItem("district", String(res.data.district || ""));

      navigation.reset({ index: 0, routes: [{ name: "Main" }] });
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || "An unknown error occurred";
      console.error("Login failed:", errorMsg);
      Alert.alert("Login Error", errorMsg);
    }
  };


  return (
    <View style={styles.container}>

      <AppText font="satoshi" style={styles.title}>
        Login
      </AppText>

      <View style={styles.form}>

        <View style={styles.inputRow}>
          <Image
            source={require("../../assets/icons/Phone.png")}
            style={styles.icon}
          />
          <TextInput
            placeholder="Phone Number"
            placeholderTextColor="#999999"
            style={styles.textInput}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        <View style={styles.inputRow}>
          <Image
            source={require("../../assets/icons/Password.png")}
            style={styles.icon}
          />
          <TextInput
            placeholder="Password"
            placeholderTextColor="#999999"
            style={styles.textInput}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <AppText font="satoshi" style={styles.buttonText}>
            Login
          </AppText>
        </TouchableOpacity>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F6EE",
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 32, marginBottom: 30 },
  form: { width: "85%" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 55,
    backgroundColor: "#fff",
    borderRadius: 28,
    paddingHorizontal: 15,
    marginBottom: 15,
    borderColor: "#808080",
    borderWidth: 0.5,
  },
  icon: { width: 20, height: 20, marginRight: 10 },
  textInput: { flex: 1, fontFamily: "Poppins-Regular", color: "#1a1a1a" },
  button: {
    backgroundColor: "#2254C5",
    height: 55,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: { color: "white", fontSize: 18 },
});
