export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "ghostwatch-theme";

export function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

/** Apply theme class + color-scheme on <html> (client only). */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function resolveTheme(): Theme {
  return readStoredTheme() ?? getSystemTheme();
}

/** Inline script source — must stay in sync with applyTheme / resolveTheme. */
export const themeInitScript = `(function(){
  var key=${JSON.stringify(THEME_STORAGE_KEY)};
  var stored=localStorage.getItem(key);
  var prefersDark=window.matchMedia("(prefers-color-scheme: dark)").matches;
  var theme=(stored==="light"||stored==="dark")?stored:(prefersDark?"dark":"light");
  var root=document.documentElement;
  root.classList.toggle("dark",theme==="dark");
  root.style.colorScheme=theme;
})();`;
