import { describe, expect, it } from "vitest";
import { AI_PURPOSES, NullAiProvider } from "@/domain/ai/provider";

describe("the AI provider abstraction", () => {
  it("names every place Joy uses AI, as data", () => {
    // The §10 vendor review's question — "what reaches the provider?" — has a
    // one-file answer only while every use is a listed purpose.
    expect(AI_PURPOSES).toContain("assessment_section_draft");
    expect(AI_PURPOSES).toContain("moment_draft");
  });

  it("the null provider refuses loudly rather than faking a draft", async () => {
    // §41: absent means absent and says so. A null provider returning
    // plausible text would be fake success with extra steps.
    const provider = new NullAiProvider();
    await expect(
      provider.draft({ purpose: "intake_draft", input: "call notes", instruction: "summarise" }),
    ).rejects.toThrow(/No AI provider is configured/);
  });
});
