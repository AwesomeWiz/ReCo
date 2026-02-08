import React, { useRef } from "react";
import { View, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import AppText from "../components/AppText";

export default function ScanScreen(){

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const captureImage = async () => {
    if(cameraRef.current){
      const photo = await cameraRef.current.takePictureAsync();
      console.log("Captured:", photo.uri);
      Alert.alert("Captured", "Image captured successfully");
    }
  };

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <AppText>No camera permission</AppText>
        <TouchableOpacity onPress={requestPermission}>
          <AppText>Grant Permission</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      <CameraView
        style={styles.camera}
        ref={cameraRef}
      />

      <TouchableOpacity style={styles.captureBtn} onPress={captureImage}>
        <AppText style={{color:"#fff"}}>Scan</AppText>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1 },
  camera:{ flex:1 },

  captureBtn:{
    position:"absolute",
    bottom:40,
    alignSelf:"center",
    backgroundColor:"#2254C5",
    paddingHorizontal:40,
    paddingVertical:15,
    borderRadius:30
  },

  center:{
    flex:1,
    justifyContent:"center",
    alignItems:"center"
  }
});
