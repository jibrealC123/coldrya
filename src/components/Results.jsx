import { useState } from "react";
import OutfitCard from "./OutfitCard";
import { getOutfits } from "../data/outfits";
import { ArrowLeftIcon, RefreshIcon } from "./Icons";

export default function Results({ profile, cart, onAddToCart, onReset }) {
  const outfits = getOutfits(profile.style, profile.gender, profile.budget);
  const [filter, setFilter] = useState("all");

  const allTags = [...new Set(outfits.flatMap((o) => o.tags))];
  const filtered = filter === "all" ? outfits : outfits.filter((o) => o.tags.includes(filter));

  return (
    <div className="min-h-dvh pt-28 px-6 pb-20 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 text-white/30 hover:text-white/70 transition-colors duration-200 text-sm mb-6 cursor-pointer"
          style={{ fontFamily: "var(--font-ui)" }}
        >
          <ArrowLeftIcon size={14} />
          Start over
        </button>

        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p
              className="text-[10px] tracking-widest uppercase text-white/30 mb-2"
              style={{ fontFamily: "var(--font-ui)", letterSpacing: "0.14em" }}
            >
              Curated for you
            </p>
            <h2
              className="text-5xl md:text-6xl font-semibold leading-none"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Your{" "}
              <span className="italic bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent capitalize">
                {profile.style}
              </span>{" "}
              Looks
            </h2>
          </div>

          {/* Profile chip */}
          <div
            className="flex flex-wrap gap-2 text-xs"
            style={{ fontFamily: "var(--font-ui)" }}
          >
            {[
              profile.build,
              profile.height,
              `$${profile.budget} budget`,
            ].map((val) => (
              <span
                key={val}
                className="px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/50"
              >
                {val}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Filter pills */}
      {outfits.length > 0 && (
        <div className="flex gap-2 mb-8 flex-wrap">
          {["all", ...allTags].map((tag) => (
            <button
              key={tag}
              onClick={() => setFilter(tag)}
              className={`px-4 py-2 rounded-full text-xs font-medium tracking-wide transition-all duration-200 cursor-pointer ${
                filter === tag
                  ? "bg-violet-600 text-white shadow-[0_0_16px_rgba(124,58,237,0.35)]"
                  : "bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/20"
              }`}
              style={{ fontFamily: "var(--font-ui)", letterSpacing: "0.06em" }}
            >
              {tag === "all" ? "All" : tag}
            </button>
          ))}
        </div>
      )}

      {/* Results grid or empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="w-20 h-20 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-6">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <h3
            className="text-3xl font-semibold mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            No outfits found
          </h3>
          <p className="text-white/40 text-sm mb-8 max-w-xs" style={{ fontFamily: "var(--font-ui)", fontWeight: 300 }}>
            Try raising your budget or changing your style preference to see more looks.
          </p>
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white px-6 py-3.5 rounded-full text-sm font-semibold tracking-wide transition-all duration-200 hover:scale-[1.03] cursor-pointer"
            style={{ fontFamily: "var(--font-ui)", letterSpacing: "0.06em" }}
          >
            <RefreshIcon size={14} />
            Start Over
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {filtered.map((outfit) => (
            <OutfitCard
              key={outfit.id}
              outfit={outfit}
              onAddToCart={onAddToCart}
              inCart={cart.some((c) => c.id === outfit.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
