export default {
  ignoreFiles: [
    ".github",
    ".github/**",
    ".git",
    ".git/**",
    "docs",
    "docs/**",
    "scripts",
    "scripts/**",
    "web-ext-artifacts",
    "web-ext-artifacts/**",
    "dist",
    "dist/**",
    "*.md",
    ".gitignore",
    "web-ext-config.mjs",
  ],
  build: {
    overwriteDest: true,
  },
};
