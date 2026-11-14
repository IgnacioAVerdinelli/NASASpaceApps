# System architecture

How the pieces of our astronaut health monitor fit together. This page follows Juan's sketch of 14 November 2026 ([original drawing](img/architecture-sketch.png)).

```mermaid
flowchart LR
    subgraph SC["Spacecraft: everything here runs on board"]
        direction LR
        subgraph SRC["Sources"]
            direction TB
            SENS["<b>Sensors 1…n</b><br/>[instruments]<br/>dynamometer · DXA · cycle · wearables"]
            GEN["<b>Generator</b><br/>[Python · gravsim]<br/>demo only, fitted to NASA bed-rest data"]
        end
        subgraph SYS["Health monitor: our system"]
            DS["<b>DataService</b><br/>[Python]<br/>cleans, converts units<br/>holds raw + processed data"]
            DB[("<b>Database</b><br/>[SQLite]<br/>readings + results<br/>inert in the demo")]
            HS["<b>HealthService</b><br/>[Python]<br/>processes the data<br/>model: clean, train, I/O"]
            FE["<b>Frontend</b><br/>[React · three.js]<br/>3D body view, bone view"]
            TL["<b>Analysis schedule</b><br/>[possible service]<br/>when each test is due"]
            Q[["<b>Queue</b><br/>[message queue]"]]
            NS["<b>Notification system</b><br/>[service]"]
        end
        AST["<b>Astronauts</b><br/>wearables, room displays"]
        SHIP["<b>Ship center</b>"]
        RADIO["<b>Radio system</b>"]
    end
    EARTH["<b>Earth space center</b><br/>on the ground"]

    SENS -->|readings| DS
    GEN -.->|simulated readings| DS
    DS <-->|stores, queries| DB
    DS -->|timelines| HS
    HS -->|processed results| DS
    HS -->|dashboard JSON, HTTP| FE
    HS -.->|test plan| TL
    HS -.->|alerts| Q
    Q -.-> NS
    NS -.-> AST
    NS -.-> SHIP
    NS -.-> RADIO
    NS -.-> EARTH

    classDef built fill:#edf3fc,stroke:#1c5dc2,stroke-width:1.5px,color:#141920
    classDef planned fill:#ffffff,stroke:#7b8494,stroke-dasharray:5 4,color:#141920
    classDef demo fill:#fdf1ea,stroke:#c2410c,stroke-dasharray:5 4,color:#141920
    classDef ext fill:#ffffff,stroke:#7b8494,color:#141920
    class DS,DB,HS,FE built
    class TL,Q,NS planned
    class GEN demo
    class SENS,AST,SHIP,RADIO,EARTH ext
    style SC fill:#f8f9fb,stroke:#7b8494,stroke-dasharray:2 5,color:#4a5262
    style SYS fill:#f3f7fd,stroke:#1c5dc2,stroke-dasharray:7 5,color:#1c5dc2
    style SRC fill:#f8f9fb,stroke:#c1c7d1,color:#4a5262
```

Legend: blue boxes are our system and built; dashed grey boxes are planned; the dashed orange box exists only for the demo; white boxes are outside our system. Solid arrows carry data today; dashed arrows are planned or demo only.

## The parts

| Part | What it does | State |
|---|---|---|
| **Sensors** | Instruments on board that measure the crew: dynamometer, DXA scanner, cycle ergometer with gas analyser, wearables. | We have none. The generator stands in for them. |
| **Generator** (`gravsim`) | Produces readings for a crew member on any mission day. It follows curves fitted from the NASA bed-rest data in `data/nlsp/` (the distribution in the sketch). You can set each person's exercise routine, make them lose faster than most, add an injury, or break an instrument. | Built: `sim/` on branch `feat/sensor-simulator`. |
| **DataService** | Holds all the data, raw and processed. Every reading, from a real sensor or from the generator, goes through the same steps: clean it (missing values, duplicates, impossible values, timestamps) and convert it to one unit per measure (for example, beats per second become beats per minute). It also keeps what the HealthService computes. Answers requests for a crew member's timeline and for past results. | Built: `sim/` on `feat/sensor-simulator`, being polished now. |
| **Database** | Stores real sensor data, imported historical data and the processed results (one table for readings, one for results). | Exists but does nothing yet: the schema is defined, and for the challenge every reading comes from the generator. |
| **HealthService** (Python) | Reads from the DataService and processes the data for the other parts. Today it builds the JSON the 3D page shows: changes per muscle group and charts over time. Everything it computes is saved back through the DataService, so results are kept and can be compared later. The model work lives here: data cleaning and processing, training, inputs and outputs. | First version built (the dashboard builder in `sim/`); the model is not started. |
| **Frontend** | 3D body that colours each muscle group by how much it has changed, with a bone view. Reads the HealthService's JSON (contract in `docs/frontend-backend.md` on branch `design-body`). | In progress on `design-body`. |
| **Timeline / analysis schedule** | Decides when each test or analysis is due. Today the generator follows NASA's routine (strength every 30 days, VO2peak on flight days 14, 75, 165, bone scans only before and after flight). May become its own service. | Idea; the NASA routine exists inside the generator. |
| **Queue and notification system** | Sends alerts from the HealthService to whoever needs them: the Earth space center, the ship's center, the astronauts (through wearables and room displays) and the radio system. | Planned, not built. |

## What we can measure

| Measure | Covered by our data |
|---|---|
| Bone density | Yes (DXA, MR035G) |
| Muscle strength | Yes (dynamometer, MR079G) |
| Aerobic capacity | Yes (cycle test, MR080G) |
| Muscle mass | Partly: lean mass by body region from the same DXA scans |
| Eye exam | No |
| Venous ultrasound | No |

## Things to keep in mind

- All data in the demo is synthetic. It comes from bed-rest studies on Earth (NASA's ground analog for weightlessness), not from spaceflight, and the app has to say so.
- The bed-rest studies lasted 21 to 90 days. Anything longer is the fitted curve continued, and readings past that point are flagged as extrapolated.
