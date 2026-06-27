## IoT Simulation

The IoT simulator pretends to be the real world. It pretends to be houses with solar panels, and the smart meters attached to them. Its only job is this: **make up realistic energy numbers, and publish them over MQTT.**

### Full plan

The full plan of this service is located in [here](https://github.com/p2p-energy-trading-platform/docs/tree/main/plans/iot)

### Repository structure

The following repository structure is followed as per the above plan

```
iot-simulator/
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── config/
│   └── grids.yaml                  # all grid/house settings
├── src/
│   ├── index.ts                    # starts everything up
│   ├── config/
│   │   └── loadConfig.ts
│   ├── weather/
│   │   ├── openMeteoClient.ts       # calls Open-Meteo, one call per grid
│   │   ├── clearSkyFallback.ts      # backup model if Open-Meteo is down
│   │   └── weatherProvider.ts       # picks live data or fallback
│   ├── domain/
│   │   ├── Grid.ts
│   │   ├── House.ts
│   │   ├── SolarSimulator.ts
│   │   ├── LoadSimulator.ts          # archetype + scale factor logic
│   │   ├── FlexibleAssetSimulator.ts  # Holds asset details (batter, ev)
│   │   └── SmartMeter.ts            # combines everything into one reading
│   ├── mqtt/
│   │   ├── mqttClient.ts            # connecting, reconnecting
│   │   └── topics.ts                # topic naming, e.g. gridx/{grid_id}/{house_id}/meter
│   ├── scheduler/
│   │   └── tickLoop.ts              # decides when each meter publishes
│   ├── store/
│   │   └── simState.ts              # the simulator's own memory
│   └── types/
│       ├── payloads.ts              # the exact shapes
│       └── config.ts                # the exact shapes
├── test/
│   └── ...                         # tests for each piece above
└── README.md
```