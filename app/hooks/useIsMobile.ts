"use client";

import { useState, useEffect } from "react";

/** True when viewport is mobile-landscape (short height + landscape orientation) */
export function useIsMobileLandscape(): boolean {
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);

  useEffect(() => {
    const check = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      const isShort = window.innerHeight <= 500;
      setIsMobileLandscape(isLandscape && isShort);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isMobileLandscape;
}

/** True when viewport width <= 768px (any orientation) */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isMobile;
}

/** True when device has coarse pointer (touchscreen) */
export function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch(window.matchMedia("(hover: none) and (pointer: coarse)").matches);
  }, []);

  return isTouch;
}

/** True when viewport is portrait and mobile-sized */
export function useIsMobilePortrait(): boolean {
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);

  useEffect(() => {
    const check = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      const isMobileWidth = window.innerWidth <= 768;
      setIsMobilePortrait(isPortrait && isMobileWidth);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isMobilePortrait;
}
