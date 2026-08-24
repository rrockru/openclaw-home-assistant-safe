import { canRead } from "../security.js";
function stringAttribute(state, key) {
    const value = state.attributes?.[key];
    return typeof value === "string" ? value : null;
}
function normalize(value) {
    return value.trim().toLocaleLowerCase();
}
function resolveArea(entity, device, registry) {
    const areaId = entity?.area_id ?? device?.area_id ?? null;
    return areaId ? registry.areas.get(areaId) : undefined;
}
function areaMatches(area, query) {
    if (!query)
        return true;
    if (!area)
        return false;
    const needle = normalize(query);
    if (normalize(area.area_id) === needle || normalize(area.name) === needle)
        return true;
    return (area.aliases ?? []).some((alias) => normalize(alias) === needle);
}
function compactState(state, registry) {
    const entity = registry.entities.get(state.entity_id);
    const device = entity?.device_id ? registry.devices.get(entity.device_id) : undefined;
    const area = resolveArea(entity, device, registry);
    return {
        entity_id: state.entity_id,
        state: state.state,
        friendly_name: stringAttribute(state, "friendly_name") ?? entity?.name ?? entity?.original_name ?? null,
        device_class: stringAttribute(state, "device_class"),
        unit_of_measurement: stringAttribute(state, "unit_of_measurement"),
        device_id: device?.id ?? null,
        device_name: device?.name_by_user ?? device?.name ?? null,
        area_id: area?.area_id ?? null,
        area_name: area?.name ?? null,
        area_aliases: area?.aliases ?? [],
    };
}
export function filterAndEnrichStates(states, config, registry, filters) {
    const domain = filters.domain?.trim().toLocaleLowerCase();
    const deviceClass = filters.deviceClass?.trim().toLocaleLowerCase();
    const limit = filters.limit ?? 200;
    const matched = states
        .filter((state) => canRead(config, state.entity_id))
        .filter((state) => !domain || state.entity_id.toLocaleLowerCase().startsWith(`${domain}.`))
        .map((state) => compactState(state, registry))
        .filter((state) => !deviceClass || state.device_class?.toLocaleLowerCase() === deviceClass)
        .filter((state) => {
        if (!filters.area)
            return true;
        const area = state.area_id ? registry.areas.get(state.area_id) : undefined;
        return areaMatches(area, filters.area);
    });
    const entities = matched.slice(0, limit);
    return {
        count: entities.length,
        matched: matched.length,
        truncated: matched.length > entities.length,
        entities,
    };
}
//# sourceMappingURL=entities.js.map