import { useState } from "react";
import { MaleIcon, FemaleIcon, ShirtIcon, BriefcaseIcon, ActivityIcon, ChevronRightIcon, ArrowLeftIcon } from "./Icons";

const styleOptions = [
  { id: "casual", label: "Casual", desc: "Everyday relaxed looks", Icon: ShirtIcon },
  { id: "formal", label: "Formal", desc: "Office & business ready", Icon: BriefcaseIcon },
  { id: "athletic", label: "Athletic", desc: "Gym & sporty vibes", Icon: ActivityIcon },
];

const heights = ["Under 5'2\"", "5'2\" – 5'5\"", "5'6\" – 5'9\"", "5'10\" – 6'0\"", "Over 6'0\""];
const builds = ["Slim", "Athletic", "Average", "Curvy", "Plus Size"];

const stepLabels = ["Gender", "Body", "Style", "Budget"];

export default function StyleForm({ onSubmit }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    gender: "",
    height: "",
    build: "",
    style: "",
    budget: 200,
  });

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const canNext = () => {
    if (step === 1) return form.gender;
    if (step === 2) return form.height && form.build;
    if (step === 3) return form.style;
    return true;
  };

  const next = () => {
    if (step < 4) setStep((s) => s + 1);
    else onSubmit(form);
  };

  const SelectionCard = ({ selected, onClick, children, className = "" }) => (
    <button
      onClick={onClick}
      className={`relative p-5 rounded-2xl border text-left transition-all duration-200 cursor-pointer group ${
        selected
          ? "border-violet-500/60 bg-violet-500/10 shadow-[0_0_20px_rgba(124,58,237,0.15)]"
          : "border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
      } ${className}`}
    >
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
      {children}
    </button>
  );

  return (
    <div className="min-h-dvh flex items-center justify-center px-6 pt-24 pb-10">
      <div className="w-full max-w-lg">

        {/* Step indicator */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            {stepLabels.map((label, i) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1.5"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                    i + 1 < step
                      ? "bg-violet-600 text-white"
                      : i + 1 === step
                      ? "bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-[0_0_12px_rgba(124,58,237,0.5)]"
                      : "bg-white/[0.06] text-white/30"
                  }`}
                  style={{ fontFamily: "var(--font-ui)" }}
                >
                  {i + 1 < step ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-[10px] tracking-widest uppercase transition-colors ${
                    i + 1 === step ? "text-white/60" : "text-white/20"
                  }`}
                  style={{ fontFamily: "var(--font-ui)", letterSpacing: "0.1em" }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
          {/* Progress bar */}
          <div className="h-px bg-white/[0.06] rounded-full mt-2">
            <div
              className="h-px bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-500"
              style={{ width: `${((step - 1) / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 1: Gender */}
        {step === 1 && (
          <div>
            <h2
              className="text-4xl font-semibold mb-2 leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Who are we dressing?
            </h2>
            <p className="text-white/40 text-sm mb-8" style={{ fontFamily: "var(--font-ui)", fontWeight: 300 }}>
              Helps us match cuts, fits, and silhouettes
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: "male", label: "Male", Icon: MaleIcon },
                { id: "female", label: "Female", Icon: FemaleIcon },
              ].map(({ id, label, Icon }) => (
                <SelectionCard
                  key={id}
                  selected={form.gender === id}
                  onClick={() => update("gender", id)}
                >
                  <Icon size={40} className={`mb-4 transition-colors ${form.gender === id ? "text-violet-400" : "text-white/40"}`} />
                  <div
                    className="font-semibold text-base capitalize"
                    style={{ fontFamily: "var(--font-ui)" }}
                  >
                    {label}
                  </div>
                </SelectionCard>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Measurements */}
        {step === 2 && (
          <div>
            <h2
              className="text-4xl font-semibold mb-2 leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Your measurements
            </h2>
            <p className="text-white/40 text-sm mb-8" style={{ fontFamily: "var(--font-ui)", fontWeight: 300 }}>
              We'll suggest the most flattering proportions for you
            </p>

            <div className="mb-6">
              <label
                className="text-[10px] tracking-widest uppercase text-white/40 mb-3 block"
                style={{ fontFamily: "var(--font-ui)", letterSpacing: "0.12em" }}
              >
                Height
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {heights.map((h) => (
                  <SelectionCard
                    key={h}
                    selected={form.height === h}
                    onClick={() => update("height", h)}
                    className="py-3 px-4"
                  >
                    <span className="text-sm" style={{ fontFamily: "var(--font-ui)" }}>{h}</span>
                  </SelectionCard>
                ))}
              </div>
            </div>

            <div>
              <label
                className="text-[10px] tracking-widest uppercase text-white/40 mb-3 block"
                style={{ fontFamily: "var(--font-ui)", letterSpacing: "0.12em" }}
              >
                Build
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {builds.map((b) => (
                  <SelectionCard
                    key={b}
                    selected={form.build === b}
                    onClick={() => update("build", b)}
                    className="py-3 px-4"
                  >
                    <span className="text-sm" style={{ fontFamily: "var(--font-ui)" }}>{b}</span>
                  </SelectionCard>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Style */}
        {step === 3 && (
          <div>
            <h2
              className="text-4xl font-semibold mb-2 leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Pick your aesthetic
            </h2>
            <p className="text-white/40 text-sm mb-8" style={{ fontFamily: "var(--font-ui)", fontWeight: 300 }}>
              What kind of looks are you going for?
            </p>
            <div className="flex flex-col gap-3">
              {styleOptions.map(({ id, label, desc, Icon }) => (
                <SelectionCard
                  key={id}
                  selected={form.style === id}
                  onClick={() => update("style", id)}
                  className="flex items-center gap-5 py-5 px-5"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                    form.style === id ? "bg-violet-500/20" : "bg-white/[0.05]"
                  }`}>
                    <Icon size={24} className={form.style === id ? "text-violet-400" : "text-white/40"} />
                  </div>
                  <div>
                    <div className="font-semibold text-base" style={{ fontFamily: "var(--font-ui)" }}>{label}</div>
                    <div className="text-white/40 text-sm mt-0.5" style={{ fontFamily: "var(--font-ui)", fontWeight: 300 }}>{desc}</div>
                  </div>
                </SelectionCard>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Budget */}
        {step === 4 && (
          <div>
            <h2
              className="text-4xl font-semibold mb-2 leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Set your budget
            </h2>
            <p className="text-white/40 text-sm mb-8" style={{ fontFamily: "var(--font-ui)", fontWeight: 300 }}>
              We'll only show complete outfits within your range
            </p>

            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 mb-6">
              <div className="text-center mb-8">
                <span
                  className="text-7xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  ${form.budget}
                </span>
                <span className="text-white/30 text-sm ml-2 block mt-1" style={{ fontFamily: "var(--font-ui)" }}>max per outfit</span>
              </div>
              <input
                type="range"
                min={50}
                max={600}
                step={25}
                value={form.budget}
                onChange={(e) => update("budget", Number(e.target.value))}
                aria-label="Budget slider"
                className="w-full"
              />
              <div className="flex justify-between text-xs text-white/30 mt-3" style={{ fontFamily: "var(--font-ui)" }}>
                <span>$50</span>
                <span>$600</span>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <p
                className="text-[10px] tracking-widest uppercase text-white/30 mb-4"
                style={{ fontFamily: "var(--font-ui)", letterSpacing: "0.12em" }}
              >
                Your Profile
              </p>
              <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm" style={{ fontFamily: "var(--font-ui)" }}>
                {[
                  ["Gender", form.gender],
                  ["Height", form.height],
                  ["Build", form.build],
                  ["Style", form.style],
                ].map(([k, v]) => (
                  <div key={k} className="flex flex-col gap-0.5">
                    <span className="text-white/30 text-xs">{k}</span>
                    <span className="text-white/80 capitalize font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-10">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-2 px-5 py-4 rounded-full border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 transition-all duration-200 font-medium text-sm text-white/60 hover:text-white cursor-pointer"
              style={{ fontFamily: "var(--font-ui)" }}
            >
              <ArrowLeftIcon size={15} />
              Back
            </button>
          )}
          <button
            onClick={next}
            disabled={!canNext()}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 font-semibold text-sm tracking-widest uppercase transition-all duration-200 disabled:opacity-25 disabled:cursor-not-allowed hover:scale-[1.02] disabled:hover:scale-100 hover:shadow-[0_0_30px_rgba(124,58,237,0.4)] cursor-pointer"
            style={{ fontFamily: "var(--font-ui)", letterSpacing: "0.1em" }}
          >
            {step === 4 ? (
              <>Find My Outfits</>
            ) : (
              <>Continue <ChevronRightIcon size={15} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
