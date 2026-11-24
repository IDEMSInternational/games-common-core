import { TestBed } from "@angular/core/testing";
import { Capacitor } from "@capacitor/core";
import { ANNOUNCEMENTS_URL } from "./announcements-store";
import { GAMES_URL, parseGames } from "./games-store";
import BUILT_IN from "./games.json";
import { AppHarness } from "./testing/app-harness";

const PAGES = "https://idemsinternational.github.io/games-data";

/** A published game (see the games-data repository). */
const game = (id: string, stores: object = {}) => ({
  id,
  name: `Name ${id}`,
  summary: `About ${id}`,
  stores: { android: "", ios: "", ...stores },
});

/** The ☰ menu's Other IDEMS Games page. */
describe("Other IDEMS Games", () => {
  const app = new AppHarness({ now: new Date(2026, 11, 10, 10, 0) });
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
  afterEach(() => {
    vi.restoreAllMocks();
    app.stop();
  });

  /** Opens the app on this kind of phone, with this list published (or offline, without). */
  async function open(published?: object, platform = "web"): Promise<void> {
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue(platform);
    fetch = vi.fn((url: string) =>
      url === GAMES_URL && published
        ? Promise.resolve(new Response(JSON.stringify(published)))
        : url === ANNOUNCEMENTS_URL
          ? Promise.resolve(new Response('{"announcements": []}'))
          : Promise.reject(new Error("offline")),
    );
    globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
    app.fixture?.destroy();
    TestBed.resetTestingModule();
    await app.configure();
    await app.open();
    await app.wait(0); // the downloads
    await app.stable();
    await app.click("puzzle-menu .opener");
    Array.from(
      app.element.querySelectorAll<HTMLButtonElement>("puzzle-menu nav button"),
    )
      .find((b) => b.textContent!.trim() === "Other IDEMS Games")!
      .click();
    await app.stable();
  }

  /** Each game shown: name, "Coming soon" or not, its line, where a tap goes, its icon. */
  const shown = () =>
    Array.from(
      app.element.querySelectorAll<HTMLAnchorElement>("puzzle-games a.game"),
      (a) => [
        a.querySelector("strong")!.textContent,
        a.querySelector(".soon")?.textContent ?? "",
        a.querySelector("small")!.textContent,
        a.href,
        a.querySelector("img")?.getAttribute("src") ?? "no icon",
      ],
    );

  it("shows the list the app was built with until one is downloaded", async () => {
    await open(); // offline, the first time
    expect(fetch).toHaveBeenCalledWith(
      GAMES_URL,
      expect.objectContaining({ cache: "no-cache" }),
    );
    const builtIn = parseGames(BUILT_IN)!;
    expect(builtIn.length).toBeGreaterThan(0);
    expect(shown().map(([name]) => name)).toEqual(builtIn.map((g) => g.name));
  });

  it("shows the downloaded list in its order, without this game, each opening its page", async () => {
    await open({ games: [game("slanted"), game("sample"), game("lightup")] });
    expect(shown()).toEqual([
      [
        "Name slanted",
        "Coming soon",
        "About slanted",
        `${PAGES}/slanted/`,
        `${PAGES}/slanted/icon.png`,
      ],
      [
        "Name lightup",
        "Coming soon",
        "About lightup",
        `${PAGES}/lightup/`,
        `${PAGES}/lightup/icon.png`,
      ],
    ]);

    // Later the same day, offline: what was downloaded is kept, without checking again.
    await open();
    expect(fetch).not.toHaveBeenCalledWith(GAMES_URL, expect.anything());
    expect(shown().length).toBe(2);
  });

  it("opens a game in this phone's store once it's there, and its page until then", async () => {
    const games = {
      games: [
        game("both", {
          android: "https://play.google.com/both",
          ios: "https://apps.apple.com/both",
        }),
        game("android-only", {
          android: "https://play.google.com/android-only",
        }),
      ],
    };
    await open(games, "android");
    expect(shown().map(([name, soon, , url]) => [name, soon, url])).toEqual([
      ["Name both", "", "https://play.google.com/both"],
      ["Name android-only", "", "https://play.google.com/android-only"],
    ]);

    vi.setSystemTime(new Date(2026, 11, 11, 10, 0)); // the next day, on an iPhone
    await open(games, "ios");
    expect(shown().map(([name, soon, , url]) => [name, soon, url])).toEqual([
      ["Name both", "", "https://apps.apple.com/both"],
      ["Name android-only", "Coming soon", `${PAGES}/android-only/`],
    ]);
  });

  it("shows a plain square for an icon that can't be loaded", async () => {
    await open({ games: [game("slanted"), game("lightup")] });
    app.element
      .querySelector("puzzle-games img")!
      .dispatchEvent(new Event("error"));
    await app.stable();
    expect(shown().map(([name, , , , icon]) => [name, icon])).toEqual([
      ["Name slanted", "no icon"],
      ["Name lightup", `${PAGES}/lightup/icon.png`],
    ]);
    expect(
      app.element.querySelectorAll("puzzle-games .icon.blank").length,
    ).toBe(1);
  });

  it("says more games are coming soon when there are no others", async () => {
    await open({ games: [game("sample")] });
    expect(shown()).toEqual([]);
    expect(app.text("puzzle-games")).toBe("More games coming soon!");
  });

  it("skips anything malformed, and keeps the list it had if the file is no list", () => {
    expect(
      parseGames({
        games: [
          game("fine", { android: "https://play.google.com/fine" }),
          { id: "no-summary", name: "x", stores: {} },
          { id: "Bad Id", name: "x", summary: "y" },
          game("insecure", { ios: "http://apps.apple.com/insecure" }),
          "nonsense",
        ],
      })!.map((g) => [g.id, g.stores]),
    ).toEqual([
      ["fine", { android: "https://play.google.com/fine" }],
      ["insecure", {}], // shown, opening its page
    ]);
    expect(parseGames(null)).toBeNull();
    expect(parseGames({ games: "x" })).toBeNull();
  });
});
