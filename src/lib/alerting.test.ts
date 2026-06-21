import { describe, expect, it } from "vitest";
import { emailRecipients } from "@/lib/alert-recipients";

describe("alerting", () => {
  it("merges legacy and modern email recipient fields", () => {
    expect(
      emailRecipients({
        email: "legacy@example.com",
        emails: ["primary@example.com", "legacy@example.com"],
      }),
    ).toEqual(["primary@example.com", "legacy@example.com"]);
  });
});
