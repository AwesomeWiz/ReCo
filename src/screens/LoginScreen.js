import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Alert
} from "react-native";
import axios from "axios";
import AppText from "../components/AppText";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function LoginScreen({ navigation }) {

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");


const handleLogin = async () => {
  try {

    const res = await axios.post("http://10.0.7.175:5000/login", {
      phone,
      password
    });

    console.log("Login response:", res.data);   // MOVE HERE

    await AsyncStorage.setItem("token", res.data.token);

    const saved = await AsyncStorage.getItem("token");
    console.log("Saved token:", saved);

    navigation.replace("Main");

  } catch (err) {
    Alert.alert("Error", "Invalid credentials");
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
  textInput: { flex: 1, fontFamily: "Poppins-Regular" },
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
