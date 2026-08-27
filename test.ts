import { config } from "dotenv";
config({ path: ".env" });
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
    const result = await runPipeline(input as any, provider);
    console.log("Success! Clusters:", result.objectionClusters.length, "Recs:", result.recommendations.length);
  } catch (e) {
    console.error("Failed:", e);
  }
}
main();
