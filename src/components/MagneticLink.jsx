import { useState } from "react";
import { useMagnetic } from "../hooks/useMagnetic";

/**
 * Nav link with two premium effects:
 * 1. Magnetic pull — the element drifts toward the cursor
 * 2. Character wave — each letter lifts & tints on hover with a stagger
 */
export default function MagneticLink({ children, onClick, href, className = "", strength = 0.4, style: typographyStyle = {} }) {
  const { ref, pos, onMouseMove, onMouseLeave } = useMagnetic(strength);
  const [hovered, setHovered] = useState(false);

  const chars = String(children).split("");

  const handleEnter = () => setHovered(true);
  const handleLeave = () => {
    setHovered(false);
    onMouseLeave();
  };

  const inner = (
    <span
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={onClick}
      style={{
        display: "inline-block",
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: "transform 0.45s cubic-bezier(0.23, 1, 0.32, 1)",
        cursor: "pointer",
      }}
      className={className}
      aria-label={children}
    >
      {chars.map((char, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            ...typographyStyle,
            display: "inline-block",
            transform: hovered ? "translateY(-3px)" : "translateY(0px)",
            color: hovered ? "rgba(167,139,250,1)" : "rgba(255,255,255,0.5)",
            transition: `transform 0.35s cubic-bezier(0.23,1,0.32,1), color 0.35s ease`,
            transitionDelay: `${i * 28}ms`,
          }}
        >
          {char === " " ? " " : char}
        </span>
      ))}

      {/* Underline sweep */}
      <span
        style={{
          display: "block",
          height: "1px",
          background: "rgba(139,92,246,0.7)",
          transformOrigin: "left center",
          transform: hovered ? "scaleX(1)" : "scaleX(0)",
          transition: "transform 0.4s cubic-bezier(0.23,1,0.32,1)",
          marginTop: "1px",
        }}
      />
    </span>
  );

  if (href) {
    return (
      <a href={href} style={{ textDecoration: "none" }}>
        {inner}
      </a>
    );
  }
  return inner;
}
