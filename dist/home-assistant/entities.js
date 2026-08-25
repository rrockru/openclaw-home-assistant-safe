import { createEntityAccessPolicy } from "../security.js";
function stringAttribute(state, key) {
    const value = state.attributes?.[key];
    return typeof value === "string" ? value : null;
}
function normalize(value) {
    return value.trim().toLowerCase();
}
function resolveEffectiveAreaId(entity, device) {
    return entity?.area_id ?? device?.area_id ?? null;
}
function resolveEntityContext(entityId, registry) {
    const entity = registry.entities.get(entityId);
    const device = entity?.device_id ? registry.devices.get(entity.device_id) : undefined;
    const effectiveAreaId = resolveEffectiveAreaId(entity, device);
    return {
        entity,
        device,
        effectiveAreaId,
        area: effectiveAreaId ? registry.areas.get(effectiveAreaId) : undefined,
    };
}
function matchingAreaIds(registry, query) {
    if (query === undefined || query.length === 0)
        return undefined;
    const needle = normalize(query);
    const matchingIds = new Set();
    for (const area of registry.areas.values()) {
        if (normalize(area.area_id) === needle
            || normalize(area.name) === needle
            || (area.aliases ?? []).some((alias) => normalize(alias) === needle)) {
            matchingIds.add(area.area_id);
        }
    }
    return matchingIds;
}
function compactState(state, context, deviceClass) {
    const { entity, device, area } = context;
    return {
        entity_id: state.entity_id,
        state: state.state,
        friendly_name: stringAttribute(state, "friendly_name") ?? entity?.name ?? entity?.original_name ?? null,
        device_class: deviceClass,
        unit_of_measurement: stringAttribute(state, "unit_of_measurement"),
        device_id: device?.id ?? null,
        device_name: device?.name_by_user ?? device?.name ?? null,
        area_id: area?.area_id ?? null,
        area_name: area?.name ?? null,
        area_aliases: area?.aliases ?? [],
    };
}
export function filterAndEnrichStates(states, config, registry, filters) {
    const domain = filters.domain === undefined ? undefined : normalize(filters.domain);
    const deviceClass = filters.deviceClass === undefined ? undefined : normalize(filters.deviceClass);
    const areaIds = matchingAreaIds(registry, filters.area);
    const limit = filters.limit ?? 200;
    const access = createEntityAccessPolicy(config);
    const entities = [];
    let matched = 0;
    for (const state of states) {
        if (!access.canRead(state.entity_id))
            continue;
        if (domain && !state.entity_id.toLowerCase().startsWith(`${domain}.`))
            continue;
        const stateDeviceClass = stringAttribute(state, "device_class");
        if (deviceClass && (!stateDeviceClass || normalize(stateDeviceClass) !== deviceClass))
            continue;
        const context = resolveEntityContext(state.entity_id, registry);
        if (areaIds && (!context.effectiveAreaId || !areaIds.has(context.effectiveAreaId)))
            continue;
        matched += 1;
        if (entities.length < limit) {
            entities.push(compactState(state, context, stateDeviceClass));
        }
    }
    return {
        count: entities.length,
        matched,
        truncated: matched > entities.length,
        entities,
    };
}
//# sourceMappingURL=entities.js.map