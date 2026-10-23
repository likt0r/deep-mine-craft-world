/** Kurze Rückmeldung als Toast. Sie verschiebt nichts auf der Seite. */
export function useFeedback() {
  const toast = useToast();
  return {
    done(title: string) {
      toast.add({ title, color: "success", icon: "i-lucide-circle-check" });
    },
    failed(title = "Das hat nicht geklappt. Versuch es nochmal.") {
      toast.add({ title, color: "error", icon: "i-lucide-circle-alert" });
    }
  };
}
