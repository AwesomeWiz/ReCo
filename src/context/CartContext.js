import React, { createContext, useState } from "react";

export const CartContext = createContext();

export function CartProvider({ children }) {
  const [transactionId, setTransactionId] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null); // null = today

  const clearCart = () => {
    setTransactionId(null);
    setCartItems([]);
  };

  return (
    <CartContext.Provider
      value={{
        transactionId,
        setTransactionId,
        cartItems,
        setCartItems,
        clearCart,
        selectedDate,
        setSelectedDate,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
