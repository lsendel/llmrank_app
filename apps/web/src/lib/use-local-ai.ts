import { useState, useEffect, useCallback } from "react";

export function useLocalAI() {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [model, setModel] = useState<any>(null);

  useEffect(() => {
    // Check if the AI capability is available in the browser
    if (typeof window !== "undefined" && (window as any).ai) {
      if ((window as any).ai.languageModel) {
        (window as any).ai.languageModel
          .capabilities()
          .then((capabilities: any) => {
            if (capabilities.available !== "no") {
              setIsAvailable(true);
            }
          });
      }
    }
  }, []);

  const generateText = useCallback(
    async (prompt: string): Promise<string> => {
      if (!isAvailable) {
        // Simulate/mock AI response for testing if not available
        console.warn("Local AI unavailable, using mock response.");
        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve(
                `[Mock AI Response] Analysis for: "${prompt.substring(0, 30)}..."`,
              ),
            1000,
          ),
        );
      }

      try {
        let currentModel = model;
        if (!currentModel) {
          currentModel = await (window as any).ai.languageModel.create();
          setModel(currentModel);
        }

        const result = await currentModel.prompt(prompt);
        return result;
      } catch (error) {
        console.error("Error generating text with Local AI:", error);
        throw error;
      }
    },
    [isAvailable, model],
  );

  return { isAvailable, generateText };
}
