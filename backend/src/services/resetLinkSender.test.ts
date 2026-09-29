import nodemailer from "nodemailer";
import { afterEach, describe, expect, it, vi } from "vitest";

import { consoleResetLinkSender, createResetLinkSender, mailResetLinkSender } from "./resetLinkSender";

const LINK = "https://torre.example.com/restablecer-password?token=abc123";

describe("mailResetLinkSender", () => {
  it("emails the link to the account's address, from the configured sender", async () => {
    const transporter = nodemailer.createTransport({ jsonTransport: true });
    const sendMail = vi.spyOn(transporter, "sendMail");

    await mailResetLinkSender(transporter, "Torre <no-reply@example.com>").send("ana@example.com", LINK);

    const sent = JSON.parse((await sendMail.mock.results[0]!.value).message);
    expect(sent.to).toEqual([{ address: "ana@example.com", name: "" }]);
    expect(sent.from).toEqual({ address: "no-reply@example.com", name: "Torre" });
    expect(sent.text).toContain(LINK);
  });
});

describe("createResetLinkSender", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("has no way to send links in production without a mail provider: never the console, whose logs would hold live tokens", () => {
    expect(createResetLinkSender({ nodeEnv: "production", smtpUrl: undefined, mailFrom: undefined })).toBeNull();
  });

  it("prints the link to the console on a development machine without a mail provider", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const sender = createResetLinkSender({ nodeEnv: "development", smtpUrl: undefined, mailFrom: undefined });
    await sender!.send("ana@example.com", LINK);

    expect(sender).toBe(consoleResetLinkSender);
    expect(log).toHaveBeenCalledWith(expect.stringContaining(LINK));
  });

  it("emails through the configured provider when there is one", () => {
    const sender = createResetLinkSender({
      nodeEnv: "production",
      smtpUrl: "smtps://mailer:password@smtp.example.com:465",
      mailFrom: "no-reply@example.com",
    });

    expect(sender).not.toBe(consoleResetLinkSender);
  });
});
