import * as React from "react";

export default function Logo({ size = 64, color = "#ef7d45" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="26" stroke={color} strokeWidth="4" />
      <path
        d="M20 22h16v-6l10 10-10 10v-6H20"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M44 42H28v6L18 38l10-10v6h16"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
