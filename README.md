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

This also installs the Husky Git hooks used by the project.

To install and also update the packages run the following:

```bash
npm install
```

#### 2. Configure Your Environment Profiles

```bash
cp .env.example .env
```

Open the freshly created `.env` file and verify that the `MQTT_HOST` and `MQTT_PORT` parameters match our active Docker configuration fields (defaults are set cleanly to localhost and 1883).

The timing settings are read at startup. A value that is not a positive number stops the simulator with an error instead of being ignored.

| Variable | Default | Meaning |
|---|---|---|
| `TICK_INTERVAL_MS` | `5000` | How often every meter publishes a reading |
| `HEARTBEAT_INTERVAL_MS` | `60000` | How often every meter publishes a heartbeat. One heartbeat per house is also sent immediately at startup |
| `WEATHER_SYNC_INTERVAL_MS` | `900000` | How long one Open-Meteo reading is reused per grid. While Open-Meteo is unreachable, the clear-sky fallback is used and the API is retried after about a minute |
| `OPEN_METEO_BASE_URL` | Open-Meteo forecast URL | Weather API endpoint |

House IDs **and** house attributes (panel size, battery, load profile) are derived deterministically from the house ID, so a restart produces exactly the same houses.

#### Battery actuation

Publish a setpoint to `gridx/actuation`:

```json
{"house_id": "grid01-house0001", "asset_id": "bat-grid01-house0001", "power_kw": 2.0}
```

`power_kw` is positive to charge and negative to discharge. The setpoint stays in force on every tick until another command replaces it (send `0` to stop). It is clamped to the asset's charge and discharge limits, and charging or discharging stops on its own at 100 % or 0 %. Each reading reports the applied `power_kw` and the new `soc_pct`, and `net_kw = solar_kw - consumption_kw - sum(power_kw)`. Setpoints live in memory and reset when the simulator restarts.

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

### Commit message standard

Husky checks every commit message before Git creates the commit. Use this format:

```text
type(scope): short summary
```

The scope is optional. The allowed types are `feat`, `fix`, `doc`, `style`,
`refactor`, `perf`, `test`, `chore`, and `remove`. Write the summary in
lowercase, present tense, without a period at the end.

Examples:

```text
feat(mqtt): add meter reading publisher
fix: handle missing grid configuration
doc(readme): clarify local setup
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
│   │   ├── HouseFactory.ts          # generates houses per grid from config ratios
│   │   ├── SolarSimulator.ts
│   │   ├── LoadSimulator.ts          # archetype + scale factor logic
│   │   ├── FlexibleAssetSimulator.ts  # Holds asset details (battery, ev)
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
