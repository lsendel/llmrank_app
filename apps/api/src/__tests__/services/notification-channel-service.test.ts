import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNotificationChannelService } from "../../services/notification-channel-service";
import { buildUser } from "../helpers/factories";

describe("NotificationChannelService", () => {
  const mockChannelRepo = {
    create: vi.fn(),
    listByUser: vi.fn().mockResolvedValue([]),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    countByUser: vi.fn().mockResolvedValue(0),
  };
  const mockUserRepo = {
    getById: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  describe("create", () => {
    it("creates a webhook channel for starter plan", async () => {
      const user = buildUser({ plan: "starter" });
      mockUserRepo.getById.mockResolvedValue(user);
      mockChannelRepo.countByUser.mockResolvedValue(1);
      mockChannelRepo.create.mockResolvedValue({ id: "ch-1" });

      const service = createNotificationChannelService({
        channels: mockChannelRepo,
        users: mockUserRepo,
      });

      const result = await service.create({
        userId: user.id,
        channelType: "webhook",
        config: { url: "https://hooks.example.com/test" },
        eventTypes: ["crawl_completed"],
      });

      expect(result).toEqual({ id: "ch-1" });
      expect(mockChannelRepo.create).toHaveBeenCalled();
    });

    it("rejects when plan limit reached", async () => {
      const user = buildUser({ plan: "starter" });
      mockUserRepo.getById.mockResolvedValue(user);
      mockChannelRepo.countByUser.mockResolvedValue(2);

      const service = createNotificationChannelService({
        channels: mockChannelRepo,
        users: mockUserRepo,
      });

      await expect(
        service.create({
          userId: user.id,
          channelType: "webhook",
          config: { url: "https://example.com" },
          eventTypes: ["crawl_completed"],
        }),
      ).rejects.toThrow("PLAN_LIMIT_REACHED");
    });

    it("rejects non-email channels for free tier", async () => {
      const user = buildUser({ plan: "free" });
      mockUserRepo.getById.mockResolvedValue(user);

      const service = createNotificationChannelService({
        channels: mockChannelRepo,
        users: mockUserRepo,
      });

      await expect(
        service.create({
          userId: user.id,
          channelType: "webhook",
          config: { url: "https://example.com" },
          eventTypes: ["crawl_completed"],
        }),
      ).rejects.toThrow();
    });

    it("allows email channel for free tier within limit", async () => {
      const user = buildUser({ plan: "free" });
      mockUserRepo.getById.mockResolvedValue(user);
      mockChannelRepo.countByUser.mockResolvedValue(0);
      mockChannelRepo.create.mockResolvedValue({ id: "ch-2" });

      const service = createNotificationChannelService({
        channels: mockChannelRepo,
        users: mockUserRepo,
      });

      const result = await service.create({
        userId: user.id,
        channelType: "email",
        config: { address: "test@example.com" },
        eventTypes: ["crawl_completed"],
      });

      expect(result).toEqual({ id: "ch-2" });
      expect(mockChannelRepo.create).toHaveBeenCalled();
    });

    it("throws NOT_FOUND when user does not exist", async () => {
      mockUserRepo.getById.mockResolvedValue(null);

      const service = createNotificationChannelService({
        channels: mockChannelRepo,
        users: mockUserRepo,
      });

      await expect(
        service.create({
          userId: "nonexistent",
          channelType: "email",
          config: {},
          eventTypes: ["crawl_completed"],
        }),
      ).rejects.toThrow("User not found");
    });
  });

  describe("list", () => {
    it("returns channels for a user", async () => {
      const channels = [
        { id: "ch-1", channelType: "email" },
        { id: "ch-2", channelType: "webhook" },
      ];
      mockChannelRepo.listByUser.mockResolvedValue(channels);

      const service = createNotificationChannelService({
        channels: mockChannelRepo,
        users: mockUserRepo,
      });

      const result = await service.list("user-1");
      expect(result).toEqual(channels);
      expect(mockChannelRepo.listByUser).toHaveBeenCalledWith("user-1");
    });
  });

  describe("update", () => {
    it("updates a channel owned by the user", async () => {
      const channel = { id: "ch-1", userId: "user-1", channelType: "webhook" };
      mockChannelRepo.getById.mockResolvedValue(channel);
      mockChannelRepo.update.mockResolvedValue({ ...channel, enabled: false });

      const service = createNotificationChannelService({
        channels: mockChannelRepo,
        users: mockUserRepo,
      });

      const result = await service.update("user-1", "ch-1", { enabled: false });
      expect(result).toEqual({ ...channel, enabled: false });
      expect(mockChannelRepo.update).toHaveBeenCalledWith("ch-1", {
        enabled: false,
      });
    });

    it("throws NOT_FOUND when channel does not exist", async () => {
      mockChannelRepo.getById.mockResolvedValue(null);

      const service = createNotificationChannelService({
        channels: mockChannelRepo,
        users: mockUserRepo,
      });

      await expect(
        service.update("user-1", "nonexistent", { enabled: false }),
      ).rejects.toThrow("Channel not found");
    });

    it("throws NOT_FOUND when channel belongs to another user", async () => {
      const channel = {
        id: "ch-1",
        userId: "other-user",
        channelType: "webhook",
      };
      mockChannelRepo.getById.mockResolvedValue(channel);

      const service = createNotificationChannelService({
        channels: mockChannelRepo,
        users: mockUserRepo,
      });

      await expect(
        service.update("user-1", "ch-1", { enabled: false }),
      ).rejects.toThrow("Channel not found");
    });
  });

  describe("delete", () => {
    it("deletes a channel owned by the user", async () => {
      const channel = { id: "ch-1", userId: "user-1", channelType: "email" };
      mockChannelRepo.getById.mockResolvedValue(channel);
      mockChannelRepo.delete.mockResolvedValue(undefined);

      const service = createNotificationChannelService({
        channels: mockChannelRepo,
        users: mockUserRepo,
      });

      await service.delete("user-1", "ch-1");
      expect(mockChannelRepo.delete).toHaveBeenCalledWith("ch-1");
    });

    it("throws NOT_FOUND when channel does not exist", async () => {
      mockChannelRepo.getById.mockResolvedValue(null);

      const service = createNotificationChannelService({
        channels: mockChannelRepo,
        users: mockUserRepo,
      });

      await expect(service.delete("user-1", "nonexistent")).rejects.toThrow(
        "Channel not found",
      );
    });

    it("throws NOT_FOUND when channel belongs to another user", async () => {
      const channel = {
        id: "ch-1",
        userId: "other-user",
        channelType: "webhook",
      };
      mockChannelRepo.getById.mockResolvedValue(channel);

      const service = createNotificationChannelService({
        channels: mockChannelRepo,
        users: mockUserRepo,
      });

      await expect(service.delete("user-1", "ch-1")).rejects.toThrow(
        "Channel not found",
      );
    });
  });
});
