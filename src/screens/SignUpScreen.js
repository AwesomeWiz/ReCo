import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
  Image,
  Alert,
  ScrollView
} from "react-native";
import axios from "axios";
import { LinearGradient } from "expo-linear-gradient";
import AppText from "../components/AppText";

const COUNTRIES = ["India", "UAE"];

const STATES = [
  "Andhra Pradesh",
  "Karnataka",
  "Kerala",
  "Puducherry",
  "Tamil Nadu",
  "Telangana",
];

const DISTRICTS = {
  "Andhra Pradesh": [
    "Anakapalli", "Anantapur", "Bapatla", "Chittoor", "East Godavari",
    "Eluru", "Guntur", "Kadapa", "Kakinada", "Konaseema",
    "Krishna", "Kurnool", "Nandyal", "NTR", "Nellore",
    "Palnadu", "Parvathipuram Manyam", "Prakasam", "Srikakulam",
    "Sri Sathya Sai", "Tirupati", "Visakhapatnam", "Vizianagaram",
    "West Godavari", "YSR Kadapa",
  ],
  "Karnataka": [
    "Bagalkot", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban",
    "Bidar", "Chamarajanagar", "Chikballapur", "Chikkamagaluru", "Chitradurga",
    "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan",
    "Haveri", "Kalaburagi", "Kodagu", "Kolar", "Koppal",
    "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shivamogga",
    "Tumakuru", "Udupi", "Uttara Kannada", "Vijayapura", "Yadgir",
  ],
  "Kerala": [
    "Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod",
    "Kollam", "Kottayam", "Kozhikode", "Malappuram", "Palakkad",
    "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad",
  ],
  "Puducherry": [
    "Karaikal", "Mahe", "Puducherry", "Yanam",
  ],
  "Tamil Nadu": [
    "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
    "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kancheepuram",
    "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai",
    "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai",
    "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi",
    "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli",
    "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur",
    "Vellore", "Viluppuram", "Virudhunagar",
  ],
  "Telangana": [
    "Adilabad", "Bhadradri Kothagudem", "Hanumakonda", "Hyderabad", "Jagtial",
    "Jangaon", "Jayashankar Bhupalpally", "Jogulamba Gadwal", "Kamareddy",
    "Karimnagar", "Khammam", "Komaram Bheem", "Mahabubabad", "Mahabubnagar",
    "Mancherial", "Medak", "Medchal-Malkajgiri", "Mulugu", "Nagarkurnool",
    "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli",
    "Rajanna Sircilla", "Rangareddy", "Sangareddy", "Siddipet",
    "Suryapet", "Vikarabad", "Wanaparthy", "Warangal", "Yadadri Bhuvanagiri",
  ],
};


export default function SignUpScreen({ navigation }) {

  const [store, setStore] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("India");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [countryModal, setCountryModal] = useState(false);
  const [stateModal, setStateModal] = useState(false);
  const [districtModal, setDistrictModal] = useState(false);

  const getPasswordErrors = (pwd) => {
    const errors = [];
    if (pwd.length < 8) errors.push("At least 8 characters");
    if (!/[A-Z]/.test(pwd)) errors.push("One uppercase letter");
    if (!/[0-9]/.test(pwd)) errors.push("One number");
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) errors.push("One special character");
    return errors;
  };

  const passwordErrors = getPasswordErrors(password);
  const isPasswordValid = passwordErrors.length === 0;
  const isPhoneValid = /^[0-9]{10}$/.test(phone);

  const handleSignup = async () => {
    try {
      if (!isPhoneValid) {
        Alert.alert("Invalid Phone", "Please enter a valid 10-digit phone number.");
        return;
      }
      if (!isPasswordValid) {
        Alert.alert("Weak Password", "Password must have:\n• " + passwordErrors.join("\n• "));
        return;
      }

      const res = await axios.post("http://10.0.8.90:5000/signup", {
        store: store,
        phone: phone,
        password: password,
        country: country,
        state: state,
        district: district,
      });

      Alert.alert("Success", "Account created successfully");

    } catch (err) {
      console.log(err.response?.data || err.message);
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

      <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>

        {/* Store Name */}
        <View style={styles.inputRow}>
          <Image source={require("../../assets/icons/Shop.png")} style={styles.icon} />
          <TextInput
            placeholder="Store Name"
            placeholderTextColor="#999999"
            style={styles.textInput}
            value={store}
            onChangeText={setStore}
          />
        </View>

        {/* Phone */}
        <View style={[styles.inputRow, phone.length > 0 && !isPhoneValid && styles.inputRowError]}>
          <Image source={require("../../assets/icons/Phone.png")} style={styles.icon} />
          <TextInput
            placeholder="Phone Number"
            placeholderTextColor="#999999"
            style={styles.textInput}
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
          />
        </View>
        {phone.length > 0 && !isPhoneValid && (
          <AppText font="regular" style={[styles.hintText, styles.hintFail, { marginTop: -8, marginBottom: 10, paddingHorizontal: 5 }]}>
            ✗ Must be exactly 10 digits ({phone.length}/10)
          </AppText>
        )}

        {/* Password */}
        <View style={[styles.inputRow, password.length > 0 && !isPasswordValid && styles.inputRowError]}>
          <Image source={require("../../assets/icons/Password.png")} style={styles.icon} />
          <TextInput
            placeholder="Password"
            placeholderTextColor="#999999"
            style={[styles.textInput, { color: "#1a1a1a" }]}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>
        {password.length > 0 && (
          <View style={styles.passwordHints}>
            {["At least 8 characters", "One uppercase letter", "One number", "One special character"].map((rule, i) => {
              const checks = [
                password.length >= 8,
                /[A-Z]/.test(password),
                /[0-9]/.test(password),
                /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
              ];
              return (
                <AppText key={i} font="regular" style={[styles.hintText, checks[i] ? styles.hintOk : styles.hintFail]}>
                  {checks[i] ? "✓" : "✗"} {rule}
                </AppText>
              );
            })}
          </View>
        )}

        {/* Country */}
        <Pressable style={styles.inputRow} onPress={() => setCountryModal(true)}>
          <Image source={require("../../assets/icons/Country.png")} style={styles.icon} />
          <AppText style={[styles.textInput, { color: country ? "#1a1a1a" : "#808080" }]}>
            {country || "Country"}
          </AppText>
        </Pressable>

        <Modal visible={countryModal} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <AppText font="semibold" style={styles.modalTitle}>Select Country</AppText>
              <ScrollView>
                {COUNTRIES.map((item) => (
                  <Pressable
                    key={item}
                    style={[styles.optionRow, country === item && styles.optionRowSelected]}
                    onPress={() => { setCountry(item); setCountryModal(false); }}
                  >
                    <AppText font="regular" style={[styles.optionText, country === item && styles.optionTextSelected]}>
                      {item}
                    </AppText>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable style={styles.closeBtn} onPress={() => setCountryModal(false)}>
                <AppText font="semibold" style={styles.closeBtnText}>Close</AppText>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* State */}
        <Pressable style={styles.inputRow} onPress={() => setStateModal(true)}>
          <Image source={require("../../assets/icons/State.png")} style={styles.icon} />
          <AppText style={[styles.textInput, { color: state ? "#1a1a1a" : "#808080" }]}>
            {state || "State"}
          </AppText>
        </Pressable>

        <Modal visible={stateModal} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <AppText font="semibold" style={styles.modalTitle}>Select State</AppText>
              <ScrollView>
                {STATES.map((item) => (
                  <Pressable
                    key={item}
                    style={[styles.optionRow, state === item && styles.optionRowSelected]}
                    onPress={() => {
                      setState(item);
                      setDistrict("");
                      setStateModal(false);
                    }}
                  >
                    <AppText font="regular" style={[styles.optionText, state === item && styles.optionTextSelected]}>
                      {item}
                    </AppText>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable style={styles.closeBtn} onPress={() => setStateModal(false)}>
                <AppText font="semibold" style={styles.closeBtnText}>Close</AppText>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* District */}
        <Pressable
          style={[styles.inputRow, !state && { opacity: 0.5 }]}
          onPress={() => state && setDistrictModal(true)}
        >
          <Image source={require("../../assets/icons/State.png")} style={styles.icon} />
          <AppText style={[styles.textInput, { color: district ? "#1a1a1a" : "#808080" }]}>
            {district || (state ? "District" : "Select State first")}
          </AppText>
        </Pressable>

        <Modal visible={districtModal} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <AppText font="semibold" style={styles.modalTitle}>Select District</AppText>
              <ScrollView>
                {(DISTRICTS[state] || []).map((item) => (
                  <Pressable
                    key={item}
                    style={[styles.optionRow, district === item && styles.optionRowSelected]}
                    onPress={() => { setDistrict(item); setDistrictModal(false); }}
                  >
                    <AppText font="regular" style={[styles.optionText, district === item && styles.optionTextSelected]}>
                      {item}
                    </AppText>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable style={styles.closeBtn} onPress={() => setDistrictModal(false)}>
                <AppText font="semibold" style={styles.closeBtnText}>Close</AppText>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Submit */}
        <TouchableOpacity style={styles.button} onPress={handleSignup}>
          <AppText font="satoshi" style={styles.buttonText}>
            Create An Account
          </AppText>
        </TouchableOpacity>

        <View style={styles.loginRow}>
          <AppText font="regular" style={{ color: "#808080" }}>
            Already have an account?
          </AppText>
          <Pressable onPress={() => navigation.navigate("Login")}>
            <AppText font="bold" style={{ color: "#000" }}>
              {" "}Sign in
            </AppText>
          </Pressable>
        </View>

      </ScrollView>
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

  inputRowError: {
    borderColor: "#e74c3c",
    borderWidth: 1,
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
    color: "#1a1a1a",
  },

  passwordHints: {
    marginTop: -8,
    marginBottom: 10,
    paddingHorizontal: 5,
  },

  hintText: {
    fontSize: 12,
    marginBottom: 2,
  },

  hintOk: {
    color: "#27ae60",
  },

  hintFail: {
    color: "#e74c3c",
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
    maxHeight: 420,
  },

  modalTitle: {
    fontSize: 16,
    color: "#1a1a1a",
    marginBottom: 12,
    textAlign: "center",
  },

  optionRow: {
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e0e0e0",
  },

  optionRowSelected: {
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
  },

  optionText: {
    fontSize: 15,
    color: "#1a1a1a",
  },

  optionTextSelected: {
    color: "#2254C5",
    fontFamily: "Poppins-SemiBold",
  },

  closeBtn: {
    marginTop: 14,
    paddingVertical: 12,
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    alignItems: "center",
  },

  closeBtnText: {
    color: "#1a1a1a",
    fontSize: 15,
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
    justifyContent: "center",
    alignItems: "center",
    marginTop: 30,
    marginBottom: 40,
    width: "100%",
  },

  bottomText: {
    textAlign: "center",
    marginTop: 30,
    fontSize: 16,
    color: "#808080",
  },
});
