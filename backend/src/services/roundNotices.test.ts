import type { Transporter } from "nodemailer";
import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../generated/prisma/client";
import {
  consoleRoundNoticeSender,
  createRoundNoticeSender,
  mailRoundNoticeSender,
  noticeRoundPublished,
  roundNoticeMail,
  type RoundNotice,
  type RoundNoticeSender,
} from "./roundNotices";

const NOTICE: RoundNotice = {
  tournamentName: "Copa Primavera",
  roundNumber: 3,
  roomLink: "https://torre.example/torneos/t-1/sala",
  settingsLink: "https://torre.example/cuenta",
};

// #141: the email a player gets when a round is published.
describe("roundNoticeMail", () => {
  it("says which round of which tournament, links to the room, and how to stop it", () => {
    const mail = roundNoticeMail(NOTICE);

    expect(mail.subject).toBe("Se publicó la ronda 3 de Copa Primavera");
    expect(mail.text).toContain(NOTICE.roomLink);
    expect(mail.text).toContain(NOTICE.settingsLink);
    expect(mail.text).toContain("dejar de recibirlo");
  });
});

describe("mailRoundNoticeSender", () => {
  it("sends one message per player, to that player only", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    const sender = mailRoundNoticeSender({ sendMail } as unknown as Transporter, "torre@uni.edu");

    await sender.send("ana@uni.edu", NOTICE);

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "torre@uni.edu",
        to: "ana@uni.edu",
        subject: expect.stringContaining("ronda 3"),
      }),
    );
    expect(sendMail.mock.calls[0]![0]).not.toHaveProperty("bcc");
  });
});

describe("createRoundNoticeSender", () => {
  it("emails with a provider, prints on a development machine, and sends nothing in production without one", () => {
    expect(
      createRoundNoticeSender({ nodeEnv: "production", smtpUrl: "smtp://localhost:2525", mailFrom: "t@u.edu" }),
    ).not.toBeNull();
    expect(createRoundNoticeSender({ nodeEnv: "development", smtpUrl: undefined, mailFrom: undefined })).toBe(
      consoleRoundNoticeSender,
    );
    expect(createRoundNoticeSender({ nodeEnv: "production", smtpUrl: undefined, mailFrom: undefined })).toBeNull();
  });

  it("prints no address on the console", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await consoleRoundNoticeSender.send("ana@uni.edu", NOTICE);

    expect(log.mock.calls[0]![0]).not.toContain("ana@uni.edu");
    log.mockRestore();
  });
});

function prismaWith(emails: string[]) {
  return {
    round: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ number: 2, tournament: { id: "t-1", name: "Copa Primavera" } }),
    },
    enrollment: {
      findMany: vi.fn().mockResolvedValue(emails.map((email) => ({ player: { user: { email } } }))),
    },
  };
}

describe("noticeRoundPublished", () => {
  it("asks only for players still in the tournament, active, who want the notice", async () => {
    const prisma = prismaWith([]);

    await noticeRoundPublished(prisma as unknown as PrismaClient, { send: vi.fn() }, "r-1", "https://torre.example");

    expect(prisma.enrollment.findMany.mock.calls[0]![0].where).toEqual({
      tournamentId: "t-1",
      withdrawnAt: null,
      player: { user: { status: "ACTIVE", roundNotices: true } },
    });
  });

  it("sends each player a link to the room and to their settings, without a doubled slash", async () => {
    const send = vi.fn().mockResolvedValue(undefined);

    const outcome = await noticeRoundPublished(
      prismaWith(["ana@uni.edu", "beto@uni.edu"]) as unknown as PrismaClient,
      { send },
      "r-1",
      "https://torre.example/",
    );

    expect(outcome).toEqual({ sent: 2, failed: 0 });
    expect(send).toHaveBeenCalledWith("ana@uni.edu", {
      tournamentName: "Copa Primavera",
      roundNumber: 2,
      roomLink: "https://torre.example/torneos/t-1/sala",
      settingsLink: "https://torre.example/cuenta",
    });
  });

  it("keeps sending when one message fails, and counts it", async () => {
    const sender: RoundNoticeSender = {
      send: vi.fn(async (email: string) => {
        if (email === "beto@uni.edu") throw new Error("mailbox full");
      }),
    };

    const outcome = await noticeRoundPublished(
      prismaWith(["ana@uni.edu", "beto@uni.edu", "carla@uni.edu"]) as unknown as PrismaClient,
      sender,
      "r-1",
      "https://torre.example",
    );

    expect(outcome).toEqual({ sent: 2, failed: 1 });
  });
});
