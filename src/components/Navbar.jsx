import { useState } from "react";
import { ShoppingBagIcon, SparkleIcon } from "./Icons";

const NAV_ITEMS = ["New In", "Casual", "Formal", "Athletic", "Sale"];

export default function Navbar({ cartCount, onCartClick }) {
  const [activeHover, setActiveHover] = useState(null);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">

        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <SparkleIcon size={15} className="text-violet-400" />
          <span
            className="text-lg font-semibold text-white tracking-wide"
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
              className="relative text-[13px] text-white/55 hover:text-white transition-colors duration-200 cursor-pointer pb-0.5"
              style={{ fontFamily: "var(--font-ui)", fontWeight: 500 }}
            >
              {item}
              <span
                className="absolute bottom-0 left-0 right-0 h-px bg-white transition-all duration-300"
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
          className="relative flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 hover:border-white/25 hover:bg-white/[0.06] transition-all duration-200 cursor-pointer flex-shrink-0"
        >
          <ShoppingBagIcon size={16} className="text-white/65" />
          <span
            className="text-[12px] text-white/55 hidden sm:block"
            style={{ fontFamily: "var(--font-ui)", fontWeight: 500, letterSpacing: "0.06em" }}
          >
            Cart
          </span>
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-[10px] w-[18px] h-[18px] rounded-full flex items-center justify-center font-bold">
              {cartCount}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}
