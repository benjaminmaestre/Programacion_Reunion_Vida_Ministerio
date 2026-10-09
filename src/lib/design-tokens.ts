/**
 * Design tokens para componentes que necesiten consumir valores visuales desde TypeScript.
 * Los valores concretos viven en src/app/globals.css; así se evita duplicar la paleta.
 */
export const designTokens = {
  color: {
    background: "var(--color-bg)",
    surface: "var(--color-surface)",
    text: "var(--color-text)",
    textMuted: "var(--color-text-muted)",
    border: "var(--color-border)",
    primary: "var(--color-primary)",
    primaryHover: "var(--color-primary-hover)",
    success: "var(--color-success)",
    warning: "var(--color-warning)",
    danger: "var(--color-danger)",
  },
  radius: {
    small: "var(--radius-sm)",
    medium: "var(--radius-md)",
    large: "var(--radius-lg)",
    extraLarge: "var(--radius-xl)",
  },
  shadow: {
    card: "var(--shadow-card)",
    popover: "var(--shadow-popover)",
  },
  spacing: {
    1: "var(--space-1)",
    2: "var(--space-2)",
    3: "var(--space-3)",
    4: "var(--space-4)",
    5: "var(--space-5)",
    6: "var(--space-6)",
    8: "var(--space-8)",
  },
} as const;
