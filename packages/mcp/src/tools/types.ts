import { ApiClient } from "../client/api-client";

export interface ToolContext {
  client: ApiClient;
  userId?: string;
}

export type ToolRegistrar = (ctx: ToolContext) => void;
