const { LavalinkManager, EQList } = require("lavalink-client");
const { sources } = require("./constants.js");
const autoPlay = require("../functions/autoPlay.js");

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
          autoPlayFunction: autoPlay,
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
        name: "$joinVC",
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
        if (data.err) return d.error(data.err);

        const [ query, source = "youtube" ] = data.inside.splits;

        const player = client.lavalinkClient.getPlayer(d.guild?.id || d.channel?.guildId);

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

        try {
          if (position == 1) {
            trackInfo = player.queue.current?.info;
          } else if (position == 0) {
            trackInfo = player.queue.previous[0]?.info;
          } else {
            trackInfo = player.queue.tracks[position - 2]?.info;
          }  

          data.result = trackInfo[query.toLowerCase()];
        } catch {
          data.result = null;
        }

        return {
            code: d.util.setCode(data),
        }
      }
    }, {
      name: "$addFilter",
      type: "djs",
      code: async (d) => {
        const data = d.util.aoiFunc(d);
        if (data.err) return d.error(data.err);

        const [...filters] = data.inside.splits;

        const player = d.client.lavalinkClient.getPlayer(d.guild?.id || d.channel?.guildId);

        if (!player) return d.aoiError.fnError(d, "custom", {}, "No player found.");

        const EList = Object.keys(EQList);

        for (const filter of filters) {
          if (EList.includes(filter)) {
            await player.filterManager.setEQ(EQList[filter]);
          } else {
            d.aoiError.fnError(d, "custom", {}, `Invalid filter '${filter}', use the following: ${EList.join(", ")} `);
            break;
          }

          if (filter.toLowerCase() === "clear") {
            await player.filterManager.clearEQ();
          }
        }

        return {
          code: d.util.setCode(data)
        }
      }
    }, {
      name: "$clearFilters",
      type: "djs",
      code: async (d) => {
        const data = d.util.aoiFunc(d);
        if (data.err) return d.error(data.err);

        const player = d.client.lavalinkClient.getPlayer(d.guild?.id || d.channel?.guildId);

        if (!player) return d.aoiError.fnError(d, "custom", {}, "No player found.");

        await player.filterManager.clearEQ();

        return {
          code: d.util.setCode(data)
        }
      }
    }, {
      name: "$seek",
      type: "djs",
      code: async (d) => {
        const data = d.util.aoiFunc(d);
        if (data.err) return d.error(data.err);

        const [time] = data.inside.splits;

        if (!time) return d.aoiError.fnError(d, "custom", {}, "Time was not provided.");

        const player = d.client.lavalinkClient.getPlayer(d.guild?.id || d.channel?.guildId);

        if (!player) return d.aoiError.fnError(d, "custom", {}, "No player found.");

        if (time > player.queue.current.info.duration || time < 0) {
          await player.skip();
        } else {
          await player.seek(Number(time));
        }

        return {
          code: d.util.setCode(data)
        }
      }
    }, {
      name: "$skipTrack",
      type: "djs",
      code: async (d) => {
        const data = d.util.aoiFunc(d);

        const player = d.client.lavalinkClient.getPlayer(d.guild?.id || d.channel?.guildId);

        if (!player) return d.aoiError.fnError(d, "custom", {}, "No player found.");

        await player.skip(0, false);

        return {
          code: d.util.setCode(data)
        }
      }
    }, {
      name: "$skipTo",
      type: "djs",
      code: async (d) => {
        const data = d.util.aoiFunc(d);
        if (data.err) return d.error(data.err);

        const [to, throwError = "false"] = data.inside.splits;

        const player = d.client.lavalinkClient.getPlayer(d.guild?.id || d.channel?.guildId);

        if (!player) return d.aoiError.fnError(d, "custom", {}, "No player found.");

        await player.skip(to, throwError === "true");

        return {
          code: d.util.setCode(data)
        }
      }
    }, {
      name: "$stop",
      type: "djs",
      code: async (d) => {
        const data = d.util.aoiFunc(d);

        const player = d.client.lavalinkClient.getPlayer(d.guild?.id || d.channel?.guildId);

        if (!player) return d.aoiError.fnError(d, "custom", {}, "No player found.");

        await player.destroy();

        return {
          code: d.util.setCode(data)
        }
      }
    }, {
      name: "$clearQueue",
      type: "djs",
      code: async (d) => {
        const data = d.util.aoiFunc(d);

        const player = d.client.lavalinkClient.getPlayer(d.guild?.id || d.channel?.guildId);

        if (!player) return d.aoiError.fnError(d, "custom", {}, "No player found.");

        await player.stopPlaying(true, player.get("autoplay") == "true");

        return {
          code: d.util.setCode(data)
        }
      }
    }, {
      name: "$pause",
      type: "djs",
      code: async (d) => {
        const data = d.util.aoiFunc(d);

        const [clearQueue = "false", executeAutoplay = "false"] = data.inside.splits;

        const player = d.client.lavalinkClient.getPlayer(d.guild?.id || d.channel?.guildId);

        if (!player) return d.aoiError.fnError(d, "custom", {}, "No player found.");

        if (executeAutoplay) player.set("autoplay", true);

        await player.stopPlaying(clearQueue === "true", executeAutoplay === "true");

        return {
          code: d.util.setCode(data)
        }
      }
    }, {
      name: "$resumeTrack",
      type: "djs",
      code: async (d) => {
        const data = d.util.aoiFunc(d);

        const player = d.client.lavalinkClient.getPlayer(d.guild?.id || d.channel?.guildId);

        if (!player) return d.aoiError.fnError(d, "custom", {}, "No player found.");
        
        if (player.paused) await player.resume();

        return {
          code: d.util.setCode(data)
        }
      }
    }, {
      name: "$volume",
      type: "djs",
      code: async (d) => {
        const data = d.util.aoiFunc(d);
        if (data.err) return d.error(data.err);

        const [volume = "get"] = data.inside.splits;

        const player = d.client.lavalinkClient.getPlayer(d.guild?.id || d.channel?.guildId);

        if (!player) return d.aoiError.fnError(d, "custom", {}, "No player found.");

        if (volume === "get") {
          data.result = player.volume;
        } else {
          await player.setVolume(volume);
        }

        return {
          code: d.util.setCode(data)
        }
      }
    });
  }
}

module.exports = { lavalinkManager };