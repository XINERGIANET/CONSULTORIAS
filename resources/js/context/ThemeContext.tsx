import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ApexThemeMode = "dark" | "light";

export type ColorPalette = {
  id: string;
  name: string;
  primary: string;
  primaryHover: string;
  lightBg: string;
  darkBgDim: string;
  textLight: string;
  textDark: string;
  ringColor: string;
};

export const PALETTES: ColorPalette[] = [
  {
    id: "blue",
    name: "Azul Apex",
    primary: "#007BFF",
    primaryHover: "#0063D5",
    lightBg: "#EFF6FF",
    darkBgDim: "#0a2744",
    textLight: "#007BFF",
    textDark: "#7AB8FF",
    ringColor: "rgba(0, 123, 255, 0.4)",
  },
  {
    id: "purple",
    name: "Púrpura Neón",
    primary: "#8B5CF6",
    primaryHover: "#7C3AED",
    lightBg: "#F5F3FF",
    darkBgDim: "#2E1065",
    textLight: "#8B5CF6",
    textDark: "#C4B5FD",
    ringColor: "rgba(139, 92, 246, 0.4)",
  },
  {
    id: "emerald",
    name: "Esmeralda",
    primary: "#10B981",
    primaryHover: "#059669",
    lightBg: "#ECFDF5",
    darkBgDim: "#064E3B",
    textLight: "#10B981",
    textDark: "#6EE7B7",
    ringColor: "rgba(16, 185, 129, 0.4)",
  },
  {
    id: "rose",
    name: "Rosa Magenta",
    primary: "#EC4899",
    primaryHover: "#DB2777",
    lightBg: "#FDF2F8",
    darkBgDim: "#831843",
    textLight: "#EC4899",
    textDark: "#F472B6",
    ringColor: "rgba(236, 72, 153, 0.4)",
  },
  {
    id: "orange",
    name: "Naranja Ámbar",
    primary: "#F97316",
    primaryHover: "#EA580C",
    lightBg: "#FFF7ED",
    darkBgDim: "#7C2D12",
    textLight: "#F97316",
    textDark: "#FB923C",
    ringColor: "rgba(249, 115, 22, 0.4)",
  },
  {
    id: "cyan",
    name: "Cian Eléctrico",
    primary: "#06B6D4",
    primaryHover: "#0891B2",
    lightBg: "#ECFEFF",
    darkBgDim: "#164E63",
    textLight: "#06B6D4",
    textDark: "#67E8F9",
    ringColor: "rgba(6, 182, 212, 0.4)",
  },
  {
    id: "indigo",
    name: "Índigo",
    primary: "#6366F1",
    primaryHover: "#4F46E5",
    lightBg: "#EEF2FF",
    darkBgDim: "#1E1B4B",
    textLight: "#6366F1",
    textDark: "#A5B4FC",
    ringColor: "rgba(99, 102, 241, 0.4)",
  },
  {
    id: "red",
    name: "Rojo Rubí",
    primary: "#EF4444",
    primaryHover: "#DC2626",
    lightBg: "#FEF2F2",
    darkBgDim: "#7F1D1D",
    textLight: "#EF4444",
    textDark: "#FCA5A5",
    ringColor: "rgba(239, 68, 68, 0.4)",
  },
];

type ApexThemeContextValue = {
  mode: ApexThemeMode;
  setMode: React.Dispatch<React.SetStateAction<ApexThemeMode>>;
  isLight: boolean;
  paletteId: string;
  setPaletteId: (id: string) => void;
  palette: ColorPalette;
  palettes: ColorPalette[];
};

const ApexThemeContext = createContext<ApexThemeContextValue | null>(null);

export function ApexThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ApexThemeMode>(() => {
    return (localStorage.getItem("apex-theme-mode") as ApexThemeMode) || "dark";
  });

  const [paletteId, setPaletteIdState] = useState<string>(() => {
    return localStorage.getItem("apex-palette-id") || "blue";
  });

  const setMode: React.Dispatch<React.SetStateAction<ApexThemeMode>> = (value) => {
    setModeState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      localStorage.setItem("apex-theme-mode", next);
      return next;
    });
  };

  const setPaletteId = (id: string) => {
    setPaletteIdState(id);
    localStorage.setItem("apex-palette-id", id);
  };

  const isLight = mode === "light";
  const palette = PALETTES.find((p) => p.id === paletteId) || PALETTES[0];

  useEffect(() => {
    document.documentElement.setAttribute("data-apex-theme", mode);
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--color-apex-neon", palette.primary);
    root.style.setProperty("--color-apex-neon-dim", palette.darkBgDim);
    root.style.setProperty("--color-apex-light-primary", palette.primary);
    root.style.setProperty("--primary-color", palette.primary);
    root.style.setProperty("--primary-hover", palette.primaryHover);
    root.style.setProperty("--primary-light-bg", palette.lightBg);
    root.style.setProperty("--primary-dark-dim", palette.darkBgDim);
    root.style.setProperty("--primary-text-dark", palette.textDark);
    root.style.setProperty("--primary-ring", palette.ringColor);
  }, [palette]);

  return (
    <ApexThemeContext.Provider value={{ mode, setMode, isLight, paletteId, setPaletteId, palette, palettes: PALETTES }}>
      {children}
    </ApexThemeContext.Provider>
  );
}

export function useApexTheme() {
  const ctx = useContext(ApexThemeContext);
  if (!ctx) {
    throw new Error("useApexTheme debe usarse dentro de ApexThemeProvider");
  }
  return ctx;
}

