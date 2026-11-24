import { TestBed } from "@angular/core/testing";
import { ANNOUNCEMENTS_URL, parseAnnouncements } from "./announcements-store";
import { AppHarness } from "./testing/app-harness";

/** A published announcement (see the games-data repository). */
const launch = (id: string, date: string, more: object = {}) => ({
  id,
  date,
  title: `Title ${id}`,
  text: `Text ${id}`,
  links: {
    android: `https://play.google.com/${id}`,
    ios: `https://apps.apple.com/${id}`,
  },
  ...more,
});

/** The announcements in the ☰ menu. */
describe("Announcements", () => {
  const app = new AppHarness({ now: new Date(2026, 11, 10, 10, 0) }); // 10 December 2026
  let fetch: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    // Offline until a test publishes something, so the app never reaches the real games-data.
    globalThis.fetch = vi.fn(() =>
      Promise.reject(new Error("offline")),
    ) as unknown as typeof globalThis.fetch;
    // The app's first opening compiles every screen, which is slow on a busy machine: do it
    // here, not in the first test's time. Each test then opens the app again as it needs.
    await app.start();
  });
  afterEach(() => app.stop());

  /** Opens the app, with this published (or offline, without). */
  async function open(published?: object): Promise<void> {
    fetch = vi.fn(() =>
      published
        ? Promise.resolve(new Response(JSON.stringify(published)))
        : Promise.reject(new Error("offline")),
    );
    globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
    app.fixture?.destroy();
    TestBed.resetTestingModule();
    await app.configure();
    await app.open();
    await app.wait(0); // the download
    await app.stable();
  }

  const dotOnMenu = () => app.element.querySelector("puzzle-menu .opener .dot");
  async function openPage(name: string): Promise<void> {
    await app.click("puzzle-menu .opener");
    const item = Array.from(
      app.element.querySelectorAll<HTMLButtonElement>("puzzle-menu nav button"),
    ).find((b) => b.textContent!.trim() === name)!;
    item.click();
    await app.stable();
  }

  it("says there are none yet, and no dot, when nothing is published", async () => {
    await open({ announcements: [] });
    expect(fetch).toHaveBeenCalledWith(
      ANNOUNCEMENTS_URL,
      expect.objectContaining({ cache: "no-cache" }),
    );
    expect(dotOnMenu()).toBeNull();
    await openPage("Announcements");
    expect(app.text("puzzle-menu .page .soon")).toBe(
      "No announcements yet. News about IDEMS Games, such as new games, will appear here.",
    );
  });

  it("shows the current announcements, newest first, with a dot until the page is opened", async () => {
    await open({
      announcements: [
        launch("older", "2026-11-20"),
        launch("newer", "2026-12-05", { until: "2027-01-31" }),
        launch("sample-launch", "2026-12-01", { about: "sample" }), // this game: not shown
        launch("later", "2026-12-25"), // not yet
        launch("over", "2026-10-01", { until: "2026-11-30" }), // over
      ],
    });
    expect(dotOnMenu()).toBeTruthy();
    await app.click("puzzle-menu .opener");
    expect(app.element.querySelector("puzzle-menu nav .dot")).toBeTruthy();

    await openPage("Announcements");
    const shown = Array.from(
      app.element.querySelectorAll("puzzle-menu .announcement"),
      (a) => [
        a.querySelector("h3")!.textContent,
        a.querySelector(".date")!.textContent,
        (a.querySelector("a.store") as HTMLAnchorElement).href,
        a.querySelector("a.store")!.textContent,
      ],
    );
    expect(shown).toEqual([
      [
        "Title newer",
        "5 December 2026",
        "https://play.google.com/newer",
        "Get it on Google Play",
      ],
      [
        "Title older",
        "20 November 2026",
        "https://play.google.com/older",
        "Get it on Google Play",
      ],
    ]);
    expect(dotOnMenu()).toBeNull(); // seen

    // Opening the app again (later the same day): no new download, the same news, still seen.
    await open({ announcements: [] });
    expect(fetch).not.toHaveBeenCalled();
    expect(dotOnMenu()).toBeNull();
    await openPage("Announcements");
    expect(
      app.element.querySelectorAll("puzzle-menu .announcement").length,
    ).toBe(2);

    // The next day, offline: what was downloaded before still shows.
    vi.setSystemTime(new Date(2026, 11, 11, 10, 0));
    await open();
    expect(fetch).toHaveBeenCalled();
    await openPage("Announcements");
    expect(
      app.element.querySelectorAll("puzzle-menu .announcement").length,
    ).toBe(2);
  });

  it("skips anything malformed", () => {
    expect(
      parseAnnouncements({
        announcements: [
          launch("fine", "2026-12-01"),
          { id: "no-title", date: "2026-12-01", text: "x" },
          { id: "bad-date", date: "1 December", title: "t", text: "x" },
          launch("bad-link", "2026-12-01", {
            links: { android: "http://insecure" },
          }),
          "nonsense",
        ],
      }).map((a) => [a.id, a.links]),
    ).toEqual([
      [
        "fine",
        {
          android: "https://play.google.com/fine",
          ios: "https://apps.apple.com/fine",
        },
      ],
      ["bad-link", {}], // shown, without the link
    ]);
    expect(parseAnnouncements(null)).toEqual([]);
    expect(parseAnnouncements({ announcements: "x" })).toEqual([]);
  });
});
