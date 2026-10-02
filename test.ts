// Optional live smoke test. Run only when you intend to use your Groq quota.
process.loadEnvFile(".env");
import { ResearchInputSchema } from "./src/lib/schemas";
import { runPipeline } from "./src/lib/research-engine";
import { getProvider } from "./src/lib/providers";

async function main() {
  const provider = getProvider();
  
  const input = {
    productName: "Test",
    description: "Test description long enough to pass validation.",
    targetAudience: "Developers",
    evidence: []
  };

  try {
    const result = await runPipeline(ResearchInputSchema.parse(input), provider);
    console.log("Success! Clusters:", result.objectionClusters?.length, "Recs:", result.recommendations.length);
  } catch (e) {
    console.error("Failed:", e);
    process.exitCode = 1;
  }
}
main();
