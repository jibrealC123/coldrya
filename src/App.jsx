import { useState } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import StyleForm from "./components/StyleForm";
import Results from "./components/Results";
import Cart from "./components/Cart";
import "./index.css";

export default function App() {
  const [page, setPage] = useState("hero");
  const [profile, setProfile] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);

  const handleStart = () => setPage("form");

  const handleFormSubmit = (data) => {
    setProfile(data);
    setPage("results");
  };

  const handleAddToCart = (outfit) => {
    setCart((prev) =>
      prev.some((o) => o.id === outfit.id)
        ? prev.filter((o) => o.id !== outfit.id)
        : [...prev, outfit]
    );
  };

  const handleRemoveFromCart = (id) => {
    setCart((prev) => prev.filter((o) => o.id !== id));
  };

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <Navbar cartCount={cart.length} onCartClick={() => setCartOpen(true)} />

      {page === "hero" && <Hero onStart={handleStart} />}
      {page === "form" && <StyleForm onSubmit={handleFormSubmit} />}
      {page === "results" && profile && (
        <Results
          profile={profile}
          cart={cart}
          onAddToCart={handleAddToCart}
          onReset={() => setPage("hero")}
        />
      )}

      {cartOpen && (
        <Cart
          cart={cart}
          onRemove={handleRemoveFromCart}
          onClose={() => setCartOpen(false)}
        />
      )}
    </div>
  );
}
