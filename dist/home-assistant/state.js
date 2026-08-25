import { canRead, canWrite, requireCanonicalEntityId } from "../security.js";
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
    const canonicalEntityId = requireCanonicalEntityId(entityId);
    if (!canRead(config, canonicalEntityId))
        throw new Error("Read access denied for entity");
    return slimState(await readState(config, canonicalEntityId, signal));
}
export async function callPowerService(config, entityId, service, signal) {
    const canonicalEntityId = requireCanonicalEntityId(entityId);
    if (!canWrite(config, canonicalEntityId))
        throw new Error("Write access denied for entity");
    const domain = canonicalEntityId.slice(0, canonicalEntityId.indexOf("."));
    await haRequest(config, `/api/services/${encodeURIComponent(domain)}/${service}`, { method: "POST", body: JSON.stringify({ entity_id: canonicalEntityId }) }, signal);
    let resultingState = null;
    try {
        if (canRead(config, canonicalEntityId))
            resultingState = await getState(config, canonicalEntityId, signal);
    }
    catch {
        // The state read is best-effort only after a successful service call.
    }
    return { ok: true, entity_id: canonicalEntityId, service, resulting_state: resultingState };
}
