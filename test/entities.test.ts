import { describe, expect, it } from "vitest";
import { filterAndEnrichStates } from "../src/home-assistant/entities.js";
import type { RegistrySnapshot } from "../src/types.js";

const registry: RegistrySnapshot = {
  entities: new Map([
    [
      "sensor.living_temperature",
      { entity_id: "sensor.living_temperature", device_id: "dev-living", area_id: null },
    ],
    [
      "sensor.override_temperature",
      { entity_id: "sensor.override_temperature", device_id: "dev-bedroom", area_id: "living_room" },
    ],
  ]),
  devices: new Map([
    ["dev-living", { id: "dev-living", area_id: "living_room", name: "Living thermometer" }],
    ["dev-bedroom", { id: "dev-bedroom", area_id: "bedroom", name_by_user: "Bedroom thermometer" }],
  ]),
  areas: new Map([
    ["living_room", { area_id: "living_room", name: "Гостиная", aliases: ["Living room", "Зал"] }],
    ["bedroom", { area_id: "bedroom", name: "Спальня", aliases: [] }],
  ]),
};

const states = [
  {
    entity_id: "sensor.living_temperature",
    state: "25.59",
    attributes: { friendly_name: "Температура", device_class: "temperature", unit_of_measurement: "°C" },
  },
  {
    entity_id: "sensor.override_temperature",
    state: "24.00",
    attributes: { friendly_name: "Температура 2", device_class: "temperature", unit_of_measurement: "°C" },
  },
  {
    entity_id: "sensor.secret_temperature",
    state: "99",
    attributes: { device_class: "temperature", unit_of_measurement: "°C" },
  },
];

const config = {
  readableEntities: ["sensor.*"],
  blockedEntities: ["sensor.secret_*"],
};

describe("entity discovery", () => {
  it.each(["gostinaia", "Гостиная", "ГОСТИНАЯ"])(
    "resolves the production device-owned area topology by %s",
    (area) => {
      const productionRegistry: RegistrySnapshot = {
        areas: new Map([["gostinaia", { area_id: "gostinaia", name: "Гостиная" }]]),
        devices: new Map([
          [
            "cf3fe902afc641bc3841526d92c57175",
            {
              id: "cf3fe902afc641bc3841526d92c57175",
              area_id: "gostinaia",
              name: "Термометр",
            },
          ],
        ]),
        entities: new Map([
          [
            "sensor.a4_c1_38_85_3b_46_3b46_temperature",
            {
              entity_id: "sensor.a4_c1_38_85_3b_46_3b46_temperature",
              device_id: "cf3fe902afc641bc3841526d92c57175",
              area_id: null,
            },
          ],
        ]),
      };
      const productionStates = [
        {
          entity_id: "sensor.a4_c1_38_85_3b_46_3b46_temperature",
          state: "25.59",
          attributes: {
            friendly_name: "Температура",
            device_class: "temperature",
            unit_of_measurement: "°C",
          },
        },
      ];

      const result = filterAndEnrichStates(
        productionStates,
        { readableEntities: ["sensor.*"] },
        productionRegistry,
        { domain: "sensor", deviceClass: "temperature", area, limit: 50 },
      );

      expect(result).toMatchObject({ count: 1, matched: 1, truncated: false });
      expect(result.entities).toEqual([
        expect.objectContaining({
          entity_id: "sensor.a4_c1_38_85_3b_46_3b46_temperature",
          device_id: "cf3fe902afc641bc3841526d92c57175",
          device_name: "Термометр",
          area_id: "gostinaia",
          area_name: "Гостиная",
        }),
      ]);
    },
  );

  it("enriches states with device and area metadata", () => {
    const result = filterAndEnrichStates(states, config, registry, { area: "Гостиная", deviceClass: "temperature" });
    expect(result.count).toBe(2);
    expect(result.entities[0]).toMatchObject({
      entity_id: "sensor.living_temperature",
      device_name: "Living thermometer",
      area_id: "living_room",
      area_name: "Гостиная",
    });
  });

  it("inherits an area from the device when entity area_id is null", () => {
    const result = filterAndEnrichStates(
      states,
      config,
      registry,
      {
        domain: "sensor",
        deviceClass: "temperature",
        area: "Гостиная",
      },
    );

    expect(result.entities).toContainEqual(
      expect.objectContaining({
        entity_id: "sensor.living_temperature",
        device_id: "dev-living",
        area_id: "living_room",
        area_name: "Гостиная",
      }),
    );
  });

  it("uses entity area before device area", () => {
    const result = filterAndEnrichStates(states, config, registry, { area: "living_room" });
    expect(result.entities.map((entity) => entity.entity_id)).toContain("sensor.override_temperature");
  });

  it("inherits device areas independently of entity domain", () => {
    const lightState = {
      entity_id: "light.living_ceiling",
      state: "on",
      attributes: { friendly_name: "Ceiling" },
    };
    const lightRegistry: RegistrySnapshot = {
      ...registry,
      entities: new Map([
        ["light.living_ceiling", { entity_id: "light.living_ceiling", device_id: "dev-living", area_id: null }],
      ]),
    };

    const result = filterAndEnrichStates(
      [lightState],
      { readableEntities: ["light.*"] },
      lightRegistry,
      { domain: "light", area: "Гостиная" },
    );

    expect(result.entities[0]).toMatchObject({
      entity_id: "light.living_ceiling",
      area_id: "living_room",
    });
  });

  it("matches exact area aliases case-insensitively", () => {
    const result = filterAndEnrichStates(states, config, registry, { area: "зал" });
    expect(result.count).toBe(2);
  });

  it("filters ACLs before returning enriched data", () => {
    const result = filterAndEnrichStates(states, config, registry, {});
    expect(result.entities.some((entity) => entity.entity_id === "sensor.secret_temperature")).toBe(false);
  });

  it("reports truncation separately from matched count", () => {
    const result = filterAndEnrichStates(states, config, registry, { limit: 1 });
    expect(result.count).toBe(1);
    expect(result.matched).toBe(2);
    expect(result.truncated).toBe(true);
  });
});
