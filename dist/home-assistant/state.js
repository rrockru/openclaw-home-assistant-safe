import { canRead, canWrite } from "../security.js";
import { haRequest, readState } from "./rest-client.js";
function slimState(state) {
    return {
        entity_id: state.entity_id,
        state: state.state,
        attributes: state.attributes ?? {},
        last_changed: state.last_changed,
        last_updated: state.last_updated,
    };
}
export async function getState(config, entityId, signal) {
    if (!canRead(config, entityId))
        throw new Error(`Read access denied for entity: ${entityId}`);
    return slimState(await readState(config, entityId, signal));
}
export async function callPowerService(config, entityId, service, signal) {
    if (!canWrite(config, entityId))
        throw new Error(`Write access denied for entity: ${entityId}`);
    const separator = entityId.indexOf(".");
    if (separator <= 0 || separator === entityId.length - 1)
        throw new Error("Invalid Home Assistant entity_id");
    const domain = entityId.slice(0, separator);
    await haRequest(config, `/api/services/${encodeURIComponent(domain)}/${service}`, { method: "POST", body: JSON.stringify({ entity_id: entityId }) }, signal);
    let resultingState = null;
    try {
        if (canRead(config, entityId))
            resultingState = await getState(config, entityId, signal);
    }
    catch {
        // The state read is best-effort only after a successful service call.
    }
    return { ok: true, entity_id: entityId, service, resulting_state: resultingState };
}
//# sourceMappingURL=state.js.map