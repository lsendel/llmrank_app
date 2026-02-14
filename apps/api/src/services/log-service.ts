import {
  ERROR_CODES,
  parseLogLine,
  summarizeLogs,
  type LogEntry,
} from "@llm-boost/shared";
import type { LogRepository, ProjectRepository } from "../repositories";
import { ServiceError } from "./errors";

export interface LogServiceDeps {
  logs: LogRepository;
  projects: ProjectRepository;
}

export function createLogService(deps: LogServiceDeps) {
  return {
    async upload(
      userId: string,
      projectId: string,
      payload: { filename: string; content: string },
    ) {
      if (!payload.filename || !payload.content) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          422,
          "filename and content required",
        );
      }

      await assertOwnership(userId, projectId);

      const entries = parseEntries(payload.content);
      if (entries.length === 0) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          422,
          "No valid log entries found",
        );
      }

      const summary = summarizeLogs(entries);
      const upload = await deps.logs.create({
        projectId,
        userId,
        filename: payload.filename,
        totalRequests: summary.totalRequests,
        crawlerRequests: summary.crawlerRequests,
        uniqueIPs: summary.uniqueIPs,
        summary,
      });

      return { id: upload.id, summary };
    },

    async list(userId: string, projectId: string) {
      await assertOwnership(userId, projectId);
      return deps.logs.listByProject(projectId);
    },

    async get(userId: string, logId: string) {
      const upload = await deps.logs.getById(logId);
      if (!upload) {
        const err = ERROR_CODES.NOT_FOUND;
        throw new ServiceError("NOT_FOUND", err.status, "Log upload not found");
      }
      await assertOwnership(userId, upload.projectId);
      return upload;
    },
  };

  function parseEntries(content: string) {
    const lines = content.split("\n").filter((line) => line.trim().length > 0);
    const entries: LogEntry[] = [];
    for (const line of lines) {
      const entry = parseLogLine(line);
      if (entry) entries.push(entry);
    }
    return entries;
  }

  async function assertOwnership(userId: string, projectId: string) {
    const project = await deps.projects.getById(projectId);
    if (!project || project.userId !== userId) {
      const err = ERROR_CODES.NOT_FOUND;
      throw new ServiceError("NOT_FOUND", err.status, err.message);
    }
  }
}
