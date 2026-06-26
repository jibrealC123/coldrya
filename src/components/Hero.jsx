import { useState } from "react";
import { SparkleIcon, ChevronRightIcon, ExternalLinkIcon } from "./Icons";
import { outfitDatabase } from "../data/outfits";

/* ── Utility: all outfits flat, with a style label ─────────────────── */
const ALL_OUTFITS = [
  ...outfitDatabase.casual.male.map((o) => ({ ...o, styleTag: "casual" })),
  ...outfitDatabase.casual.female.map((o) => ({ ...o, styleTag: "casual" })),
  ...outfitDatabase.formal.male.map((o) => ({ ...o, styleTag: "formal" })),
  ...outfitDatabase.formal.female.map((o) => ({ ...o, styleTag: "formal" })),
  ...outfitDatabase.athletic.male.map((o) => ({ ...o, styleTag: "athletic" })),
  ...outfitDatabase.athletic.female.map((o) => ({ ...o, styleTag: "athletic" })),
];

/* ── Editorial tiles data ───────────────────────────────────────────── */
const TILES = [
  {
    label: "Casual",
    headline: "Everyday Essentials",
    sub: "from $14.99",
    image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=600&h=800&fit=crop",
    span: "col-span-1",
  },
  {
    label: "Formal",
    headline: "Power Dressing",
    sub: "from $69.99",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=800&fit=crop",
    span: "col-span-1",
  },
  {
    label: "Athletic",
    headline: "Move & Perform",
    sub: "from $35.00",
    image: "https://images.unsplash.com/photo-1483721310020-03333e577078?w=600&h=800&fit=crop",
    span: "col-span-1",
  },
  {
    label: "New In",
    headline: "Just Landed",
    sub: "fresh this week",
    image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&h=800&fit=crop",
    span: "col-span-1",
  },
];

/* ── Mini outfit card for the trending section ──────────────────────── */
function TrendCard({ outfit, onStart }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="group cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onStart}
    >
      {/* Image grid */}
      <div className="grid grid-cols-3 gap-0.5 rounded-xl overflow-hidden mb-3 bg-white/[0.04]">
        {outfit.items.map((item) => (
          <div key={item.type} className="aspect-square overflow-hidden bg-white/[0.05]">
            <img
              src={item.image}
              alt=""
              aria-hidden="true"
              loading="lazy"
              width="200"
              height="200"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => {
                e.currentTarget.src =
                  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&h=200&fit=crop";
              }}
            />
          </div>
        ))}
      </div>

      {/* Info */}
      <p
        className="text-[11px] text-white/35 uppercase tracking-widest mb-1"
        style={{ fontFamily: "var(--font-ui)", fontWeight: 500 }}
      >
        ColdRya
      </p>
      <p
        className="text-white text-[15px] leading-snug mb-1.5 group-hover:text-violet-300 transition-colors duration-200"
        style={{ fontFamily: "var(--font-ui)", fontWeight: 500 }}
      >
        {outfit.name}
      </p>
      <div className="flex items-center justify-between">
        <p
          className="text-white/70 text-[15px] font-semibold"
          style={{ fontFamily: "var(--font-ui)" }}
        >
          ${outfit.totalPrice.toFixed(2)}
        </p>
        <div className="flex gap-1.5 flex-wrap">
          {outfit.tags.slice(0, 2).map((t) => (
            <span
              key={t}
              className="text-[10px] bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded-full border border-violet-500/15"
              style={{ fontFamily: "var(--font-ui)" }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* CTA */}
      <button
        className="w-full mt-3 py-2.5 rounded-lg border border-white/[0.1] text-[12px] text-white/50 hover:text-white hover:border-white/30 hover:bg-white/[0.05] transition-all duration-200 cursor-pointer"
        style={{ fontFamily: "var(--font-ui)", fontWeight: 500, letterSpacing: "0.06em" }}
      >
        Get This Look
      </button>
    </div>
  );
}

/* ── Main Hero / Homepage component ────────────────────────────────── */
export default function Hero({ onStart }) {
  const [trendFilter, setTrendFilter] = useState("all");

  const filteredOutfits =
    trendFilter === "all"
      ? ALL_OUTFITS
      : ALL_OUTFITS.filter((o) => o.styleTag === trendFilter);

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════
          1. HERO BANNER
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-dvh overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&h=900&fit=crop"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/95 via-[#0a0a0a]/60 to-[#0a0a0a]/20" />
        </div>

        {/* Content — flex column, justify-center, pt clears fixed navbar */}
        <div className="relative z-10 flex flex-col justify-center min-h-dvh px-10 md:px-16 lg:px-24">
          <div className="max-w-lg pt-16">
            {/* Badge */}
            <div className="flex items-center gap-2 mb-7">
              <SparkleIcon size={11} className="text-violet-400" />
              <span
                className="text-[10px] text-violet-300/80 tracking-[0.22em] uppercase"
                style={{ fontFamily: "var(--font-ui)", fontWeight: 600 }}
              >
                AI-Curated Outfits
              </span>
            </div>

            {/* Headline — controlled size, tight leading */}
            <h1
              className="font-bold tracking-tight text-white mb-5"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2.2rem, 4vw, 3.4rem)",
                lineHeight: 1.05,
              }}
            >
              Find Your
              <br />
              <span
                style={{
                  fontStyle: "italic",
                  background: "linear-gradient(90deg, #a78bfa, #e879f9)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Perfect Style
              </span>
            </h1>

            {/* Subtitle */}
            <p
              className="text-white/45 mb-9"
              style={{
                fontFamily: "var(--font-ui)",
                fontWeight: 300,
                fontSize: "0.95rem",
                lineHeight: 1.7,
                maxWidth: "30ch",
              }}
            >
              Complete outfits from top brands, matched to your body type, style and budget.
            </p>

            {/* Buttons */}
            <div className="flex items-center gap-5">
              <button
                onClick={onStart}
                className="inline-flex items-center gap-2 bg-white text-[#0a0a0a] px-6 py-3 rounded-full font-semibold hover:bg-white/90 transition-all duration-200 cursor-pointer"
                style={{ fontFamily: "var(--font-ui)", fontSize: "0.82rem", letterSpacing: "0.05em" }}
              >
                Get My Style
                <ChevronRightIcon size={13} />
              </button>
              <button
                className="text-white/45 hover:text-white/80 transition-colors duration-200 cursor-pointer"
                style={{ fontFamily: "var(--font-ui)", fontSize: "0.82rem" }}
              >
                How it works
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          2. EDITORIAL TILES
      ══════════════════════════════════════════════════════════════ */}
      <section className="bg-[#0a0a0a] py-4">
        {/* Padding lives INSIDE the centered container — guarantees symmetric margins */}
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 clamp(16px, 3vw, 48px)" }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TILES.map((tile) => (
              <TileCard key={tile.label} tile={tile} onStart={onStart} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          3. TRENDING LOOKS
      ══════════════════════════════════════════════════════════════ */}
      <section className="bg-[#0d0d0d] py-16 md:py-20">
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 clamp(16px, 3vw, 48px)" }}>

          {/* Header — centered */}
          <div className="text-center mb-8">
            <h2
              className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold text-white leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Trending Looks
            </h2>
            <p
              className="text-white/35 text-[13px] mt-2"
              style={{ fontFamily: "var(--font-ui)", fontWeight: 300 }}
            >
              From the not-so basics to the latest curated styles — our top picks.
            </p>
          </div>

          {/* Filter tabs — centered */}
          <div className="flex gap-2 mb-8 flex-wrap justify-center">
            {["all", "casual", "formal", "athletic"].map((f) => (
              <button
                key={f}
                onClick={() => setTrendFilter(f)}
                className={`px-5 py-2 rounded-full text-[12px] font-medium transition-all duration-200 cursor-pointer capitalize ${
                  trendFilter === f
                    ? "bg-white text-[#0a0a0a]"
                    : "bg-white/[0.05] border border-white/[0.08] text-white/45 hover:text-white/70"
                }`}
                style={{ fontFamily: "var(--font-ui)", letterSpacing: "0.04em" }}
              >
                {f === "all" ? "New Arrivals" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Card grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredOutfits.slice(0, 8).map((outfit) => (
              <TrendCard key={outfit.id} outfit={outfit} onStart={onStart} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          4. QUIZ CTA BANNER
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-[#0a0a0a] py-20 md:py-28">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-violet-600/10 blur-[100px] rounded-full" />
        </div>
        <div className="relative text-center" style={{ maxWidth: "560px", margin: "0 auto", padding: "0 clamp(16px, 3vw, 32px)" }}>
          <p
            className="text-[10px] tracking-[0.22em] uppercase text-violet-400 mb-5"
            style={{ fontFamily: "var(--font-ui)", fontWeight: 600 }}
          >
            30 seconds to your look
          </p>
          <h2
            className="font-bold text-white leading-[1.0] tracking-tight mb-5"
            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 5vw, 3.6rem)", textAlign: "center" }}
          >
            Styled in <span className="italic">Seconds.</span>
          </h2>
          <p
            className="text-white/40 mb-10 leading-relaxed"
            style={{ fontFamily: "var(--font-ui)", fontWeight: 300, fontSize: "0.9rem", textAlign: "center" }}
          >
            Answer 4 quick questions — get a full outfit lineup matched to your body, budget, and taste.
          </p>
          <div className="flex justify-center">
            <button
              onClick={onStart}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white px-8 py-4 rounded-full text-[13px] font-semibold transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(124,58,237,0.45)] cursor-pointer"
              style={{ fontFamily: "var(--font-ui)", letterSpacing: "0.08em" }}
            >
              Take the Style Quiz
              <ChevronRightIcon size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          5. CONTACT  — BRIGHT BACKGROUND
      ══════════════════════════════════════════════════════════════ */}
      <section id="contact" className="bg-white py-20 md:py-28">
        <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "0 clamp(16px, 3vw, 48px)" }}>

          <p
            className="text-[10px] tracking-[0.22em] uppercase text-stone-400 mb-6"
            style={{ fontFamily: "var(--font-ui)", fontWeight: 600 }}
          >
            Get in touch
          </p>

          <div className="grid md:grid-cols-2 gap-14 items-start">
            {/* Left */}
            <div>
              <h2
                className="text-[clamp(2.5rem,6vw,4.5rem)] font-semibold text-stone-900 leading-[0.95] tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Let's talk
                <br />
                <span className="italic text-stone-400">style.</span>
              </h2>
              <p
                className="text-stone-500 text-[14px] leading-relaxed mt-6 max-w-xs"
                style={{ fontFamily: "var(--font-ui)", fontWeight: 300 }}
              >
                Partnerships, brand collaborations, or just want to say hello — reach out anytime.
              </p>
            </div>

            {/* Right — contact rows */}
            <div className="pt-1">
              {[
                { label: "Email", value: "hello@coldrya.co", href: "mailto:hello@coldrya.co" },
                { label: "Instagram", value: "@coldrya", href: "https://instagram.com" },
                { label: "Twitter / X", value: "@coldrya", href: "https://x.com" },
              ].map(({ label, value, href }) => (
                <ContactRow key={label} label={label} value={value} href={href} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          6. FOOTER
      ══════════════════════════════════════════════════════════════ */}
      <footer className="bg-[#0a0a0a] border-t border-white/[0.05] px-8 md:px-14 py-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <SparkleIcon size={13} className="text-violet-400/50" />
            <span
              className="text-white/30 text-sm"
              style={{ fontFamily: "var(--font-display)" }}
            >
              ColdRya
            </span>
          </div>

          <div className="flex items-center gap-8">
            {["Privacy Policy", "Terms", "Cookies"].map((item) => (
              <button
                key={item}
                className="text-[11px] text-white/20 hover:text-white/50 transition-colors duration-200 cursor-pointer"
                style={{ fontFamily: "var(--font-ui)", letterSpacing: "0.06em" }}
              >
                {item}
              </button>
            ))}
          </div>

          <p
            className="text-[10px] text-white/15 tracking-widest uppercase"
            style={{ fontFamily: "var(--font-ui)" }}
          >
            © {new Date().getFullYear()} ColdRya
          </p>
        </div>
      </footer>
    </>
  );
}

/* ── Sub-components kept in same file for locality ──────────────────── */

function TileCard({ tile, onStart }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onStart}
    >
      <img
        src={tile.image}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="w-full h-full object-cover transition-transform duration-700"
        style={{ transform: hovered ? "scale(1.06)" : "scale(1)" }}
        onError={(e) => {
          e.currentTarget.src =
            "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=800&fit=crop";
        }}
      />
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Text */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p
          className="text-[10px] tracking-[0.2em] uppercase text-white/50 mb-1"
          style={{ fontFamily: "var(--font-ui)", fontWeight: 500 }}
        >
          {tile.sub}
        </p>
        <p
          className="text-white font-semibold text-[1.1rem] leading-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {tile.headline}
        </p>
        <p
          className="mt-2 text-[11px] text-white/60 flex items-center gap-1 transition-all duration-300"
          style={{
            fontFamily: "var(--font-ui)",
            opacity: hovered ? 1 : 0,
            transform: hovered ? "translateY(0)" : "translateY(4px)",
          }}
        >
          Shop {tile.label} <ChevronRightIcon size={11} />
        </p>
      </div>

      {/* Thin top label */}
      <div className="absolute top-3 left-3">
        <span
          className="text-[9px] tracking-widest uppercase bg-white/15 backdrop-blur-sm text-white px-2 py-1 rounded-full"
          style={{ fontFamily: "var(--font-ui)", fontWeight: 600 }}
        >
          {tile.label}
        </span>
      </div>
    </div>
  );
}

function ContactRow({ label, value, href }) {
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noopener noreferrer"
      style={{ textDecoration: "none" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center justify-between py-5 border-b border-stone-200 group cursor-pointer">
        <span
          className="text-[10px] tracking-[0.18em] uppercase text-stone-400 group-hover:text-stone-600 transition-colors duration-200"
          style={{ fontFamily: "var(--font-ui)", fontWeight: 600 }}
        >
          {label}
        </span>
        <span
          className="text-stone-700 text-[1.1rem] flex items-center gap-2 transition-all duration-300"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 500,
            transform: hovered ? "translateX(6px)" : "translateX(0)",
            color: hovered ? "#7c3aed" : "#374151",
          }}
        >
          {value}
          <ExternalLinkIcon
            size={12}
            className="text-stone-400 group-hover:text-violet-500 transition-colors duration-200"
            style={{ opacity: hovered ? 1 : 0, transform: hovered ? "translateX(0)" : "translateX(-4px)", transition: "all 0.3s ease" }}
          />
        </span>
      </div>
    </a>
  );
}
