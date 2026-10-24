/** Kurze Rückmeldung als Toast. Sie verschiebt nichts auf der Seite. */
export function useFeedback() {
  const toast = useToast();
  // Das Symbol steht weiß in einem Farbblock, den Block färbt das Toast-Theme (app.config.ts).
  const block = (icon: string) => ({ icon, ui: { icon: "size-6 text-white" } });
  return {
    done(title: string) {
      toast.add({ title, color: "success", avatar: block("i-lucide-circle-check") });
    },
    failed(title = "Das hat nicht geklappt. Versuch es nochmal.") {
      toast.add({ title, color: "error", avatar: block("i-lucide-circle-alert") });
    }
  };
}
