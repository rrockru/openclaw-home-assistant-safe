import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { configSchema } from "./config.js";
import { homeAssistantTools } from "./tools/home-assistant-tools.js";
export default defineToolPlugin({
    id: "home-assistant-safe",
    name: "Home Assistant Safe",
    description: "Least-privilege Home Assistant tools with entity-level ACLs and area-aware discovery.",
    configSchema,
    tools: homeAssistantTools,
});
//# sourceMappingURL=index.js.map