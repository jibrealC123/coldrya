import { useRef, useState, useCallback } from "react";

export function useMagnetic(strength = 0.38) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const onMouseMove = useCallback(
    (e) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      setPos({ x: dx * strength, y: dy * strength });
    },
    [strength]
  );

  const onMouseLeave = useCallback(() => {
    setPos({ x: 0, y: 0 });
  }, []);

  return { ref, pos, onMouseMove, onMouseLeave };
}
