import { useState } from "react";
import { ShoppingBagIcon, SparkleIcon } from "./Icons";

const NAV_ITEMS = ["New In", "Casual", "Formal", "Athletic", "Sale"];

export default function Navbar({ cartCount, onCartClick }) {
  const [activeHover, setActiveHover] = useState(null);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">

        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <SparkleIcon size={14} className="text-stone-400" />
          <span
            className="text-lg font-semibold text-stone-900 tracking-wide"
            style={{ fontFamily: "var(--font-display)" }}
          >
            ColdRya
          </span>
        </div>

        {/* Centre nav */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              onMouseEnter={() => setActiveHover(item)}
              onMouseLeave={() => setActiveHover(null)}
              className="relative text-[12px] tracking-[0.08em] uppercase text-stone-400 hover:text-stone-900 transition-colors duration-200 cursor-pointer pb-0.5"
              style={{ fontFamily: "var(--font-ui)", fontWeight: 500 }}
            >
              {item}
              <span
                className="absolute bottom-0 left-0 right-0 h-px bg-stone-900 transition-all duration-300"
                style={{
                  transform: activeHover === item ? "scaleX(1)" : "scaleX(0)",
                  transformOrigin: "left center",
                }}
              />
            </button>
          ))}
        </div>

        {/* Cart */}
        <button
          onClick={onCartClick}
          aria-label={`Cart — ${cartCount} item${cartCount !== 1 ? "s" : ""}`}
          className="relative flex items-center gap-2 px-4 py-2 border border-stone-200 hover:border-stone-400 hover:bg-stone-50 transition-all duration-200 cursor-pointer flex-shrink-0"
        >
          <ShoppingBagIcon size={15} className="text-stone-500" />
          <span
            className="text-[11px] text-stone-500 hidden sm:block tracking-[0.06em] uppercase"
            style={{ fontFamily: "var(--font-ui)", fontWeight: 500 }}
          >
            Cart
          </span>
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-stone-900 text-white text-[10px] w-[18px] h-[18px] rounded-full flex items-center justify-center font-bold">
              {cartCount}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}
