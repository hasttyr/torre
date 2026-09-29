import { afterEach, describe, expect, it, vi } from "vitest";

import { saveFile } from "./download";

describe("saveFile", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("hands the file to the browser under its name, and releases it only once the download has started", () => {
    vi.useFakeTimers();
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:torre/1");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const blob = new Blob(["%PDF"], { type: "application/pdf" });

    saveFile(blob, "clasificacion.pdf");

    expect(create).toHaveBeenCalledWith(blob);
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe("clasificacion.pdf");
    expect(link.href).toBe("blob:torre/1");
    // Revoking right after click() makes some browsers cancel the download.
    expect(revoke).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith("blob:torre/1");
  });
});
