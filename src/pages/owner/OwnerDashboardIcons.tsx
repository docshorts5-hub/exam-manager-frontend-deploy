import React from "react";

type IconProps = {
  className?: string;
};

export function AdministrationIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 96 96"
      role="img"
      aria-label="الإدارة الرئيسية"
      focusable="false"
    >
      <path
        d="M18 35 48 18l30 17H18Z"
        fill="currentColor"
        opacity="0.96"
      />
      <path
        d="M22 39h52v8H22zM20 71h56v8H20zM15 81h66v7H15z"
        fill="currentColor"
      />
      <path
        d="M29 47h9v24h-9zm15 0h9v24h-9zm15 0h9v24h-9z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M24 35h48"
        fill="none"
        stroke="rgba(255,255,255,.62)"
        strokeWidth="2"
      />
    </svg>
  );
}

export function SecurityIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 96 96"
      role="img"
      aria-label="الأمن والرقابة"
      focusable="false"
    >
      <path
        d="M48 10c10 8 20 12 31 14v22c0 20-11 33-31 42C28 79 17 66 17 46V24c11-2 21-6 31-14Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <rect
        x="35"
        y="45"
        width="26"
        height="23"
        rx="5"
        fill="currentColor"
      />
      <path
        d="M40 45v-7c0-6 3-11 8-11s8 5 8 11v7"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="48" cy="56" r="3.5" fill="white" />
      <path d="M48 59v5" stroke="white" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function OperationsIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 96 96"
      role="img"
      aria-label="النظام والتطوير"
      focusable="false"
    >
      <path
        d="m48 10 5 9 10 1 2 10 9 5-4 10 4 10-9 5-2 10-10 1-5 9-9-5-10 4-6-8-10-2-1-10-8-6 5-9-3-10 9-5 3-10 10-1 6-8 10 4 9-5Z"
        fill="currentColor"
        opacity="0.96"
      />
      <circle cx="48" cy="45" r="18" fill="white" opacity="0.96" />
      <path
        d="M34 58V48h7v10h-7Zm11 0V40h7v18h-7Zm11 0V33h7v25h-7Z"
        fill="currentColor"
      />
      <path
        d="m31 43 11-8 8 4 13-12"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m58 27 7-2-2 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}