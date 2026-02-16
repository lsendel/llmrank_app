// Mock toast hook
export function useToast() {
  return {
    toast: (args: {
      title?: string;
      description?: string;
      variant?: string;
    }) => {
      console.log(`[TOAST] ${args.title}: ${args.description}`);
    },
  };
}
