
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const CartContext = createContext(null);

const CART_KEY = "seventeen_cart";

// Create a unique cart ID for each product and flavour
function getCartItemId(product) {
  const productId = product.productId ?? product.id;

  if (productId == null) {
    return null;
  }

  const flavour =
    product.selectedFlavour ??
    product.flavour ??
    "";

  // ProductCard or Shop may already supply a
  // flavour-specific cart ID.
  if (
    product.productId != null &&
    product.id != null &&
    String(product.id) !== String(product.productId)
  ) {
    return String(product.id);
  }

  return flavour
    ? `${productId}-${flavour}`
    : String(productId);
}

// Normalize saved cart items and new products
function normalizeCartItem(product, quantity) {
  const id = getCartItemId(product);

  const amount = Math.floor(Number(quantity));

  const price = Number(product.price ?? 0);

  if (
    id == null ||
    !Number.isFinite(amount) ||
    amount < 1 ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    return null;
  }

  const selectedFlavour =
    product.selectedFlavour ??
    product.flavour ??
    "";

  return {
    id,

    // Original product ID used by the backend
    productId: String(
      product.productId ?? product.id
    ),

    name:
      product.name ??
      product.productName ??
      "Ice Cream",

    size: product.size ?? "",

    unit: product.unit ?? "unit",

    selectedFlavour,

    price,

    image:
      product.image ??
      product.imageUrl ??
      "",

    quantity: amount,
  };
}

// Read previously saved cart from localStorage
function readCart() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(CART_KEY) || "[]"
    );

    if (!Array.isArray(saved)) {
      return [];
    }

    const normalized = [];

    for (const item of saved) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const cartItem = normalizeCartItem(
        item,
        item.quantity
      );

      if (!cartItem) {
        continue;
      }

      const existing = normalized.find(
        (entry) => entry.id === cartItem.id
      );

      if (existing) {
        existing.quantity += cartItem.quantity;
      } else {
        normalized.push(cartItem);
      }
    }

    return normalized;
  } catch (error) {
    console.error("Failed to read saved cart:", error);
    return [];
  }
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(readCart);

  // Save cart whenever products or quantities change
  useEffect(() => {
    try {
      localStorage.setItem(
        CART_KEY,
        JSON.stringify(cart)
      );
    } catch (error) {
      console.error("Failed to save cart:", error);
    }
  }, [cart]);

  // Add product with selected flavour and quantity
  const addToCart = (product, quantity = 1) => {
    if (!product || typeof product !== "object") {
      return;
    }

    const newItem = normalizeCartItem(
      product,
      quantity
    );

    if (!newItem) {
      return;
    }

    setCart((previous) => {
      const existing = previous.find(
        (item) => item.id === newItem.id
      );

      // If same product + flavour exists,
      // increase its quantity
      if (existing) {
        return previous.map((item) =>
          item.id === newItem.id
            ? {
                ...item,
                quantity:
                  item.quantity + newItem.quantity,
              }
            : item
        );
      }

      // Otherwise create a separate cart item
      return [...previous, newItem];
    });
  };

  // Update quantity of a specific cart item
  const updateQuantity = (id, quantity) => {
    const amount = Math.floor(Number(quantity));

    if (!Number.isFinite(amount)) {
      return;
    }

    setCart((previous) =>
      previous
        .map((item) =>
          String(item.id) === String(id)
            ? {
                ...item,
                quantity: amount,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  // Increase quantity by one
  const increaseQuantity = (id) => {
    setCart((previous) =>
      previous.map((item) =>
        String(item.id) === String(id)
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
          : item
      )
    );
  };

  // Decrease quantity by one
  const decreaseQuantity = (id) => {
    setCart((previous) =>
      previous
        .map((item) =>
          String(item.id) === String(id)
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  // Remove one product/flavour combination
  const removeFromCart = (id) => {
    setCart((previous) =>
      previous.filter(
        (item) => String(item.id) !== String(id)
      )
    );
  };

  // Remove every item from the cart
  
const clearCart = () => {
  setCart([]);
};

// Add clearCart to your existing context value.
// Keep all your existing functions such as addToCart,
// removeFromCart and updateQuantity.
<CartContext.Provider
  value={{
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
  }}
>
  {children}
</CartContext.Provider>


  // Total quantity across all products
  const cartCount = useMemo(() => {
    return cart.reduce(
      (total, item) =>
        total + Number(item.quantity),
      0
    );
  }, [cart]);

  // Total price across all products
  const cartTotal = useMemo(() => {
    return cart.reduce(
      (total, item) =>
        total +
        Number(item.price) *
          Number(item.quantity),
      0
    );
  }, [cart]);

  // Number of distinct cart lines
  const cartItemCount = useMemo(() => {
    return cart.length;
  }, [cart]);

  // Determine whether the cart is empty
  const isCartEmpty = cart.length === 0;

  const value = useMemo(
    () => ({
      cart,

      // Alternative name for existing components
      items: cart,

      addToCart,

      updateQuantity,
      increaseQuantity,
      decreaseQuantity,

      removeFromCart,
      clearCart,

      cartCount,
      cartTotal,
      cartItemCount,
      isCartEmpty,
    }),
    [
      cart,
      cartCount,
      cartTotal,
      cartItemCount,
      isCartEmpty,
    ]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

// Custom hook to access the cart anywhere
export function useCart() {
  const context = useContext(CartContext);

  if (context === null) {
    throw new Error(
      "useCart must be used inside CartProvider"
    );
  }

  return context;
}
