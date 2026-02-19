import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
  Image,
  Alert
} from "react-native";
import axios from "axios";
import { LinearGradient } from "expo-linear-gradient";
import { Picker } from "@react-native-picker/picker";
import AppText from "../components/AppText";


export default function SignUpScreen({ navigation }) {

  const [store, setStore] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("India");
  const [state, setState] = useState("");
  const [countryModal, setCountryModal] = useState(false);
  const [stateModal, setStateModal] = useState(false);

  const handleSignup = async () => {
  try {

    const res = await axios.post("http://10.0.9.80:5000/signup", {
      store: store,
      phone: phone,
      password: password,
      country: country,
      state: state,
    });

    Alert.alert("Success", "Account created successfully");

  } catch (err) {
    console.log(err.response?.data || err.message);   // ADD
    Alert.alert("Error", "Signup failed");
  }
};


  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/Ellipse.png")}
        style={styles.ellipse}
      />


      <AppText font="satoshi" style={styles.title}>
        Sign up
      </AppText>

      <AppText font="regular" style={styles.subtitle}>
        Enter your store details to sign up your account
      </AppText>

      <View style={styles.form}>

      <View style={styles.inputRow}>
        <Image
          source={require("../../assets/icons/Shop.png")}
          style={styles.icon}
        />

        <TextInput
          placeholder="Store Name"
          placeholderTextColor="#999999"
          style={styles.textInput}
          value={store}
          onChangeText={setStore}
        />
      </View>


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


<Pressable style={styles.inputRow} onPress={() => setCountryModal(true)}>
  <Image
    source={require("../../assets/icons/Country.png")}
    style={styles.icon}
  />

<AppText
  style={[
    styles.textInput,
    { color: country ? "#000" : "#808080" }
  ]}
>
  {country || "Country"}
</AppText>

</Pressable>


<Modal visible={countryModal} transparent animationType="slide">
  <View style={styles.modalContainer}>
    <View style={styles.modalContent}>
      <Picker
        selectedValue={country}
        itemStyle={{ color: "black" }}   
        onValueChange={(itemValue) => {
          setCountry(itemValue);
          setCountryModal(false);
        }}
      >

        <Picker.Item label="India" value="India" />
        <Picker.Item label="UAE" value="UAE" />
      </Picker>

      <Pressable onPress={() => setCountryModal(false)}>
        <AppText font="semibold" style={{textAlign:"center"}}>Close</AppText>
      </Pressable>
    </View>
  </View>
</Modal>


<Pressable style={styles.inputRow} onPress={() => setStateModal(true)}>
  <Image
    source={require("../../assets/icons/State.png")}
    style={styles.icon}
  />

<AppText
  style={[
    styles.textInput,
    { color: state ? "#000" : "#808080" }
  ]}
>
  {state || "State"}
</AppText>

</Pressable>


<Modal visible={stateModal} transparent animationType="slide">
  <View style={styles.modalContainer}>
    <View style={styles.modalContent}>
      <Picker
        selectedValue={state}
        itemStyle={{ color: "black" }}   // ADD THIS
        onValueChange={(itemValue) => {
          setState(itemValue);
          setStateModal(false);
        }}
      >

        <Picker.Item label="Kerala" value="Kerala" />
        <Picker.Item label="Tamil Nadu" value="Tamil Nadu" />
      </Picker>

      <Pressable onPress={() => setStateModal(false)}>
        <AppText font="semibold" style={{textAlign:"center"}}>Close</AppText>
      </Pressable>
    </View>
  </View>
</Modal>


        <TouchableOpacity style={styles.button} onPress={handleSignup}>
          <AppText font="satoshi" style={styles.buttonText}>
            Create An Account
          </AppText>
        </TouchableOpacity>

        <View style={styles.loginRow}>
          <AppText font="regular" style={{color:"#808080"}}>
            Already have an account?
          </AppText>

          <Pressable onPress={() => navigation.navigate("Login")}>
            <AppText font="bold" style={{color:"#000"}}>
              {" "}Sign in
            </AppText>
          </Pressable>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
  flex: 1,
  backgroundColor: "#F9F6EE",
  paddingTop: 120,
  alignItems: "center",
},

ellipse: {
  position: "absolute",
  right: 0,
  top: 150,
  resizeMode: "contain",
},


  title: {
    fontSize: 32,
  },

  subtitle: {
    marginTop: 20,
    color: "#808080",
    textAlign: "center",
    marginBottom: 30,
    width: "70%",
    fontSize: 16,
  },

  form: {
    width: "85%",
  },

input: {
  height: 50,
  backgroundColor: "#fff",
  borderRadius: 25,
  paddingHorizontal: 20,
  marginBottom: 15,
  justifyContent: "center", 
},
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

icon: {
  width: 20,
  height: 20,
  marginRight: 10,
  resizeMode: "contain",
},

textInput: {
  flex: 1,
  fontSize: 15,
  fontFamily: "Poppins-Regular", 
},


  dropdown: {
    backgroundColor: "#f2f2f2",
    borderRadius: 25,
    marginBottom: 15,
    overflow: "hidden",
  },
modalContainer: {
  flex: 1,
  justifyContent: "flex-end",
  backgroundColor: "rgba(0,0,0,0.4)",
},

modalContent: {
  backgroundColor: "white",
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  padding: 20,
  height: 300,   // ADD
},


  button: {
    backgroundColor: "#2254C5",
    height: 55,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },

  buttonText: {
    color: "white",
    fontSize: 18,
  },
loginRow: {
  flexDirection: "row",
  justifyContent: "center",   // centers horizontally
  alignItems: "center",
  marginTop: 30,
  width: "100%",
},

  bottomText: {
    textAlign: "center",
    marginTop: 30,
    fontSize: 16,
    color: "#808080",
  },
});
