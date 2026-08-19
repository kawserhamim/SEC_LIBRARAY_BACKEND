import http from "http";
import { jest } from "@jest/globals";
import {
  initSocket,
  getIO,
  emitToUser,
  emitToAdmin,
  broadcastOverdueStats,
  broadcastReservationStats,
  ADMIN_ROOM,
} from "../src/services/socket-service.js";
import { IssuedBook } from "../src/models/issuebook-model.js";
import { ReserveBook } from "../src/models/reserve-book.js";

describe("Service: socket-service", () => {
  let server;

  beforeAll((done) => {
    server = http.createServer();
    server.listen(0, done);
  });

  afterAll((done) => {
    const io = getIO();
    if (io) {
      io.close(() => {
        if (server.listening) {
          server.close(done);
        } else {
          done();
        }
      });
    } else if (server.listening) {
      server.close(done);
    } else {
      done();
    }
  });

  test("should initialize socket.io server instance and return true when emitting to user", () => {
    const io = initSocket(server);
    expect(io).toBeDefined();
    expect(getIO()).toBe(io);

    // Test emitting to user
    const emitted = emitToUser("user123", "book:available", {
      bookTitle: "Introduction to Algorithms",
    });

    expect(emitted).toBe(true);
  });

  test("should return false when emitting without valid userId", () => {
    const emitted = emitToUser(null, "book:available", {});
    expect(emitted).toBe(false);
  });

  test("should emit event to admin room", () => {
    expect(ADMIN_ROOM).toBe("admin:room");
    const emitted = emitToAdmin("admin:stats:overdue", { overdueCount: 5 });
    expect(emitted).toBe(true);
  });

  test("should fetch and broadcast overdue stats correctly", async () => {
    const countDocumentsSpy = jest
      .spyOn(IssuedBook, "countDocuments")
      .mockResolvedValueOnce(7);

    const stats = await broadcastOverdueStats();

    expect(countDocumentsSpy).toHaveBeenCalled();
    expect(stats).toEqual({ overdueCount: 7 });

    countDocumentsSpy.mockRestore();
  });

  test("should fetch and broadcast reservation stats correctly", async () => {
    const countDocumentsSpy = jest
      .spyOn(ReserveBook, "countDocuments")
      .mockImplementation(async ({ status }) => {
        if (status === "pending") return 3;
        if (status === "expired") return 2;
        if (status === "issued") return 5;
        return 0;
      });

    const stats = await broadcastReservationStats();

    expect(countDocumentsSpy).toHaveBeenCalledTimes(3);
    expect(stats).toEqual({
      totalReservations: 10,
      activeReservations: 3,
      expiredReservations: 2,
      issuedReservations: 5,
    });

    countDocumentsSpy.mockRestore();
  });
});
