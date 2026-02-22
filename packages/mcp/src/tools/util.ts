import { ApiClientError } from "../client/types";

export function formatError(e: unknown) {
  if (e instanceof ApiClientError) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error [${e.code}]: ${e.message}${e.details ? `\nDetails: ${JSON.stringify(e.details)}` : ""}`,
        },
      ],
      isError: true,
    };
  }
  return {
    content: [
      {
        type: "text" as const,
        text: `Unexpected error: ${e instanceof Error ? e.message : String(e)}`,
      },
    ],
    isError: true,
  };
}
