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
import api from "../api/api";
import { LinearGradient } from "expo-linear-gradient";
import AppText from "../components/AppText";

const COUNTRIES = ["India", "UAE"];

const STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

const DISTRICTS = {
  "Andaman and Nicobar Islands": ["Nicobar", "North and Middle Andaman", "South Andaman"],
  "Andhra Pradesh": ["Alluri Sitharama Raju", "Anakapalli", "Ananthapuramu", "Annamayya", "Bapatla", "Chittoor", "Dr. B.R. Ambedkar Konaseema", "East Godavari", "Eluru", "Guntur", "Kakinada", "Krishna", "Kurnool", "Nandyal", "NTR", "Palnadu", "Parvathipuram Manyam", "Prakasam", "Sri Potti Sriramulu Nellore", "Sri Sathya Sai", "Srikakulam", "Tirupati", "Visakhapatnam", "Vizianagaram", "West Godavari", "Y.S.R. Kadapa"],
  "Arunachal Pradesh": ["Anjaw", "Changlang", "Dibang Valley", "East Kameng", "East Siang", "Kamle", "Kra Daadi", "Kurung Kumey", "Lepa Rada", "Lohit", "Longding", "Lower Dibang Valley", "Lower Siang", "Lower Subansiri", "Namsai", "Pakke Kessang", "Papum Pare", "Shi Yomi", "Siang", "Tawang", "Tirap", "Upper Siang", "Upper Subansiri", "West Kameng", "West Siang"],
  "Assam": ["Baksa", "Barpeta", "Biswanath", "Bongaigaon", "Cachar", "Charaideo", "Chirang", "Darrang", "Dhemaji", "Dhubri", "Dibrugarh", "Dima Hasao", "Goalpara", "Golaghat", "Hailakandi", "Hojai", "Jorhat", "Kamrup Metropolitan", "Kamrup", "Karbi Anglong", "Karimganj", "Kokrajhar", "Lakhimpur", "Majuli", "Morigaon", "Nagaon", "Nalbari", "Sivasagar", "Sonitpur", "South Salmara-Mankachar", "Tinsukia", "Udalguri", "West Karbi Anglong"],
  "Bihar": ["Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur", "Bhojpur", "Buxar", "Darbhanga", "East Champaran", "Gaya", "Gopalganj", "Jamui", "Jehanabad", "Kaimur", "Katihar", "Khagaria", "Kishanganj", "Lakhisarai", "Madhepura", "Madhubani", "Munger", "Muzaffarpur", "Nalanda", "Nawada", "Patna", "Purnia", "Rohtas", "Saharsa", "Samastipur", "Saran", "Sheikhpura", "Sheohar", "Sitamarhi", "Siwan", "Supaul", "Vaishali", "West Champaran"],
  "Chandigarh": ["Chandigarh"],
  "Chhattisgarh": ["Balod", "Baloda Bazar", "Balrampur", "Bastar", "Bemetara", "Bijapur", "Bilaspur", "Dantewada", "Dhamtari", "Durg", "Gariaband", "Gaurela Pendra Marwahi", "Janjgir-Champa", "Jashpur", "Kabirdham", "Kanker", "Kondagaon", "Korba", "Koriya", "Mahasamund", "Mungeli", "Narayanpur", "Raigarh", "Raipur", "Rajnandgaon", "Sukma", "Surajpur", "Surguja"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Dadra and Nagar Haveli", "Daman", "Diu"],
  "Delhi": ["Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi", "North West Delhi", "Shahdara", "South Delhi", "South East Delhi", "South West Delhi", "West Delhi"],
  "Goa": ["North Goa", "South Goa"],
  "Gujarat": ["Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha", "Bharuch", "Bhavnagar", "Botad", "Chhota Udaipur", "Dahod", "Dang", "Devbhoomi Dwarka", "Gandhinagar", "Gir Somnath", "Jamnagar", "Junagadh", "Kheda", "Kutch", "Mahisagar", "Mehsana", "Morbi", "Narmada", "Navsari", "Panchmahal", "Patan", "Porbandar", "Rajkot", "Sabarkantha", "Surat", "Surendranagar", "Tapi", "Vadodara", "Valsad"],
  "Haryana": ["Ambala", "Bhiwani", "Charkhi Dadri", "Faridabad", "Fatehabad", "Gurugram", "Hisar", "Jhajjar", "Jind", "Kaithal", "Karnal", "Kurukshetra", "Mahendragarh", "Nuh", "Palwal", "Panchkula", "Panipat", "Rewari", "Rohtak", "Sirsa", "Sonipat", "Yamunanagar"],
  "Himachal Pradesh": ["Bilaspur", "Chamba", "Hamirpur", "Kangra", "Kinnaur", "Kullu", "Lahaul and Spiti", "Mandi", "Shimla", "Sirmaur", "Solan", "Una"],
  "Jammu and Kashmir": ["Anantnag", "Bandipora", "Baramulla", "Budgam", "Doda", "Ganderbal", "Jammu", "Kathua", "Kishtwar", "Kulgam", "Kupwara", "Poonch", "Pulwama", "Rajouri", "Ramban", "Reasi", "Samba", "Shopian", "Srinagar", "Udhampur"],
  "Jharkhand": ["Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka", "East Singhbhum", "Garhwa", "Giridih", "Godda", "Gumla", "Hazaribagh", "Jamtara", "Khunti", "Koderma", "Latehar", "Lohardaga", "Pakur", "Palamu", "Ramgarh", "Ranchi", "Sahibganj", "Saraikela Kharsawan", "Simdega", "West Singhbhum"],
  "Karnataka": ["Bagalkote", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban", "Bidar", "Chamarajanagara", "Chikkaballapura", "Chikkamagaluru", "Chitradurga", "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan", "Haveri", "Kalaburagi", "Kodagu", "Kolar", "Koppal", "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shivamogga", "Tumakuru", "Udupi", "Uttara Kannada", "Vijayapura", "Yadgiri"],
  "Kerala": ["Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad"],
  "Ladakh": ["Kargil", "Leh"],
  "Lakshadweep": ["Lakshadweep"],
  "Madhya Pradesh": ["Agar Malwa", "Alirajpur", "Anuppur", "Ashoknagar", "Balaghat", "Barwani", "Betul", "Bhind", "Bhopal", "Burhanpur", "Chhatarpur", "Chhindwara", "Damoh", "Datia", "Dewas", "Dhar", "Dindori", "Guna", "Gwalior", "Harda", "Narmadapuram", "Indore", "Jabalpur", "Jhabua", "Katni", "Khandwa", "Khargone", "Mandla", "Mandsaur", "Morena", "Narsinghpur", "Neemuch", "Niwari", "Panna", "Raisen", "Rajgarh", "Ratlam", "Rewa", "Sagar", "Satna", "Sehore", "Seoni", "Shahdol", "Shajapur", "Sheopur", "Shivpuri", "Sidhi", "Singrauli", "Tikamgarh", "Ujjain", "Umaria", "Vidisha"],
  "Maharashtra": ["Ahmednagar", "Akola", "Amravati", "Chhatrapati Sambhajinagar", "Beed", "Bhandara", "Buldhana", "Chandrapur", "Dhule", "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded", "Nandurbar", "Nashik", "Dharashiv", "Palghar", "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg", "Solapur", "Thane", "Wardha", "Washim", "Yavatmal"],
  "Manipur": ["Bishnupur", "Chandel", "Churachandpur", "Imphal East", "Imphal West", "Jiribam", "Kakching", "Kamjong", "Kangpokpi", "Noney", "Pherzawl", "Senapati", "Tamenglong", "Tengnoupal", "Thoubal", "Ukhrul"],
  "Meghalaya": ["East Garo Hills", "East Jaintia Hills", "East Khasi Hills", "North Garo Hills", "Ri Bhoi", "South Garo Hills", "South West Garo Hills", "South West Khasi Hills", "West Garo Hills", "West Jaintia Hills", "West Khasi Hills"],
  "Mizoram": ["Aizawl", "Champhai", "Hnahthial", "Khawzawl", "Kolasib", "Lawngtlai", "Lunglei", "Mamit", "Saiha", "Saitual", "Serchhip"],
  "Nagaland": ["Chumoukedima", "Dimapur", "Kiphire", "Kohima", "Longleng", "Mokokchung", "Mon", "Niuland", "Noklak", "Peren", "Phek", "Shamator", "Tseminyu", "Tuensang", "Wokha", "Zunheboto"],
  "Odisha": ["Angul", "Balangir", "Balasore", "Bargarh", "Bhadrak", "Boudh", "Cuttack", "Deogarh", "Dhenkanal", "Gajapati", "Ganjam", "Jagatsinghpur", "Jajpur", "Jharsuguda", "Kalahandi", "Kandhamal", "Kendrapara", "Kendujhar", "Khordha", "Koraput", "Malkangiri", "Mayurbhanj", "Nabarangpur", "Nayagarh", "Nuapada", "Puri", "Rayagada", "Sambalpur", "Subarnapur", "Sundargarh"],
  "Puducherry": ["Karaikal", "Mahe", "Puducherry", "Yanam"],
  "Punjab": ["Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib", "Fazilka", "Firozpur", "Gurdaspur", "Hoshiarpur", "Jalandhar", "Kapurthala", "Ludhiana", "Mansa", "Moga", "Muktsar", "Pathankot", "Patiala", "Rupnagar", "Sahibzada Ajit Singh Nagar", "Sangrur", "Shahid Bhagat Singh Nagar", "Sri Muktsar Sahib", "Tarn Taran"],
  "Rajasthan": ["Ajmer", "Alwar", "Banswara", "Baran", "Barmer", "Bharatpur", "Bhilwara", "Bikaner", "Bundi", "Chittorgarh", "Churu", "Dausa", "Dholpur", "Dungarpur", "Hanumangarh", "Jaipur", "Jaisalmer", "Jalore", "Jhalawar", "Jhunjhunu", "Jodhpur", "Karauli", "Kota", "Nagaur", "Pali", "Pratapgarh", "Rajsamand", "Sawai Madhopur", "Sikar", "Sirohi", "Sri Ganganagar", "Tonk", "Udaipur"],
  "Sikkim": ["East Sikkim", "North Sikkim", "South Sikkim", "West Sikkim", "Pakyong", "Soreng"],
  "Tamil Nadu": ["Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram", "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar"],
  "Telangana": ["Adilabad", "Bhadradri Kothagudem", "Hanumakonda", "Hyderabad", "Jagtial", "Jangaon", "Jayashankar Bhupalpally", "Jogulamba Gadwal", "Kamareddy", "Karimnagar", "Khammam", "Komaram Bheem Asifabad", "Mahabubabad", "Mahabubnagar", "Mancherial", "Medak", "Medchal-Malkajgiri", "Mulugu", "Nagarkurnool", "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli", "Rajanna Sircilla", "Rangareddy", "Sangareddy", "Siddipet", "Suryapet", "Vikarabad", "Wanaparthy", "Warangal", "Yadadri Bhuvanagiri"],
  "Tripura": ["Dhalai", "Gomati", "Khowai", "North Tripura", "Sepahijala", "South Tripura", "Unakoti", "West Tripura"],
  "Uttar Pradesh": ["Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya", "Ayodhya", "Azamgarh", "Baghpat", "Bahraich", "Ballia", "Balrampur", "Banda", "Barabanki", "Bareilly", "Basti", "Bhadohi", "Bijnor", "Budaun", "Bulandshahr", "Chandauli", "Chitrakoot", "Deoria", "Etah", "Etawah", "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar", "Ghaziabad", "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur", "Hapur", "Hardoi", "Hathras", "Jalaun", "Jaunpur", "Jhansi", "Kannauj", "Kanpur Dehat", "Kanpur Nagar", "Kasganj", "Kaushambi", "Kheri", "Kushinagar", "Lalitpur", "Lucknow", "Maharajganj", "Mahoba", "Mainpuri", "Mathura", "Mau", "Meerut", "Mirzapur", "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh", "Prayagraj", "Raebareli", "Rampur", "Saharanpur", "Sambhal", "Sant Kabir Nagar", "Shahjahanpur", "Shamli", "Shravasti", "Siddharthnagar", "Sitapur", "Sonbhadra", "Sultanpur", "Unnao", "Varanasi"],
  "Uttarakhand": ["Almora", "Bageshwar", "Chamoli", "Champawat", "Dehradun", "Haridwar", "Nainital", "Pauri Garhwal", "Pithoragarh", "Rudraprayag", "Tehri Garhwal", "Udham Singh Nagar", "Uttarkashi"],
  "West Bengal": ["Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur", "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Jhargram", "Kalimpong", "Kolkata", "Malda", "Murshidabad", "Nadia", "North 24 Parganas", "Paschim Bardhaman", "Paschim Medinipur", "Purba Bardhaman", "Purba Medinipur", "Purulia", "South 24 Parganas", "Uttar Dinajpur"]
};


export default function SignUpScreen({ navigation }) {

  const [store, setStore] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
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

      const res = await api.post("/signup", {  // ← was axios.post("http://10.0.8.90:5000/signup", {
        store,
        phone,
        password,
        country: "India",
        state,
        district,
      });

      Alert.alert("Success", "Account created successfully", [
        {
          text: "Login",
          onPress: () => navigation.reset({
            index: 0,
            routes: [{ name: "Login" }],
          }),
        }
      ]);

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
