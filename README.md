## aoi.js-lavalink

**aoi.js-lavalink** is a package used to bring the functionality of lavalink to aoi.js fast and easy.

### Installation

Get started by installing the latest version of this package within your project.

```bash
npm install github:faf4a/lavalink
```

---

### Setup

To add the functionality to your client, we have to import the `lavalinkManager` class.

```js
const { AoiClient, LoadCommands } = require("aoi.js");
const { lavalinkManager } = require("aoi.js-lavalink");

const client = new AoiClient({
  token: "DISCORD BOT TOKEN",
  prefix: "DISCORD BOT PREFIX",
  intents: ["MessageContent", "Guilds", "GuildMessages", "GuildVoiceStates"],
  events: ["onInteractionCreate", "onMessage"],
  database: {
    type: "aoi.db",
    db: require("@akarui/aoi.db"),
    dbType: "KeyValue",
    tables: ["main"],
    securityKey: "a-32-characters-long-string-here",
  },
});

const lavalink = new lavalinkManager(client, {
  host: "0.0.0.0", // Server Address
  port: 0000, // Server Port
  password: "youshallnotpass", // Lavalink Server Password
  secure: false, // HTTP/HTTPS protocol
  events: ["trackStart", "trackEnd"], // Array of events that can be used.
  // debug: true // Used to enable debugging, not pretty but could help to debug your issues.
});

// Adding events
lavalink.addEvent("trackStart", {
  code: `$log[Now playing $trackInfo[uri]!]`
});
```

(No lavalink server? https://lavalink.moebot.pro/non-ssl check this out!)

### Events[^3]

| Event Names                        |                     Parameters                     | Description                                                     |
| ---------------------------------- | :------------------------------------------------: | --------------------------------------------------------------- |
| `nodeCreate`                       |                        node                        | Emitted once a node gets created                                |
| `nodeConnect`                      |                        node                        | Emits when a node connects                                      |
| `nodeReconnect`                    |                        node                        | Emits when a node attempts a reconnect                          |
| `nodeDisconnect`                   | node, reason: `{ code?: number, reason?: string }` | Emits when a node disconnects                                   |
| `nodeError`                        |                    node, error                     | Emits when a node throws errors                                 |
| `nodeRaw`                          |                      payload                       | Emits every payload from a Node                                 |
| `playerCreate`                     |                       player                       | Emits when a player gets created                                |
| `playerDestroy`                    |                       player                       | Emits when a player gets destroyed                              |
| `queueEnd`                         |               player, track, payload               | Emits when the queue End                                        |
| `playerMove`                       |          player, initChannel, newChannel           | Emits when the player moves from a Voice Channel to another one |
| `playerDisconnect`                 |                 player, oldChannel                 | Emits when the player Leaves the VC                             |
| `trackStart`                       |               player, track, payload               | Emits when a track starts to play                               |
| `trackEnd`                         |               player, track, payload               | Emits when a track ends playing                                 |
| `trackStuck`                       |               player, track, payload               | Emits when a track gets stucked and skips the track             |
| `trackError`                       |               player, track, payload               | Emits when a track errors and skips it                          |
| `socketClosed`                     |                  player, payload                   | Emits when a connection gets closed                             |
