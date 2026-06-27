## IoT Simulation

The IoT simulator pretends to be the real world. It pretends to be houses with solar panels, and the smart meters attached to them. Its only job is this: **make up realistic energy numbers, and publish them over MQTT.**

### Project requirements

The following requirements need to be met before you set up the project

* Node.js **v24.5.0** or higher
* `npm` (latest version)

### How to Set Up

#### 1. Install Project Dependencies

To install the packages only, run the following:

```bash
npm ci
```

To install and also update the packages run the following:

```bash
npm install
```

#### 2. Configure Your Environment Profiles

```bash
cp .env.example .env
```

Open the freshly created `.env` file and verify that the `MQTT_HOST` and `MQTT_PORT` parameters match our active Docker configuration fields (defaults are set cleanly to localhost and 1883).

#### 3. Execute the Local Development Instance

To spin up the service in hot-reload development mode, run the following

```bash
npm run dev
```

#### 4. Run the Infrastructure Test Suites

To run tests:

```bash
npm run test
```

#### 5. Run lint checks and type validation

To run lint error checks, run the following:

```bash
npm run lint
```

To run typescript type checks, run the following:

```bash
npm run typecheck
```

To run both:

```bash
npm run validate
```

#### 6. To build and run the final executable

This is to test the production ready version of the app. It will compile to `dist` folder.

```bash
npm run build
npm run start
```

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