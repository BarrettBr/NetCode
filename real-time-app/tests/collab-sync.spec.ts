import { test, expect, devices, type Browser, type BrowserContext, type Page } from "@playwright/test";

declare global {
  interface Window {
    __wsMessages?: string[];
    __wsReceived?: string[];
    __wsSockets?: WebSocket[];
    __NETCODE_EDITOR_EVENTS__?: Array<{
      id: string;
      kind: string;
      text: string;
    }>;
  }
}

async function instrumentWebSocket(page: Page) {
  await page.addInitScript(() => {
    window.__wsMessages = [];
    window.__wsReceived = [];
    window.__wsSockets = [];
    const OriginalWebSocket = window.WebSocket;
    class TrackingWebSocket extends OriginalWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        window.__wsSockets?.push(this);
        this.addEventListener("message", (event) => {
          if (typeof event.data === "string") {
            window.__wsReceived?.push(event.data);
          }
        });
      }

      override send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        if (typeof data === "string") {
          window.__wsMessages?.push(data);
        }
        return super.send(data);
      }
    }
    window.WebSocket = TrackingWebSocket as typeof WebSocket;
  });
}

async function openEditor(page: Page, roomId: string) {
  await page.goto(`/?roomId=${roomId}`);
  const editor = page.locator("#mainInput");
  await expect(editor).toBeVisible();
  await editor.click();
  return editor;
}

async function editorText(page: Page) {
  const eventText = await page.evaluate(() => {
    const events = window.__NETCODE_EDITOR_EVENTS__ ?? [];
    for (let idx = events.length - 1; idx >= 0; idx--) {
      const event = events[idx];
      if (event.id === "mainInput") {
        return event.text;
      }
    }
    return "";
  });
  if (eventText !== "") {
    return eventText;
  }
  return await page.locator(".cm-editor").evaluate((node) => {
    const lines = Array.from(node.querySelectorAll(".cm-line")).map(
      (line) => line.textContent ?? ""
    );
    return lines.join("\n");
  });
}

async function createMobileContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    ...devices["Pixel 5"],
  });
}

test("desktop and mobile stay in sync for initial snapshot and bidirectional typing", async ({
  browser,
  page,
}) => {
  const roomId = `sync-${Date.now()}`;
  const initialText = Array.from({ length: 12 }, (_, idx) => `line ${idx + 1}`).join("\n");

  await instrumentWebSocket(page);
  const desktopEditor = await openEditor(page, roomId);
  await desktopEditor.pressSequentially(initialText);
  await expect.poll(() => editorText(page)).toBe(initialText);

  const mobileContext = await createMobileContext(browser);
  const mobilePage = await mobileContext.newPage();
  await instrumentWebSocket(mobilePage);
  await openEditor(mobilePage, roomId);
  await expect
    .poll(async () => {
      const messages = await mobilePage.evaluate(() => window.__wsReceived ?? []);
      const raw = messages.find((message) => message.includes('"event":"connection_update"'));
      if (!raw) {
        return "";
      }
      return JSON.parse(raw).update.text as string;
    })
    .toBe(initialText);
  await expect.poll(() => editorText(mobilePage)).toBe(initialText);

  await desktopEditor.click();
  await page.keyboard.type("X");
  await expect.poll(async () => (await editorText(page)).length).toBeGreaterThan(
    initialText.length
  );
  const firstSharedText = await editorText(page);
  await expect.poll(() => editorText(mobilePage)).toBe(firstSharedText);

  const mobileEditor = mobilePage.locator("#mainInput");
  await mobileEditor.click();
  await mobilePage.keyboard.type("Y");
  await expect.poll(async () => (await editorText(mobilePage)).length).toBeGreaterThan(
    firstSharedText.length
  );
  await expect.poll(() => editorText(page)).toBe(await editorText(mobilePage));

  await mobileContext.close();
});
