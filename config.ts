// Central branding/config for Ghostwatch.
// Change these values to white-label your own instance.

export const config = {
  app: {
    name: "Ghostwatch",
    description: "Open-source, self-hosted uptime monitoring with public status pages.",
    tagline: "Self-hosted uptime monitoring.",
    url: "https://ghostwatch.example.com",
  },
  branding: {
    primary: "#4f46e5", // Indigo
    dark: "#0f1117",
    logo: "/ghostwatch-icon.svg",
  },
  social: {
    github: "https://github.com/jaimegcaam/ghostwatch",
  },
  license: "MIT",
  version: "0.3.0",
} as const;
