/**
 * Copyright 2026 Hybrid Mount Developers
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./Skeleton.css";

interface Props {
  width?: string;
  height?: string;
  borderRadius?: string;
  class?: string;
}

const WIDTH_CLASS_MAP: Record<string, string> = {
  "100%": "skeleton-w-100p",
  "80%": "skeleton-w-80p",
  "60%": "skeleton-w-60p",
  "50%": "skeleton-w-50p",
  "40%": "skeleton-w-40p",
  "180px": "skeleton-w-180",
  "120px": "skeleton-w-120",
  "100px": "skeleton-w-100",
  "60px": "skeleton-w-60",
  "40px": "skeleton-w-40",
};

const HEIGHT_CLASS_MAP: Record<string, string> = {
  "64px": "skeleton-h-64",
  "48px": "skeleton-h-48",
  "40px": "skeleton-h-40",
  "32px": "skeleton-h-32",
  "24px": "skeleton-h-24",
  "20px": "skeleton-h-20",
  "16px": "skeleton-h-16",
  "12px": "skeleton-h-12",
};

const RADIUS_CLASS_MAP: Record<string, string> = {
  "50%": "skeleton-r-50p",
  "16px": "skeleton-r-16",
  "12px": "skeleton-r-12",
};

export default function Skeleton(props: Props) {
  const widthClass = WIDTH_CLASS_MAP[props.width || "100%"] || "skeleton-w-100p";
  const heightClass = HEIGHT_CLASS_MAP[props.height || "20px"] || "skeleton-h-20";
  const radiusClass =
    RADIUS_CLASS_MAP[props.borderRadius || "12px"] || "skeleton-r-12";

  return (
    <div
      class={`skeleton ${widthClass} ${heightClass} ${radiusClass} ${props.class || ""}`}
    ></div>
  );
}
