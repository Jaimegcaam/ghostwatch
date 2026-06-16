import { themeInitScript } from "@/lib/theme";

/** Runs before paint to avoid a flash of the wrong theme. */
export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: themeInitScript }}
      suppressHydrationWarning
    />
  );
}
