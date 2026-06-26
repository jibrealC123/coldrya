import { useState } from "react";
import { SparkleIcon, ChevronRightIcon, ExternalLinkIcon } from "./Icons";
import { outfitDatabase } from "../data/outfits";

/* ── Utility: all outfits flat ───────────────────────────────────────── */
const ALL_OUTFITS = [
  ...outfitDatabase.casual.male.map((o) => ({ ...o, styleTag: "casual" })),
  ...outfitDatabase.casual.female.map((o) => ({ ...o, styleTag: "casual" })),
  ...outfitDatabase.formal.male.map((o) => ({ ...o, styleTag: "formal" })),
  ...outfitDatabase.formal.female.map((o) => ({ ...o, styleTag: "formal" })),
  ...outfitDatabase.athletic.male.map((o) => ({ ...o, styleTag: "athletic" })),
  ...outfitDatabase.athletic.female.map((o) => ({ ...o, styleTag: "athletic" })),
];

/* ── Category tiles data ─────────────────────────────────────────────── */
const TILES = [
  {
    label: "Casual",
    headline: "Everyday Essentials",
    sub: "from $14.99",
    image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=600&h=800&fit=crop",
  },
  {
    label: "Formal",
    headline: "Power Dressing",
    sub: "from $69.99",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=800&fit=crop",
  },
  {
    label: "Athletic",
    headline: "Move & Perform",
    sub: "from $35.00",
    image: "https://images.unsplash.com/photo-1483721310020-03333e577078?w=600&h=800&fit=crop",
  },
  {
    label: "New In",
    headline: "Just Landed",
    sub: "fresh this week",
    image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&h=800&fit=crop",
  },
];

/* ── Category tile ───────────────────────────────────────────────────── */
function TileCard({ tile, onStart }) {
  return (
    <div className="group relative overflow-hidden cursor-pointer aspect-[3/4]" onClick={onStart}>
      <img
        src={tile.image}
        alt=""
        aria-hidden="true"
        className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700"
        onError={(e) => {
          e.currentTarget.src =
            "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=533&fit=crop";
        }}
      />
      <div className="absolute inset-0 bg-black/25 group-hover:bg-black/35 transition-colors duration-300" />
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <p
          className="text-white/60 text-[10px] tracking-[0.2em] uppercase mb-1"
          style={{ fontFamily: "var(--font-ui)", fontWeight: 500 }}
        >
          {tile.sub}
        </p>
        <p
          className="text-white text-lg font-semibold leading-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {tile.headline}
        </p>
      </div>
    </div>
  );
}

/* ── Trending card — single tall editorial image ─────────────────────── */
function TrendCard({ outfit, onStart }) {
  return (
    <div className="group cursor-pointer" onClick={onStart}>
      <div className="aspect-[3/4] overflow-hidden bg-stone-100 mb-4">
        <img
          src={outfit.items[0]?.image}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700"
          onError={(e) => {
            e.currentTarget.src =
              "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=533&fit=crop";
          }}
        />
      </div>
      <p
        className="text-[10px] tracking-[0.2em] uppercase text-stone-400 mb-1"
        style={{ fontFamily: "var(--font-ui)", fontWeight: 500 }}
      >
        {outfit.tags[0] || "ColdRya"}
      </p>
      <p
        className="text-stone-900 text-[15px] leading-snug mb-1"
        style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
      >
        {outfit.name}
      </p>
      <p
        className="text-stone-500 text-[13px]"
        style={{ fontFamily: "var(--font-ui)", fontWeight: 300 }}
      >
        From ${outfit.totalPrice.toFixed(2)}
      </p>
    </div>
  );
}

/* ── Contact row ─────────────────────────────────────────────────────── */
function ContactRow({ label, value, href }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="flex items-center justify-between py-5 border-b border-stone-200 group"
    >
      <span
        className="text-[11px] tracking-[0.15em] uppercase text-stone-400"
        style={{ fontFamily: "var(--font-ui)", fontWeight: 500 }}
      >
        {label}
      </span>
      <div className="flex items-center gap-2 text-stone-900 group-hover:text-stone-400 transition-colors duration-200">
        <span className="text-[14px]" style={{ fontFamily: "var(--font-ui)", fontWeight: 400 }}>
          {value}
        </span>
        <ExternalLinkIcon size={11} className="text-stone-400" />
      </div>
    </a>
  );
}

/* ── Main Hero / Homepage component ─────────────────────────────────── */
export default function Hero({ onStart }) {
  const [trendFilter, setTrendFilter] = useState("all");

  const filteredOutfits =
    trendFilter === "all"
      ? ALL_OUTFITS
      : ALL_OUTFITS.filter((o) => o.styleTag === trendFilter);

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════
          1. HERO — split: text left / editorial photo right
      ══════════════════════════════════════════════════════════════ */}
      <section className="min-h-dvh bg-white grid md:grid-cols-2">
        {/* Left — text */}
        <div className="flex flex-col justify-end pb-16 px-10 md:px-16 lg:px-20 pt-32">
          <p
            className="text-[10px] tracking-[0.28em] uppercase text-stone-400 mb-8"
            style={{ fontFamily: "var(--font-ui)", fontWeight: 500 }}
          >
            AI-Curated Outfits
          </p>
          <h1
            className="text-stone-900 leading-[1.0] tracking-tight mb-8"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(3rem, 6vw, 5.5rem)",
              fontWeight: 400,
            }}
          >
            Dressed
            <br />
            <span style={{ fontStyle: "italic" }}>for you.</span>
          </h1>
          <p
            className="text-stone-500 mb-10 leading-relaxed"
            style={{
              fontFamily: "var(--font-ui)",
              fontWeight: 300,
              fontSize: "0.95rem",
              maxWidth: "32ch",
            }}
          >
            Complete outfits from real brands — matched to your body, your taste, your budget.
          </p>
          <div className="flex items-center gap-7">
            <button
              onClick={onStart}
              className="inline-flex items-center gap-3 bg-stone-900 text-white px-7 py-3.5 text-[12px] tracking-[0.1em] uppercase hover:bg-stone-700 transition-colors duration-200 cursor-pointer"
              style={{ fontFamily: "var(--font-ui)", fontWeight: 500 }}
            >
              Find My Style
              <ChevronRightIcon size={13} />
            </button>
            <button
              className="text-[12px] tracking-[0.08em] uppercase text-stone-400 hover:text-stone-700 transition-colors duration-200 cursor-pointer underline underline-offset-4 decoration-stone-200"
              style={{ fontFamily: "var(--font-ui)", fontWeight: 400 }}
            >
              How it works
            </button>
          </div>
        </div>

        {/* Right — fashion editorial photo */}
        <div className="relative h-[55vh] md:h-auto overflow-hidden bg-stone-100">
          <img
            src="https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&h=1200&fit=crop"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover object-top"
            onError={(e) => {
              e.currentTarget.src =
                "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&h=1200&fit=crop";
            }}
          />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          2. CATEGORY GRID
      ══════════════════════════════════════════════════════════════ */}
      <section className="bg-white py-2 pb-16">
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 clamp(16px, 3vw, 48px)" }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {TILES.map((tile) => (
              <TileCard key={tile.label} tile={tile} onStart={onStart} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          3. EDITORIAL FEATURE — large image + how it works
      ══════════════════════════════════════════════════════════════ */}
      <section className="bg-stone-50 py-20 md:py-28">
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 clamp(16px, 3vw, 48px)" }}>
          <div className="grid md:grid-cols-[3fr_2fr] gap-10 items-center">

            {/* Image */}
            <div className="aspect-[4/3] overflow-hidden bg-stone-200">
              <img
                src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&h=675&fit=crop"
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src =
                    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=900&h=675&fit=crop";
                }}
              />
            </div>

            {/* Text */}
            <div>
              <p
                className="text-[10px] tracking-[0.25em] uppercase text-stone-400 mb-6"
                style={{ fontFamily: "var(--font-ui)", fontWeight: 500 }}
              >
                How it works
              </p>
              <h2
                className="text-stone-900 leading-[1.05] tracking-tight mb-8"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.8rem, 3.5vw, 3rem)",
                  fontWeight: 400,
                }}
              >
                Tell us about yourself.
                <br />
                <span style={{ fontStyle: "italic" }}>We handle the rest.</span>
              </h2>

              <div className="space-y-0">
                {[
                  { n: "01", t: "Your profile", d: "Gender, measurements, and build — 30 seconds." },
                  { n: "02", t: "Your style", d: "Casual, formal, athletic — or any mix." },
                  { n: "03", t: "Your budget", d: "We find real items priced within your range." },
                ].map(({ n, t, d }) => (
                  <div key={n} className="flex gap-5 items-start border-t border-stone-200 py-5">
                    <span
                      className="text-[11px] text-stone-300 tabular-nums mt-0.5 flex-shrink-0"
                      style={{ fontFamily: "var(--font-ui)", fontWeight: 400 }}
                    >
                      {n}
                    </span>
                    <div>
                      <p
                        className="text-stone-900 text-[14px] mb-1"
                        style={{ fontFamily: "var(--font-ui)", fontWeight: 600 }}
                      >
                        {t}
                      </p>
                      <p
                        className="text-stone-500 text-[13px] leading-relaxed"
                        style={{ fontFamily: "var(--font-ui)", fontWeight: 300 }}
                      >
                        {d}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={onStart}
                className="mt-8 inline-flex items-center gap-3 bg-stone-900 text-white px-7 py-3.5 text-[12px] tracking-[0.1em] uppercase hover:bg-stone-700 transition-colors duration-200 cursor-pointer"
                style={{ fontFamily: "var(--font-ui)", fontWeight: 500 }}
              >
                Start Now
                <ChevronRightIcon size={13} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          4. NEW ARRIVALS GRID
      ══════════════════════════════════════════════════════════════ */}
      <section className="bg-white py-20 md:py-28">
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 clamp(16px, 3vw, 48px)" }}>

          {/* Header + filters */}
          <div className="flex items-end justify-between border-b border-stone-200 pb-6 mb-10 flex-wrap gap-4">
            <h2
              className="text-stone-900 leading-tight"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.8rem, 3vw, 2.6rem)",
                fontWeight: 400,
              }}
            >
              New Arrivals
            </h2>
            <div className="flex gap-6">
              {["all", "casual", "formal", "athletic"].map((f) => (
                <button
                  key={f}
                  onClick={() => setTrendFilter(f)}
                  className={`text-[11px] tracking-[0.12em] uppercase pb-1 transition-all duration-200 cursor-pointer capitalize border-b ${
                    trendFilter === f
                      ? "text-stone-900 border-stone-900"
                      : "text-stone-400 border-transparent hover:text-stone-600"
                  }`}
                  style={{ fontFamily: "var(--font-ui)", fontWeight: 500 }}
                >
                  {f === "all" ? "All" : f}
                </button>
              ))}
            </div>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
            {filteredOutfits.slice(0, 8).map((outfit) => (
              <TrendCard key={outfit.id} outfit={outfit} onStart={onStart} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          5. QUIZ CTA — solid black band
      ══════════════════════════════════════════════════════════════ */}
      <section className="bg-stone-900 py-24 md:py-32">
        <div
          className="text-center"
          style={{ maxWidth: "640px", margin: "0 auto", padding: "0 clamp(16px, 3vw, 32px)" }}
        >
          <p
            className="text-[10px] tracking-[0.28em] uppercase text-stone-500 mb-6"
            style={{ fontFamily: "var(--font-ui)", fontWeight: 500 }}
          >
            30 seconds
          </p>
          <h2
            className="text-white leading-[1.05] tracking-tight mb-6"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.5rem, 5vw, 4rem)",
              fontWeight: 400,
            }}
          >
            Your perfect outfit
            <br />
            <span style={{ fontStyle: "italic" }}>starts here.</span>
          </h2>
          <p
            className="text-stone-400 mb-12 leading-relaxed"
            style={{ fontFamily: "var(--font-ui)", fontWeight: 300, fontSize: "0.9rem" }}
          >
            Answer 4 questions. Get a full outfit from real brands, sized and priced for you.
          </p>
          <button
            onClick={onStart}
            className="inline-flex items-center gap-3 border border-white/40 text-white px-8 py-4 text-[12px] tracking-[0.12em] uppercase hover:bg-white hover:text-stone-900 transition-all duration-300 cursor-pointer"
            style={{ fontFamily: "var(--font-ui)", fontWeight: 500 }}
          >
            Take the Style Quiz
            <ChevronRightIcon size={13} />
          </button>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          6. CONTACT
      ══════════════════════════════════════════════════════════════ */}
      <section id="contact" className="bg-white py-20 md:py-28">
        <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "0 clamp(16px, 3vw, 48px)" }}>
          <p
            className="text-[10px] tracking-[0.22em] uppercase text-stone-400 mb-6"
            style={{ fontFamily: "var(--font-ui)", fontWeight: 500 }}
          >
            Get in touch
          </p>
          <div className="grid md:grid-cols-2 gap-14 items-start">
            <div>
              <h2
                className="text-stone-900 leading-[0.95] tracking-tight"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                  fontWeight: 400,
                }}
              >
                Let's talk
                <br />
                <span style={{ fontStyle: "italic", color: "#a8a29e" }}>style.</span>
              </h2>
              <p
                className="text-stone-500 text-[14px] leading-relaxed mt-6 max-w-xs"
                style={{ fontFamily: "var(--font-ui)", fontWeight: 300 }}
              >
                Partnerships, brand collaborations, or just want to say hello.
              </p>
            </div>
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
          7. FOOTER
      ══════════════════════════════════════════════════════════════ */}
      <footer className="bg-stone-900 px-8 md:px-14 py-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <SparkleIcon size={13} className="text-stone-500" />
            <span
              className="text-stone-400 text-sm"
              style={{ fontFamily: "var(--font-display)" }}
            >
              ColdRya
            </span>
          </div>
          <div className="flex items-center gap-8">
            {["Privacy Policy", "Terms", "Cookies"].map((item) => (
              <button
                key={item}
                className="text-[11px] text-stone-500 hover:text-stone-300 transition-colors duration-200 cursor-pointer"
                style={{ fontFamily: "var(--font-ui)", letterSpacing: "0.06em" }}
              >
                {item}
              </button>
            ))}
          </div>
          <p
            className="text-[10px] text-stone-600 tracking-widest uppercase"
            style={{ fontFamily: "var(--font-ui)" }}
          >
            © {new Date().getFullYear()} ColdRya
          </p>
        </div>
      </footer>
    </>
  );
}
