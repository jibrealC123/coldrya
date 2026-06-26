import { XIcon, ExternalLinkIcon, ShoppingBagIcon, SparkleIcon } from "./Icons";

export default function Cart({ cart, onRemove, onClose }) {
  const total = cart.reduce((sum, o) => sum + o.totalPrice, 0);

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-label="Shopping cart" aria-modal="true">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/50 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
        aria-label="Close cart"
      />

      {/* Panel */}
      <div className="w-full max-w-md bg-[#0f0f0f] border-l border-white/[0.07] flex flex-col h-full overflow-hidden shadow-[-40px_0_80px_rgba(0,0,0,0.6)]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.07] flex items-center justify-between flex-shrink-0">
          <div>
            <h2
              className="text-2xl font-semibold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              My Cart
            </h2>
            <p
              className="text-xs text-white/30 mt-0.5"
              style={{ fontFamily: "var(--font-ui)" }}
            >
              {cart.length} outfit{cart.length !== 1 ? "s" : ""} selected
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close cart"
            className="w-9 h-9 flex items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 text-white/50 hover:text-white transition-all duration-200 cursor-pointer"
          >
            <XIcon size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mb-5">
                <ShoppingBagIcon size={24} className="text-white/20" />
              </div>
              <h3
                className="text-xl font-semibold mb-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Your cart is empty
              </h3>
              <p className="text-white/30 text-sm" style={{ fontFamily: "var(--font-ui)", fontWeight: 300 }}>
                Add outfits from the results page
              </p>
            </div>
          ) : (
            cart.map((outfit) => (
              <div
                key={outfit.id}
                className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4"
              >
                {/* Outfit header */}
                <div className="flex items-start justify-between mb-3">
                  <h3
                    className="font-semibold text-base leading-tight"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {outfit.name}
                  </h3>
                  <button
                    onClick={() => onRemove(outfit.id)}
                    aria-label={`Remove ${outfit.name} from cart`}
                    className="text-xs text-white/30 hover:text-red-400 transition-colors duration-200 ml-4 flex-shrink-0 cursor-pointer"
                    style={{ fontFamily: "var(--font-ui)" }}
                  >
                    Remove
                  </button>
                </div>

                {/* Items */}
                <div className="space-y-2.5">
                  {outfit.items.map((item) => (
                    <div key={item.type} className="flex items-center gap-3">
                      <img
                        src={item.image}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        width="40"
                        height="40"
                        className="w-10 h-10 rounded-xl object-cover flex-shrink-0 bg-white/[0.05]"
                        onError={(e) => {
                          e.currentTarget.src =
                            "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=80&h=80&fit=crop";
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm text-white/80 truncate"
                          style={{ fontFamily: "var(--font-ui)" }}
                        >
                          {item.name}
                        </p>
                        <p
                          className="text-xs text-white/30"
                          style={{ fontFamily: "var(--font-ui)" }}
                        >
                          {item.brand}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className="text-xs text-white/40 tabular-nums"
                          style={{ fontFamily: "var(--font-ui)" }}
                        >
                          ${item.price}
                        </span>
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Buy ${item.name} at ${item.brand}`}
                          className="w-7 h-7 rounded-lg bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center transition-colors duration-200 cursor-pointer"
                        >
                          <ExternalLinkIcon size={11} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Outfit subtotal */}
                <div className="mt-3.5 pt-3.5 border-t border-white/[0.06] flex justify-between items-center text-sm">
                  <span className="text-white/30" style={{ fontFamily: "var(--font-ui)" }}>Outfit total</span>
                  <span
                    className="font-semibold text-white/80 tabular-nums"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    ${outfit.totalPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="px-6 py-5 border-t border-white/[0.07] flex-shrink-0 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-white/40 text-sm" style={{ fontFamily: "var(--font-ui)" }}>
                Combined total
              </span>
              <span
                className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent tabular-nums"
                style={{ fontFamily: "var(--font-display)" }}
              >
                ${total.toFixed(2)}
              </span>
            </div>
            <p
              className="text-[10px] text-white/20 text-center leading-relaxed"
              style={{ fontFamily: "var(--font-ui)" }}
            >
              Each item links directly to the brand's official website
            </p>
            <button
              onClick={onClose}
              className="w-full py-3.5 border border-white/[0.1] rounded-full text-sm text-white/50 hover:text-white/80 hover:border-white/20 hover:bg-white/[0.04] transition-all duration-200 cursor-pointer"
              style={{ fontFamily: "var(--font-ui)", letterSpacing: "0.06em" }}
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
