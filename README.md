## aoi.js-lavalink

**aoi.js-lavalink** is a package used to bring the functionality of lavalink to aoi.js fast and easy.

### Installation

Get started by installing the latest version of **aoi.js-lavalink** within your project.

```bash
npm install aoi.js-lavalink@latest
```

Or if you're feeling lucky, install the development version with new features.

```bash
npm install github:aoi.js-lavalink
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

You can also use events in your command handler!

```js
const loader = new LoadCommands(client);
loader.load(client.cmd, "./commands");
```

Then in your file:

`/commands/trackStart.js`
```js
module.exports = {
  name: "some name", // optional!
  type: `trackStart`,
  channel: "some channel id", // optional!
  code: `Some code`
}
```

Aoi.js will display a "failed to load" error if you enable logging, but you can disregard that :)

Make sure you add the events to the events: [] in your lavalink setup to make them work.

You can also enable debug mode, to debug your issues. (will display when events are triggered, what events are registered)

`debug: true`

for that in your lavalink setup

---

### Functions

Absolutely! Here's the comprehensive list of all the functions in a modern README.md style:

### Music Player Functions

#### $joinVoice
Connects the bot to a specified voice channel.

```php
$joinVoice[voiceId;returnChannel?]
```

- `voiceId` (required)
- `returnChannel` (optional, default: "false")

Example:
```php
$joinVoice[123456789012345678;true]
```

#### $playTrack
Plays a track based on the query in the specified source.

```php
$playTrack[query;source?;guildId?]
```

- `query` (required)
- `source`[^2] (optional, default: "youtube")
- `guildId` (optional, default: current guild ID)

Example:
```php
$playTrack[Despacito;youtube;123456789012345678]
```

#### $trackInfo
Retrieves information about a track in the player's queue at a specific index.

```php
$trackInfo[index;property]
```

- `index` (required)
- `property` (required)

Example:
```php
$trackInfo[1;title]
```

#### $loop
Sets the loop type for the player (track, queue, none).

```php
$loop[type]
```

- `type` (required)

Example:
```php
$loop[track]
```

#### $loopStatus
Retrieves the current loop status of the player.

#### $skipTrack
Skips the currently playing track in the queue.

#### $skipTo
Skips to a specific track in the queue based on its index.

```php
$skipTo[index]
```

- `index` (required)

#### $seekTo
Seeks to a specific position (in milliseconds) in the currently playing track.

```php
$seekTo[ms]
```

- `ms` (required)

#### $removeTrack
Removes a track from the queue at the specified position.

```php
$removeTrack[position]
```

- `position` (required)

#### $getFilters
Retrieves filters applied to the player.

```php
$getFilters[type]
```

- `type` (required)

#### $toggleFilters
Toggles specified audio filters and returns applied filters if requested.

```php
$toggleFilters[filterType;returnFilters]
```

- `filterType` (required)
- `returnFilters` (optional, default: "false")

#### $setVolume
Sets the volume of the player.

```php
$setVolume[volume]
```

- `volume` (required)

#### $shuffleQueue
Shuffles the queue of tracks.

#### $unShuffleQueue
Restores the original order of the queue after shuffling.

#### $autoPlay
Enables or disables autoplay feature for the player.

```php
$autoPlay[source]
```

- `source`[^2] (optional, default: "youtube")

#### $searchTrack[query;index?;format?]
Searches for tracks based on the provided query and index.

- query (required)
- index? (optional, default: "0")
- format? (optional, default: false)

#### $pauseTrack
Pauses the currently playing track.

#### $resumeTrack
Resumes the paused track.

#### $playerStatus
Retrieves the status of the player.

### Events[^3]

| Event Names                        |                     Parameters                     | Description                                                     |
| ---------------------------------- | :------------------------------------------------: | --------------------------------------------------------------- |
| `nodeCreate`                       |                        node                        | Emitted once a node gets created                                |
| `nodeConnect` (**default**[^1])    |                        node                        | Emits when a node connects                                      |
| `nodeReconnect` (**default**[^1])  |                        node                        | Emits when a node attempts a reconnect                          |
| `nodeDisconnect` (**default**[^1]) | node, reason: `{ code?: number, reason?: string }` | Emits when a node disconnects                                   |
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

[^1]: Executed by default, no matter what.
      **Cannot be disabled as of now**, maybe in the future as another feature.

[^2]: Additional Sources besides YouTube and Soundcloud require additional setup on your side.
      Including the editing of your **application.yml** and more.

[^3]: Events are used to emit Player Events, example usage of using events:
      ```js
        <lavalinkInstance>.on(<event>, {
            code: `
                Your aoi.js code
            `
        });
        ```

      Channel, author and guild are automatically passed, meaning you can use guild, channel and author related functions without any issues.
