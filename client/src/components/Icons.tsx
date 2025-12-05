// src/components/Icons.tsx
import React from "react";

type IconProps = {
  className?: string;
};

export const CloseIcon: React.FC<IconProps> = ({ className }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M18.008 5.98751C18.2689 6.24834 18.2908 6.65769 18.0734 6.9433L18.0083 7.01795L13.0287 11.9991L18.0111 16.9815C18.2956 17.266 18.2956 17.7274 18.0111 18.0119C17.7503 18.2727 17.3409 18.2944 17.0553 18.0772L16.9807 18.0119L11.9983 13.0295L7.02008 18.0105C6.73562 18.2951 6.27421 18.2953 5.98968 18.0108C5.72885 17.75 5.70694 17.3406 5.92428 17.055L5.98947 16.9803L10.9679 11.9991L5.98838 7.01956C5.70383 6.73502 5.70385 6.27369 5.98838 5.98916C6.2492 5.72834 6.65858 5.70659 6.94419 5.92393L7.01877 5.98916L11.9983 10.9687L16.9777 5.98776C17.2621 5.70315 17.7235 5.70299 18.008 5.98751Z"
      fill="currentColor"
    />
  </svg>
);

export const BackIcon: React.FC<IconProps> = ({ className }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M14.75 5.75 8.5 12l6.25 6.25 1.25-1.25L11 12l5-5-1.25-1.25Z"
      fill="currentColor"
    />
  </svg>
);
