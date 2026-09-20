import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { useConfirmStore } from "../../stores/confirm";
import { clickConfirmDialogButton, mountConfirmDialogHost } from "../../test-support/confirmDialog";

describe("ConfirmDialogHost", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("shows the given title and message", async () => {
    mountConfirmDialogHost();
    const confirm = useConfirmStore();

    void confirm.ask({ title: "Retirar jugador", message: "¿Seguro?" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.body.textContent).toContain("Retirar jugador");
    expect(document.body.textContent).toContain("¿Seguro?");
  });

  it("resolves true when the confirm button is clicked", async () => {
    mountConfirmDialogHost();
    const confirm = useConfirmStore();

    const pending = confirm.ask({ title: "T", message: "M", confirmLabel: "Sí, retirar" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    await clickConfirmDialogButton("Sí, retirar");

    // Regression test: reka-ui's AlertDialogAction/Cancel wrappers used to
    // race their own internal close against this click's resolve(true),
    // sometimes settling the promise as false despite the confirm button
    // being the one clicked.
    await expect(pending).resolves.toBe(true);
    expect(confirm.open).toBe(false);
  });

  it("resolves false when the cancel button is clicked", async () => {
    mountConfirmDialogHost();
    const confirm = useConfirmStore();

    const pending = confirm.ask({ title: "T", message: "M", cancelLabel: "No" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    await clickConfirmDialogButton("No");

    await expect(pending).resolves.toBe(false);
  });

  it("resolves false when dismissed without an explicit button (e.g. Escape)", async () => {
    mountConfirmDialogHost();
    const confirm = useConfirmStore();

    const pending = confirm.ask({ title: "T", message: "M" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    confirm.resolve(false);

    await expect(pending).resolves.toBe(false);
  });
});
