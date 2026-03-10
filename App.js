import React, { useEffect, useState } from "react";
import * as Font from "expo-font";
import AppNavigator from "./src/navigation/AppNavigator";
import { CartProvider } from "./src/context/CartContext";

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          "Satoshi": require("./assets/fonts/Satoshi-Bold.otf"),
          "Poppins-Regular": require("./assets/fonts/Poppins-Regular.ttf"),
          "Poppins-SemiBold": require("./assets/fonts/Poppins-SemiBold.ttf"),
          "Poppins-Bold": require("./assets/fonts/Poppins-Bold.ttf"),
          "VictorMono-Bold": require("./assets/fonts/VictorMono-Bold.ttf"),
          "VictorMono-Semibold": require("./assets/fonts/VictorMono-SemiBold.ttf"),
        });
      } catch (error) {
        console.warn("Failed to load fonts:", error);
        // We continue anyway so the app can still boot with system fonts
      } finally {
        setFontsLoaded(true);
      }
    }

    loadFonts();
  }, []);

  if (!fontsLoaded) return null;

 return (
  <CartProvider>
    <AppNavigator />
  </CartProvider>
);

}
