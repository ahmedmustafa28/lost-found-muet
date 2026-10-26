import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

// Milestone 4 in the browser (DEVELOPMENT.md 16.3): claims, review, contact
// sharing and marking items as returned, with three signed-in users at once.
// The steps build on each other, so they run in order and stop at the first
// failure. Runs against whatever Supabase project .env.local points to;
// claims stay in that database (users can't delete rows), and test reports
// still active at the end are closed so they leave the public lists.

type Person = "A" | "B" | "C";
type Credentials = { email: string; password: string };

function readCredentials(): Record<Person, Credentials> | null {
  const people: Person[] = ["A", "B", "C"];
  const entries = people.map((p) => {
    const email = process.env[`E2E_${p}_EMAIL`];
    const password = process.env[`E2E_${p}_PASSWORD`];
    return email && password ? ([p, { email, password }] as const) : null;
  });
  if (entries.some((e) => e === null)) return null;
  return Object.fromEntries(entries as (readonly [Person, Credentials])[]) as Record<
    Person,
    Credentials
  >;
}

const creds = readCredentials();

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ITEM_URL = new RegExp(`/items/${UUID}`);
const CLAIM_URL = new RegExp(`/claims/${UUID}$`);

const RUN = Date.now();
const titles = {
  found: `E2E found ${RUN}`,
  lost: `E2E lost ${RUN}`,
  cancel: `E2E cancel ${RUN}`,
};
const PRIVATE_DETAILS = `Initials T.P. scratched on the back (${RUN})`;
const HANDOVER_NOTE = `Library entrance, Monday 2 pm (${RUN})`;
const SAFETY_TIP = "Never pay anyone to get an item back.";

test.describe.configure({ mode: "serial" });

test.describe("claims", () => {
  test.skip(
    creds === null,
    "Set E2E_A_EMAIL, E2E_A_PASSWORD, E2E_B_EMAIL, E2E_B_PASSWORD, E2E_C_EMAIL and E2E_C_PASSWORD in .env.test.local (see .env.test.example).",
  );

  const contexts: BrowserContext[] = [];
  const page = {} as Record<Person, Page>;
  const name = {} as Record<Person, string>;
  // Every report the tests create, so the clean-up can close it.
  const created: { owner: Person; url: string }[] = [];

  let foundUrl = "";
  let claimB = ""; // B's "This is mine" claim on the found report
  let claimC = ""; // C's second claim on the same report
  let lostUrl = "";
  let claimOnLost = "";
  let cancelUrl = "";

  test.beforeAll(async ({ browser }) => {
    if (!creds) return;
    for (const person of ["A", "B", "C"] as const) {
      const { context, page: p } = await signIn(browser, person, creds[person]);
      contexts.push(context);
      page[person] = p;
      name[person] = await displayName(p);
    }
  });

  test.afterAll(async () => {
    for (const report of created) {
      try {
        await closeIfActive(page[report.owner], report.url);
      } catch {
        // Keep closing the others; a report left active shows in the logs.
        console.warn(`Could not close test report ${report.url}`);
      }
    }
    for (const context of contexts) await context.close();
  });

  // ---------- Found item: "This is mine" ----------

  test("A reports a found item and sees no claim button on it", async () => {
    foundUrl = await createReport(page.A, {
      type: "found",
      title: titles.found,
      privateDetails: PRIVATE_DETAILS,
    });
    created.push({ owner: "A", url: foundUrl });

    await expect(page.A.getByRole("heading", { name: titles.found })).toBeVisible();
    await expect(claimButton(page.A, "This is mine")).toHaveCount(0);
  });

  test("B claims it, then sees 'already sent' instead of the button", async () => {
    claimB = await sendClaim(page.B, foundUrl, "This is mine", `B: blue keyring with a bottle opener (${RUN})`);

    await page.B.goto(foundUrl);
    await expect(page.B.getByText("You've already sent a claim.")).toBeVisible();
    await expect(claimButton(page.B, "This is mine")).toHaveCount(0);
  });

  test("C sends a second claim on the same report", async () => {
    claimC = await sendClaim(page.C, foundUrl, "This is mine", `C: three keys on a red ring (${RUN})`);
  });

  test("A sees the review count, the message and the private details, but not who B is", async () => {
    await page.A.goto("/dashboard");
    await expect(
      page.A.getByRole("link", { name: /claims? waiting for your review/ }),
    ).toBeVisible();

    await page.A.goto(claimB);
    await expect(page.A.getByText(`B: blue keyring with a bottle opener (${RUN})`)).toBeVisible();
    await expect(page.A.getByText(PRIVATE_DETAILS)).toBeVisible();
    await expect(page.A.getByText(name.B)).toHaveCount(0);
    await expect(page.A.getByText(creds!.B.email)).toHaveCount(0);
  });

  test("C can't open B's claim", async () => {
    await expectNotFound(page.C, claimB, "Claim not found");
  });

  test("A approves B's claim; both see the note, each other's contact and the tips", async () => {
    await page.A.goto(claimB);
    await page.A.getByRole("button", { name: "Approve", exact: true }).click();
    await page.A.getByLabel("Handover note").fill(HANDOVER_NOTE);
    await page.A.getByRole("button", { name: "Approve claim" }).click();

    await expectContact(page.A, { otherName: name.B, otherEmail: creds!.B.email });
    await expect(claimStatus(page.A)).toHaveText("Approved");

    await page.B.goto(claimB);
    await expectContact(page.B, { otherName: name.A, otherEmail: creds!.A.email });

    await expectNotFound(page.C, claimB, "Claim not found");
  });

  test("A sees the 'already approved' note instead of Approve on C's claim", async () => {
    await page.A.goto(claimC);
    await expect(
      page.A.getByText("You've already approved another claim on this report."),
    ).toBeVisible();
    await expect(page.A.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  });

  test("A marks the item as returned", async () => {
    // On the public list first, so its absence afterwards means something.
    await page.C.goto(`/found?q=${encodeURIComponent(titles.found)}`);
    await expect(page.C.getByRole("link", { name: titles.found })).toBeVisible();

    await page.A.goto(foundUrl);
    await page.A.getByRole("button", { name: "Mark as returned" }).click();
    await expect(
      page.A.getByText("Has this item been returned? Any other pending claims will be closed."),
    ).toBeVisible();
    await page.A.getByRole("button", { name: "Yes, it's been returned" }).click();

    await expect(page.A.getByText("This item has been returned.")).toBeVisible();
    await expect(page.A.getByRole("button", { name: "Mark as returned" })).toHaveCount(0);
    await expect(page.A.getByRole("button", { name: "Close report" })).toHaveCount(0);
    await expect(page.A.getByRole("link", { name: "Edit", exact: true })).toHaveCount(0);
  });

  test("after returning: off the public list, approved claim and contact kept, others closed", async () => {
    await page.C.goto(`/found?q=${encodeURIComponent(titles.found)}`);
    await expect(page.C.getByText("No items match your search.")).toBeVisible();
    await expect(page.C.getByRole("link", { name: titles.found })).toHaveCount(0);

    await page.A.goto("/dashboard");
    await expect(myReportsEntry(page.A, titles.found)).toContainText("Returned");

    for (const [viewer, other] of [["A", "B"], ["B", "A"]] as const) {
      await page[viewer].goto(claimB);
      await expect(claimStatus(page[viewer])).toHaveText("Approved");
      await expectContact(page[viewer], { otherName: name[other], otherEmail: creds![other].email });
    }

    await page.C.goto(claimC);
    await expect(claimStatus(page.C)).toHaveText("Closed");
  });

  test("a returned report shows no claim button", async () => {
    await page.B.goto(foundUrl);
    await expect(page.B.getByText("You've already sent a claim.")).toBeVisible();
    await expect(claimButton(page.B, "This is mine")).toHaveCount(0);

    // C's claim was closed, so C can no longer see the report at all.
    await expectNotFound(page.C, foundUrl, "Report not found");
  });

  // ---------- Lost item: "I found this" ----------

  test("B reports a lost item and A says 'I found this'", async () => {
    lostUrl = await createReport(page.B, { type: "lost", title: titles.lost });
    created.push({ owner: "B", url: lostUrl });

    claimOnLost = await sendClaim(page.A, lostUrl, "I found this", `A: found it near the cafeteria on Friday (${RUN})`);
  });

  test("B rejects A's claim; A sees it declined, with no contact details", async () => {
    await page.B.goto(claimOnLost);
    await page.B.getByRole("button", { name: "Reject", exact: true }).click();
    await page.B.getByRole("button", { name: "Yes, reject claim" }).click();
    await expect(claimStatus(page.B)).toHaveText("Rejected");

    await page.A.goto(claimOnLost);
    await expect(claimStatus(page.A)).toHaveText("Rejected");
    await expect(page.A.getByText("This claim was declined.")).toBeVisible();
    await expect(handoverSection(page.A)).toHaveCount(0);
    await expect(page.A.getByText(creds!.B.email)).toHaveCount(0);
  });

  // ---------- Cancelling and closed reports ----------

  test("B cancels a pending claim and can claim again", async () => {
    cancelUrl = await createReport(page.A, { type: "found", title: titles.cancel });
    created.push({ owner: "A", url: cancelUrl });

    await sendClaim(page.B, cancelUrl, "This is mine", `B: this one is mine too, I think (${RUN})`);
    await page.B.getByRole("button", { name: "Cancel claim" }).click();
    await page.B.getByRole("button", { name: "Yes, cancel claim" }).click();
    await expect(claimStatus(page.B)).toHaveText("Cancelled");
    await expect(page.B.getByRole("button", { name: "Cancel claim" })).toHaveCount(0);

    await page.B.goto(cancelUrl);
    await expect(claimButton(page.B, "This is mine")).toBeVisible();
  });

  test("a closed report shows no claim button", async () => {
    await page.A.goto(cancelUrl);
    await page.A.getByRole("button", { name: "Close report" }).click();
    await page.A.getByRole("button", { name: "Yes, close report" }).click();
    await expect(page.A.getByText("This report is closed.")).toBeVisible();
    await expect(claimButton(page.A, "This is mine")).toHaveCount(0);

    // B's claim was cancelled, so B can no longer see the closed report.
    await expectNotFound(page.B, cancelUrl, "Report not found");
  });

  // ---------- Mobile ----------

  test("no horizontal scrolling at 375 px", async () => {
    const checks: [Person, string][] = [
      ["A", foundUrl],
      ["A", claimB],
      ["A", "/dashboard"],
      ["B", claimB],
    ];
    for (const [person, url] of checks) {
      const p = page[person];
      await p.setViewportSize({ width: 375, height: 800 });
      await p.goto(url);
      await expect(p.locator("main h1")).toBeVisible();
      const overflow = await p.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${url} as ${person} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
    }
    for (const person of ["A", "B"] as const) {
      await page[person].setViewportSize({ width: 1280, height: 720 });
    }
  });
});

// ---------- Helpers ----------

// Fails at once with the login page's own message (for example wrong
// credentials) instead of timing out. Never includes the email or password.
async function signIn(browser: Browser, person: Person, { email, password }: Credentials) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();

  const loginError = page.getByRole("main").getByRole("alert");
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 }).or(loginError)).toBeVisible();
  if (await loginError.isVisible()) {
    const message = (await loginError.textContent())?.trim();
    throw new Error(
      `Sign-in failed for ${person}: "${message}". Check E2E_${person}_EMAIL and E2E_${person}_PASSWORD in .env.test.local.`,
    );
  }
  await page.waitForURL("**/dashboard");
  return { context, page };
}

// The dashboard shows "Signed in as <name>".
async function displayName(page: Page): Promise<string> {
  const strong = page.locator("main p", { hasText: "Signed in as" }).locator("strong");
  await expect(strong).toBeVisible();
  return (await strong.textContent())?.trim() ?? "";
}

async function createReport(
  page: Page,
  report: { type: "lost" | "found"; title: string; privateDetails?: string },
): Promise<string> {
  await page.goto("/report");
  await page.getByLabel(report.type === "found" ? "Found" : "Lost", { exact: true }).check();
  await page.getByLabel("Title", { exact: true }).fill(report.title);
  await page.getByLabel("Category", { exact: true }).selectOption("keys");
  // The first real location; the placeholder at index 0 can't be chosen.
  await page.getByLabel("Location", { exact: true }).selectOption({ index: 1 });
  await page
    .getByLabel("Description", { exact: true })
    .fill("A set of keys on a ring, left behind after class. Created by an automated test.");
  if (report.privateDetails) {
    await page.getByLabel("Private details (optional)").fill(report.privateDetails);
  }
  await page.getByRole("button", { name: "Save report" }).click();
  await page.waitForURL(ITEM_URL);
  return new URL(page.url()).pathname;
}

// Returns the new claim's path; the Server Action redirects there.
async function sendClaim(
  page: Page,
  itemUrl: string,
  button: "This is mine" | "I found this",
  message: string,
): Promise<string> {
  await page.goto(itemUrl);
  await claimButton(page, button).click();
  await page.getByLabel("Message").fill(message);
  await page.getByRole("button", { name: "Send claim" }).click();
  await page.waitForURL(CLAIM_URL);
  await expect(page.getByText(message)).toBeVisible();
  return new URL(page.url()).pathname;
}

async function closeIfActive(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator("main h1")).toBeVisible();
  const close = page.getByRole("button", { name: "Close report" });
  if ((await close.count()) === 0) return;
  await close.click();
  await page.getByRole("button", { name: "Yes, close report" }).click();
  await expect(page.getByText("This report is closed.")).toBeVisible();
}

// Signed-out visitors see the same label as a link, so match both.
function claimButton(page: Page, label: "This is mine" | "I found this") {
  return page
    .getByRole("main")
    .getByRole("button", { name: label, exact: true })
    .or(page.getByRole("main").getByRole("link", { name: label, exact: true }));
}

async function expectNotFound(page: Page, url: string, heading: string) {
  await page.goto(url);
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
}

function claimStatus(page: Page) {
  return page.locator("main dd strong").first();
}

function handoverSection(page: Page) {
  return page.locator("section", {
    has: page.getByRole("heading", { name: "Arrange the handover" }),
  });
}

// Each person's own email is in the header, so only the handover section is
// checked for the other person's details.
async function expectContact(
  page: Page,
  other: { otherName: string; otherEmail: string },
) {
  const section = handoverSection(page);
  await expect(section).toBeVisible();
  await expect(section).toContainText(HANDOVER_NOTE);
  await expect(section).toContainText(other.otherName);
  await expect(section).toContainText(other.otherEmail);
  await expect(section).toContainText(SAFETY_TIP);
}

function myReportsEntry(page: Page, title: string) {
  return page.getByRole("link", { name: new RegExp(title) });
}
