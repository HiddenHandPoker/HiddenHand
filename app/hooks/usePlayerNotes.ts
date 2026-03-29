"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "hh_player_notes";

function loadNotes(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveNotes(notes: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function usePlayerNotes() {
  const [notes, setNotes] = useState<Record<string, string>>(loadNotes);

  // Sync from localStorage on mount
  useEffect(() => {
    setNotes(loadNotes());
  }, []);

  const getNote = useCallback(
    (wallet: string) => notes[wallet] ?? "",
    [notes]
  );

  const setNote = useCallback(
    (wallet: string, text: string) => {
      setNotes((prev) => {
        const next = { ...prev };
        if (text.trim()) {
          next[wallet] = text.trim();
        } else {
          delete next[wallet];
        }
        saveNotes(next);
        return next;
      });
    },
    []
  );

  const hasNote = useCallback(
    (wallet: string) => !!notes[wallet],
    [notes]
  );

  return { getNote, setNote, hasNote };
}
