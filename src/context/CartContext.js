import React, { createContext, useState } from "react";

export const CartContext = createContext();

export function CartProvider({ children }) {
  const [transactionId, setTransactionId] = useState(null);
  const [cartItems, setCartItems] = useState([]);

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
        clearCart
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
