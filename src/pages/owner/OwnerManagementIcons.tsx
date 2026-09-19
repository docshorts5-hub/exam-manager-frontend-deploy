import React from "react";

type IconProps = {
  className?: string;
};

function BaseIcon({
  className,
  children,
  label,
}: {
  className?: string;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 96 96"
      role="img"
      aria-label={label}
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function GovernoratesIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className} label="المحافظات">
      <path
        d="M15 69c10-4 17-11 23-20 6-9 13-18 25-22 7-2 13-1 18 2-5 5-8 11-8 18 0 9 4 16 10 23-14 7-28 10-42 8-9-1-18-4-26-9Z"
        fill="currentColor"
        opacity="0.92"
      />
      <circle cx="62" cy="29" r="9" fill="none" stroke="currentColor" strokeWidth="5" />
      <path d="M62 38v17" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <circle cx="62" cy="29" r="3" fill="white" />
    </BaseIcon>
  );
}

export function SchoolsIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className} label="المدارس">
      <path d="M19 41 48 23l29 18H19Z" fill="currentColor" opacity="0.96" />
      <rect x="23" y="40" width="50" height="34" rx="3" fill="currentColor" />
      <rect x="43" y="54" width="10" height="20" fill="white" opacity="0.95" />
      <rect x="30" y="50" width="7" height="8" fill="white" opacity="0.9" />
      <rect x="59" y="50" width="7" height="8" fill="white" opacity="0.9" />
      <path d="M48 23V13m0 0 13 5-13 5" fill="none" stroke="currentColor" strokeWidth="4" />
    </BaseIcon>
  );
}

export function DiplomaCentersIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className} label="مراكز الدبلوم">
      <path d="M18 44 48 28l30 16H18Z" fill="currentColor" />
      <rect x="22" y="43" width="52" height="32" rx="3" fill="currentColor" opacity="0.92" />
      <rect x="43" y="56" width="10" height="19" fill="white" />
      <path d="m31 23 17-9 17 9-17 9-17-9Z" fill="currentColor" />
      <path d="M65 23v11" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </BaseIcon>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className} label="المستخدمون">
      <circle cx="35" cy="36" r="12" fill="currentColor" />
      <circle cx="61" cy="36" r="12" fill="currentColor" opacity="0.82" />
      <path d="M16 72c1-14 9-22 19-22s18 8 19 22H16Z" fill="currentColor" />
      <path d="M46 72c1-14 7-22 15-22s15 8 18 22H46Z" fill="currentColor" opacity="0.82" />
    </BaseIcon>
  );
}

export function GovernorateSupersIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className} label="مشرفو المحافظات">
      <circle cx="48" cy="31" r="14" fill="currentColor" />
      <path d="M24 75c2-18 11-28 24-28s22 10 24 28H24Z" fill="currentColor" />
      <circle cx="70" cy="61" r="12" fill="white" opacity="0.96" />
      <path d="m64 61 4 4 8-9" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </BaseIcon>
  );
}

export function ExamSupersIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className} label="مشرفو امتحانات الدبلوم">
      <circle cx="35" cy="31" r="12" fill="currentColor" />
      <path d="M17 70c2-16 9-25 18-25s16 9 18 25H17Z" fill="currentColor" />
      <rect x="52" y="34" width="27" height="38" rx="5" fill="currentColor" opacity="0.9" />
      <rect x="59" y="30" width="13" height="8" rx="3" fill="currentColor" />
      <path d="M59 47h13M59 56h13M59 65h9" stroke="white" strokeWidth="3" strokeLinecap="round" />
    </BaseIcon>
  );
}