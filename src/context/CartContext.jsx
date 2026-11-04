
import {
    createContext,
    useContext,
    useEffect,
    useState,
  } from "react";
  
  const CartContext = createContext(null);
  
  export function CartProvider({ children }) {
    const [cart, setCart] = useState(() => {
      try {
        const saved = localStorage.getItem("frosty-cart");
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    });
  
    useEffect(() => {
      localStorage.setItem("frosty-cart", JSON.stringify(cart));
    }, [cart]);
  
    const addToCart = (product, quantity = 1) => {
      setCart((current) => {
        const existing = current.find(
          (item) => item.id === product.id
        );
  
        if (existing) {
          return current.map((item) =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        }
  
        return [...current, { ...product, quantity }];
      });
    };
  
    const removeFromCart = (id) => {
      setCart((current) =>
        current.filter((item) => item.id !== id)
      );
    };
  
    const updateQuantity = (id, quantity) => {
      if (quantity < 1) {
        removeFromCart(id);
        return;
      }
  
      setCart((current) =>
        current.map((item) =>
          item.id === id ? { ...item, quantity } : item
        )
      );
    };
  
    const clearCart = () => setCart([]);
  
    const cartCount = cart.reduce(
      (total, item) => total + item.quantity,
      0
    );
  
    const cartTotal = cart.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
  
    return (
      <CartContext.Provider
        value={{
          cart,
          addToCart,
          removeFromCart,
          updateQuantity,
          clearCart,
          cartCount,
          cartTotal,
        }}
      >
        {children}
      </CartContext.Provider>
    );
  }
  
  export function useCart() {
    const context = useContext(CartContext);
  
    if (!context) {
      throw new Error("useCart must be used inside CartProvider");
    }
  
    return context;
  }
  