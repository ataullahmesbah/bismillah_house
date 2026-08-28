"use client";

import { useEffect, useRef, useState } from "react";

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Campaign countdown.
 *
 * Display only — the checkout price is always recalculated on the server, so a
 * tampered clock in the browser cannot extend an expired offer.
 *
 * The remaining time deliberately starts as `null`. Reading the clock while
 * rendering would give the server one second and the browser another, and
 * React would reject the mismatch on hydration; instead both render the same
 * placeholder and the real value appears once the timer is mounted.
 */
export function Countdown({
  endsAt,
  label,
  compact = false,
  onExpire,
}: {
  endsAt: string;
  label?: string;
  compact?: boolean;
  onExpire?: () => void;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);

  // Held in a ref so an inline callback from the parent does not restart the
  // interval on every render.
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const target = new Date(endsAt).getTime();
    let expired = false;

    const tick = () => {
      const next = Math.max(0, target - Date.now());
      setRemaining(next);
      if (next === 0 && !expired) {
        expired = true;
        onExpireRef.current?.();
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  if (remaining === null) {
    // Same markup on both sides of hydration, sized so nothing shifts.
    return compact ? (
      <span className="mono font-semibold tabular-nums text-danger-600" aria-hidden="true">
        --:--:--
      </span>
    ) : (
      <CountdownBoxes label={label} parts={[["Hrs", null], ["Min", null], ["Sec", null]]} />
    );
  }

  if (remaining <= 0) {
    return <span className="badge-gray">Ended</span>;
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (compact) {
    return (
      <span className="mono font-semibold tabular-nums text-danger-600">
        {days > 0 ? `${days}d ` : ""}
        {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>
    );
  }

  const parts: Array<[string, number]> = days > 0
    ? [["Days", days], ["Hrs", hours], ["Min", minutes], ["Sec", seconds]]
    : [["Hrs", hours], ["Min", minutes], ["Sec", seconds]];

  return <CountdownBoxes label={label} parts={parts} />;
}

function CountdownBoxes({
  label,
  parts,
}: {
  label?: string;
  parts: Array<[string, number | null]>;
}) {
  return (
    <div className="flex items-center gap-2">
      {label ? <span className="text-xs font-semibold uppercase tracking-wide text-brand-500">{label}</span> : null}
      <div className="flex items-center gap-1.5">
        {parts.map(([unit, value]) => (
          <div
            key={unit}
            className="flex min-w-11 flex-col items-center rounded-[var(--radius-tm)] bg-brand-900 px-2 py-1 text-white"
          >
            <span className="text-sm font-bold tabular-nums leading-none">
              {value === null ? "--" : pad(value)}
            </span>
            <span className="mt-0.5 text-[0.5625rem] uppercase tracking-wide text-brand-300">{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
