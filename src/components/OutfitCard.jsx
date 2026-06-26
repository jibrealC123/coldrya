import { ExternalLinkIcon, ShoppingBagIcon, CheckIcon } from "./Icons";

export default function OutfitCard({ outfit, onAddToCart, inCart }) {
  return (
    <div className="group bg-white/[0.03] border border-white/[0.07] rounded-3xl overflow-hidden hover:border-violet-500/30 hover:bg-white/[0.05] transition-all duration-300 hover:shadow-[0_0_40px_rgba(124,58,237,0.08)]">
      {/* Image grid */}
      <div className="grid grid-cols-3 gap-px bg-white/[0.05]">
        {outfit.items.map((item) => (
          <div key={item.type} className="relative aspect-square overflow-hidden">
            <img
              src={item.image}
              alt=""
              aria-hidden="true"
              loading="lazy"
              width="300"
              height="300"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              onError={(e) => {
                e.currentTarget.src =
                  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=300&h=300&fit=crop";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 px-2.5 py-2">
              <p
                className="text-[10px] tracking-widest uppercase text-white/60"
                style={{ fontFamily: "var(--font-ui)", letterSpacing: "0.1em" }}
              >
                {item.type}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Card body */}
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3
              className="font-semibold text-xl leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {outfit.name}
            </h3>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {outfit.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] bg-violet-500/10 text-violet-400 px-2.5 py-0.5 rounded-full tracking-wide border border-violet-500/15"
                  style={{ fontFamily: "var(--font-ui)", letterSpacing: "0.05em" }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-4">
            <p
              className="text-2xl font-bold text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              ${outfit.totalPrice.toFixed(2)}
            </p>
            <p
              className="text-[10px] text-white/30 tracking-widest uppercase mt-0.5"
              style={{ fontFamily: "var(--font-ui)", letterSpacing: "0.1em" }}
            >
              full outfit
            </p>
          </div>
        </div>

        {/* Item list */}
        <div className="space-y-2.5 mb-5 border-t border-white/[0.06] pt-4">
          {outfit.items.map((item) => (
            <div key={item.type} className="flex items-center justify-between text-sm">
              <div>
                <span className="text-white/40" style={{ fontFamily: "var(--font-ui)" }}>
                  {item.type}
                </span>
                <span className="text-white/70 ml-2" style={{ fontFamily: "var(--font-ui)" }}>
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-2.5 ml-3">
                <span className="text-white/50 text-xs tabular-nums" style={{ fontFamily: "var(--font-ui)" }}>
                  ${item.price}
                </span>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Shop ${item.name} at ${item.brand}`}
                  className="inline-flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 border border-violet-500/20 hover:border-violet-500/40 hover:bg-violet-500/10 px-2.5 py-1 rounded-full transition-all duration-200 cursor-pointer"
                  style={{ fontFamily: "var(--font-ui)" }}
                >
                  {item.brand}
                  <ExternalLinkIcon size={11} />
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => onAddToCart(outfit)}
          disabled={inCart}
          className={`w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
            inCart
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 cursor-default"
              : "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white hover:scale-[1.02] hover:shadow-[0_0_24px_rgba(124,58,237,0.35)] cursor-pointer"
          }`}
          style={{ fontFamily: "var(--font-ui)", letterSpacing: "0.05em" }}
          aria-pressed={inCart}
        >
          {inCart ? (
            <>
              <CheckIcon size={15} />
              Saved to Cart
            </>
          ) : (
            <>
              <ShoppingBagIcon size={15} />
              Add to Cart
            </>
          )}
        </button>
      </div>
    </div>
  );
}
