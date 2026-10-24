export default defineAppConfig({
  ui: {
    colors: {
      primary: "grass",
      success: "grass",
      neutral: "stone"
    },
    // Weiße Schrift auf grünen Knöpfen wie auf minecraft.net
    button: {
      compoundVariants: [{ color: "primary", variant: "solid", class: "text-white" }]
    },
    // Toast als Steinblock mit Pixel-Titel, das Symbol sitzt in einem farbigen Block (Avatar).
    toast: {
      slots: {
        root: "mc-toast relative group overflow-hidden bg-muted rounded-[2px] border-l-4 p-3 flex gap-3",
        title: "font-pixel text-base font-semibold text-highlighted",
        description: "text-sm text-muted",
        avatar: "mc-toast-icon shrink-0 rounded-[2px]",
        avatarSize: "lg"
      },
      variants: {
        // Klassen ausgeschrieben, damit Tailwind sie findet.
        color: {
          primary: {
            root: "border-primary focus-visible:outline-3 focus-visible:outline-primary/50",
            avatar: "bg-primary"
          },
          secondary: {
            root: "border-secondary focus-visible:outline-3 focus-visible:outline-secondary/50",
            avatar: "bg-secondary"
          },
          success: {
            root: "border-success focus-visible:outline-3 focus-visible:outline-success/50",
            avatar: "bg-success"
          },
          info: {
            root: "border-info focus-visible:outline-3 focus-visible:outline-info/50",
            avatar: "bg-info"
          },
          warning: {
            root: "border-warning focus-visible:outline-3 focus-visible:outline-warning/50",
            avatar: "bg-warning"
          },
          error: {
            root: "border-error focus-visible:outline-3 focus-visible:outline-error/50",
            avatar: "bg-error"
          },
          neutral: {
            root: "border-inverted focus-visible:outline-3 focus-visible:outline-inverted/50",
            avatar: "bg-accented"
          }
        }
      }
    }
  }
});
