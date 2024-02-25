const fs = require("node:fs");
const path = require("path");
const { LavalinkManager } = require("lavalink-client");
const autoPlayFunction = require("../functions/autoPlay.js");

class lavalinkManager {
  constructor(client, options) {
    this.client = client;
    this.options = options;
    this.events = {};
    this.connect();
  }

  addEvent(eventName, options) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(options);
  }

  async connect() {
    // Wait for the client to be ready
    await new Promise((resolve) => {
      this.client.once("ready", () => {
          resolve();
      });
    });

    const manager = new LavalinkManager({
      nodes: [
        {
          host: this.options.host,
          port: this.options.port,
          authorization: this.options.password || "",
          secure: this.options.secure || false,
        },
      ],
      playerOptions: {
        onEmptyQueue: {
          // destroyAfterMs: 30_000, // 0 === instantly destroy | don't provide the option, to don't destroy the player
          // autoPlayFunction: autoPlayFunction,
        },
      },
      client: {
        id: this.client.user.id,
        username: this.client.user.username,
      },
      sendToShard: (guildId, payload) =>
        this.client.guilds.cache.get(guildId)?.shard?.send(payload),
    });

    this.client.lavalinkClient = manager;

    this.client.lavalinkClient.events = this.events;

    this.client.on("raw", d => manager.sendRawData(d));

    manager.on("queueEnd", async (player) => {
      if (player.get("autoplay") === false) return;
      await autoPlayFunction(player, player.queue.previous[0], this.client);
    });

    //config

    manager.config = {}
    manager.config.defaultVolume = 100;

    for (const eventName in this.events) {
      manager.on(eventName, async (player, node, payload) => {
        for (const event of this.events[eventName]) {
          const channel = this.client.channels.cache.get(event.channel) || this.client.channels.cache.get(player.textChannelId) || undefined;
          const guild = this.client.guilds.cache.get(player.guildId) || undefined;

          await this.client.functionManager.interpreter(
            this.client,
            {
              guild: guild,
              author: player.queue?.current?.requester || undefined,
              channel: channel,
            },
            [],
            { name: event.name, code: event.code },
            this.client.db,
            false,
            channel,
            {},
            channel,
            true
          );
        }
      });
    }

    await manager.init({ ...this.client.user });

    this.createFunctions(this.client);
  }

  async createFunctions() {

    const client = this.client;

      this.client.functionManager.createFunction({
        name: "$joinVoice",
        type: "djs",
        code: async (d) => {
          const data = d.util.aoiFunc(d);

          const [ voiceID, selfDeaf = "true", selfMute = "false" ] = data.inside.splits;
      
          const channel = d.util.getChannel(d, voiceID);

          const oldPlayer = client.lavalinkClient.getPlayer(channel.guildId);

          if (oldPlayer) await oldPlayer.destroy();
      
          const player = await client.lavalinkClient.createPlayer({
              guildId: channel.guildId, 
              voiceChannelId: voiceID, 
              textChannelId: d.channel.id, 
              selfDeaf: selfDeaf === "true", 
              selfMute: selfMute === "true",
              instaUpdateFiltersFix: true,
              applyVolumeAsFilter: false,
          });
      
          await player.connect();
      
          return {
              code: d.util.setCode(data),
          }
      }
    }, {
      name: "$leaveVoice",
      type: "djs",
      code: async (d) => {
        const data = d.util.aoiFunc(d);

        const [ guildId = d.guild?.id ] = data.inside.splits;

        const player = client.lavalinkClient.getPlayer(guildId);

        if (!player) return d.aoiError.fnError(d, "custom", { inside: data.inside }, "No player found.");

        await player.destroy();

        return {
            code: d.util.setCode(data),
        }
      }
    }, {
      name: "$playTrack",
      type: "djs",
      code: async (d) => {
        const data = d.util.aoiFunc(d);

        const [ query, source = "youtube" ] = data.inside.splits;

        const player = client.lavalinkClient.getPlayer(d.guild?.id || d.channel?.guildId);

        const sources = [{
          name: "youtube",
          source: "ytsearch"
        }, {
          name: "youtubemusic",
          source: "ytmsearch"
        }, {
          name: "soundcloud",
          source: "scsearch"
        }, {
          name: "deezer",
          source: "dzsearch"
        }, {
          name: "spotify",
          source: "spsearch"
        }, {
          name: "applemusic",
          source: "amsearch"
        }]

        if (!player) return d.aoiError.fnError(d, "custom", { inside: data.inside }, "No player found.");

        const response = await player.search({ query: query, source: sources[source.toLowerCase()] }, d.author);
      
        if (!response || !response.tracks?.length) return d.aoiError.fnError(d, "custom", { inside: data.inside }, "No tracks found.");

        await player.queue.add(response.loadType === "playlist" ? response.tracks : response.tracks[0]);

        if (!player.playing) await player.play({ volume: client.lavalinkClient.config.defaultVolume, paused: false });

        return {
            code: d.util.setCode(data),
        }
      }
    }, {
      name: "$autoPlay",
      type: "djs",
      code: async (d) => {
        const data = d.util.aoiFunc(d);

        const [ enable = "true", returnState = "false" ] = data.inside.splits;

        const player = client.lavalinkClient.getPlayer(d.guild?.id || d.channel?.guildId);

        if (!player) return d.aoiError.fnError(d, "custom", { inside: data.inside }, "No player found.");

        await player.set("autoplay", enable === "true");

        data.result = returnState === "true" ? player.get("autoplay") : null;

        return {
            code: d.util.setCode(data),
        }
      }
    }, {
      name: "$trackInfo",
      type: "djs",
      code: async (d) => {
        const data = d.util.aoiFunc(d);

        const [ query = "title", position = "1" ] = data.inside.splits;

        const player = client.lavalinkClient.getPlayer(d.guild?.id || d.channel?.guildId);

        if (!player) return d.aoiError.fnError(d, "custom", { inside: data.inside }, "No player found.");

        let trackInfo;

        if (position === 1) {
          trackInfo = player.queue.current.info;
        } else {
          trackInfo = player.queue.tracks[position - 1].info;
        }

        data.result = trackInfo[query.toLowerCase()];

        return {
            code: d.util.setCode(data),
        }
      }
    });
  }
}

module.exports = { lavalinkManager };