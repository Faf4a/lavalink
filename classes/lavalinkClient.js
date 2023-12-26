const { Manager } = require("erela.js");
const { EventEmitter } = require("events");
const chalk = require("chalk");
const fs = require("fs");
const path = require("path");
class lavalinkManager extends EventEmitter {
  /**
   * Constructs a new instance of the LavalinkClient class.
   * @param {Client} client - The aoi.js client.
   * @param {Object} options - The options for the Lavalink client.
   */
  constructor(client, options) {
    super();
    this.client = client;
    this.options = options;
    this.events = options.events || [];
    this.customEvents = {};
    //this.destroy();
    this.connect();
    //this.eventListeners();
    this.createFunctions();
  }

  async addEvent(event, options) {
    this.customEvents[event] = {
      name: options.name ?? event,
      type: event,
      code: options.code,
      channel: options.channel ?? "default",
    };
  }

  async connect() {
    await new Promise((resolve) => {
      this.client.once("ready", () => {
        setTimeout(() => {
          resolve();
        }, 100);
      });
    });

    const __dir = this.client?.loader.paths[0]?.path ?? undefined;

    this.client.lavalinkManager = new Manager({
      user: this.client.user.id,
      clientName: this.client.user.username,
      nodes: [
        {
          identifier: "Main Node",
          host: this.options.host,
          port: this.options.port,
          password: this.options.password,
          retryDelay: 2500,
          retryAmount: this.options.retryAmount || 7,
          // version: "v4",
          // useVersionPath: true,
          secure: this.options.secure,
        },
      ],
      send: (id, payload) => {
        const guild = this.client.guilds.cache.get(id);
        if (!guild) return;
        guild.shard.send(payload);
      },
    });

    if (__dir) {
      const events = ["nodeCreate", "nodeReconnect", "nodeDisconnect", "nodeConnect", "nodeError", "nodeRaw", "playerCreate", "playerDestroy", "queueEnd", "playerMove", "playerDisconnect", "trackStart", "trackEnd", "trackStuck", "trackError", "socketClosed"]
      fs.readdir(__dir, async (err, commands) => {
        if (err) return console.error(`${chalk.red(`•`)} ${chalk.grey(`${(new Date).toLocaleString().split(", ")[1]}`)} Failed to load events with reason: ${err}`)

    
        for (const command of commands) {
          const __path = path.join(__dir, command);
          try {
            const event = require(__path);
            if (event && event.type && event.code) {
              if (events.includes(event.type)) {
                this.customEvents[event.type] = {
                  name: event?.name ?? event.type,
                  type: event.type,
                  code: event.code,
                  channel: event?.channel ?? "default",
                }
              }
            }
          } catch (err) {
            return console.error(`${chalk.red(`•`)} ${chalk.grey(`${(new Date).toLocaleString().split(", ")[1]}`)} Failed to load events with reason: ${err}`)
          }
        }
      });
    }

    this.client.lavalinkManager
      .on("nodeConnect", (node) => {
        console.log(
          `\r${chalk.green(`•`)} ${chalk.grey(`${(new Date).toLocaleString().split(", ")[1]}`)} Connection to ${chalk.underline.blue(
            node.options.identifier
          )} ${chalk.grey(node.options.host)} succeeded`
        );
      })
      .on("nodeReconnect", (node) => {
        node.options.retryDelay = node.options.retryDelay + 500;
        console.log(
          `\r${chalk.yellow(`•`)} ${chalk.grey(`${(new Date).toLocaleString().split(", ")[1]}`)} ${chalk.grey(
            `[attempt: ${node.reconnectAttempts}]`
          )} Attempting to reinstate the connection to ${chalk.underline.blue(
            node.options.identifier
          )} ${chalk.grey(node.options.host)}.`
        );

        if (node.reconnectAttempts >= 6) {
          console.error(
            `\r${chalk.red(`•`)} ${chalk.grey(`${(new Date).toLocaleString().split(", ")[1]}`)} Connection to ${chalk.underline.blue(
              node.options.identifier
            )} ${chalk.grey(node.options.host)} destroyed.`
          );
        }
      })
      .on("nodeDisconnect", (node) => {
        if (node.reconnectAttempts > 6) return;
        console.error(
          `${chalk.red(`•`)} ${chalk.grey(`${(new Date).toLocaleString().split(", ")[1]}`)} Connection to ${chalk.underline.blue(
            node.options.identifier
          )} ${chalk.grey(node.options.host)} disconnected unexpectedly.`
        );
      })
      .on("queueEnd", async (player) => {
        if (!player) return;
        if (player?.get("autoplay")?.enabled !== true) return;
        const previous =
          player.queue.previous || player.get("autoplay").previous;
        const volume = player.get("volume")?.level || 90;
        if (!previous) return;

        const result = await this.client.lavalinkManager.search(
          {
            query: `https://www.youtube.com/watch?v=${previous.identifier}&list=RD${previous.identifier}`,
            source: player.get("autoplay").source,
          },
          player.get("autoplay").requester,
          player.node
        );

        const next =
          result.tracks[
            Math.floor(Math.random() * Math.floor(result.tracks.length))
          ];
        if (!next) return;

        player.set("autoplay", {
          requester: player.get("autoplay").requester,
          source: player.get("autoplay").source,
          previous: next,
          enabled: player.get("autoplay").enabled,
        });

        await player.queue.add(next);

        if (!player.playing && (player.queue?.size || 0) === 0) {
          player.pause(false);
          await player.play({
            pause: false,
            volume,
            startTime: 0,
          });
        }

        player.queue.add(
          result.tracks[
            Math.floor(Math.random() * Math.floor(result.tracks.length))
          ]
        );
      });

    this.events.forEach((event) => {
      this.client.lavalinkManager.on(
        event,
        async (player, node, reason, payload, initChannel, newChannel) => {
          const code = this.customEvents[event]?.code;
          const channel =
            this.client.channels.cache.get(this.customEvents[event]?.channel) ||
            this.client.channels.cache.get(player.textChannel) ||
            undefined;
          if (!code) return console.error(`${chalk.grey(`• ${(new Date).toLocaleString().split(", ")[1]}`)} Event "${event}" triggered but code is ${chalk.gray("undefined")}`);
          const guild = this.client.guilds.cache.get(player.guild) || undefined;
          if (!channel || !guild) return console.error(`${chalk.grey(`• ${(new Date).toLocaleString().split(", ")[1]}`)} Event "${event}" triggered but channel or guild is ${chalk.gray("undefined")}`);
          await this.client.functionManager.interpreter(
            this.client,
            {
              guild,
              author: player.queue?.current.requester || undefined,
              channel: channel || undefined,
            },
            [],
            { code },
            this.client.db,
            false,
            channel,
            {},
            channel,
            true
          );
          if (Boolean(this.options.debug) === true) console.log(`${chalk.grey(`• ${(new Date).toLocaleString().split(", ")[1]}`)} Event "${event}" triggered`);
        }
      );
    });

    await this.client.lavalinkManager.init(this.client.user.id, {
      shards: this.client.ws.totalShards,
      clientName: this.client.user.username,
      clientId: this.client.user.id,
    });

    this.client.lavalinkManager.commands = this.customEvents;
    if (Boolean(this.options.debug) === true && this.customEvents.length !== 0) console.log(`${chalk.grey(`• ${(new Date).toLocaleString().split(", ")[1]}`)} Loaded ${Object.keys(this.client.lavalinkManager.commands).length} custom events`);

    this.client.on("raw", (data) => {
      switch (data.t) {
        case "VOICE_SERVER_UPDATE":
        case "VOICE_STATE_UPDATE":
          this.client.lavalinkManager.updateVoiceState(data.d);
          break;
      }
    });
  }

  async createFunctions() {
    this.client.functionManager.createFunction(
      {
        name: "$joinVoice",
        usage:
          "$joinVoice[voiceId;selfDeafen?;selfMute?;instaFilters?;returnChannel?]",
        input: [
          "voiceId",
          "selfDeafen",
          "selfMute",
          "instaFilters",
          "returnChannel?",
        ],
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);
          let [
            voiceId = d.message?.member.voice.channelId,
            selfDeafen = "true",
            selfMute = "false",
            instaFilters = "true",
            returnChannel = "false",
          ] = data.inside.splits;
          const voice = await d.util.getChannel(d, voiceId);

          if (!voice)
            return d.aoiError.fnError(
              d,
              "custom",
              { inside: data.inside },
              "voice channel"
            );

          //await player?.destroy();

          const player = await d.client.lavalinkManager.create({
            guild: voice.guildId,
            voiceChannel: voice.id,
            textChannel: d.message.channel?.id,
            selfMute: selfMute === "true" ? true : false,
            selfDeafen: selfDeafen === "true" ? true : false,
            region: voice?.rtcRegion || undefined,
            instaUpdateFiltersFix: instaFilters === "true" ? true : false,
          });

          if (!player.connected) await player.connect();

          data.result = returnChannel === "true" ? voice : "";
          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$playTrack",
        usage: "$playTrack[query;source?;guildId?]",
        input: ["query", "source?", "guildId?"],
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);
          let [query, source = "youtube", guildId = d.guild?.id] =
            data.inside.splits;

          const player = await d.client.lavalinkManager.players.get(guildId);
          if (!player)
            return d.aoiError.fnError(
              d,
              "custom",
              {},
              "lavalinkManager is not initalized"
            );

          const playlist = query.includes("&list=");
          const volume = player.get("volume")?.level || 90;

          const result = await d.client.lavalinkManager.search(
            { query, source },
            d.message.author,
            player.node
          );

          if (!player.playing && player.paused) {
            await player.stop();
          }

          const size = player.queue?.size || 0;

          if (playlist) {
            if (!result.tracks.length) {
              data.result = undefined;
              return { code: d.util.setCode(data) };
            }
            await player.queue.add([...result.tracks]);
          } else {
            if (!result.tracks[0]) {
              data.result = undefined;
              return { code: d.util.setCode(data) };
            }
            await player.queue.add(result.tracks[0]);
          }

          if (!player.playing && size === 0) {
            player.pause(false);

            await player.play({
              pause: false,
              volume,
              startTime: 0,
            });
          }

          data.result = "";

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$trackInfo",
        usage: "$trackInfo[index;property]",
        input: ["index", "property"],
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);
          let [property, index = 0] = data.inside.splits;

          const player = await d.client.lavalinkManager.players.get(d.guild.id);
          if (!player)
            return d.aoiError.fnError(
              d,
              "custom",
              { inside: data.inside },
              "Not connected / no lavalink instance"
            );
          if (player?.queue?.length !== 0 && !player?.queue?.current)
            return d.aoiError.fnError(d, "custom", {}, "Queue is empty");

          if (index == 0) {
            data.result = player.queue?.current[property] || "";
          } else if (index == -1) {
            data.result = player.queue?.previous[property] || "";
          } else {
            data.result = player.queue?.[index - 1][property] || "";
          }

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$loopMode",
        usage: "$loopMode[type]",
        input: ["type"],
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);
          let [type = "track"] = data.inside.splits;

          const player = await d.client.lavalinkManager.players.get(d.guild.id);
          if (!player)
            return d.aoiError.fnError(d, "custom", {}, "No lavalink instance");
          if (!player?.connected) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }

          type = type.toLowerCase();

          if (type === "queue") {
            await player.setQueueRepeat(!player.queueRepeat);
          } else if (type === "track") {
            await player.setTrackRepeat(!player.trackRepeat);
          } else if (type === "none") {
            if (player.trackRepeat) await player.setTrackRepeat(false);
            if (player.queueRepeat) await player.setQueueRepeat(false);
          }

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$loopStatus",
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);

          const player = await d.client.lavalinkManager.players.get(d.guild.id);
          if (!player)
            return d.aoiError.fnError(d, "custom", {}, "No lavalink instance");
          if (!player?.connected) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }

          const state = player.queueRepeat
            ? "queue"
            : player.trackRepeat
            ? "track"
            : "none";
          data.result = state;

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$skipTrack",
        usage: "$skipTrack",
        input: [],
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);

          const player = await d.client.lavalinkManager.players.get(d.guild.id);
          if (!player)
            return d.aoiError.fnError(d, "custom", {}, "No lavalink instance");
          if (!player?.connected) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }
          //if (player.queue.length < 1) { data.result = undefined; return { code: d.util.setCode(data) }}

          if (player?.get("autoplay")?.enabled === true) {
            await player.set("autoplay", {
              requester: player.queue.current.requester,
              source: player.queue.current.sourceName,
              previous: player.queue?.current,
              enabled: true,
            });
          }

          await player.stop();

          data.result = "";

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$skipTo",
        usage: "$skipTo[index]",
        input: ["index"],
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);

          const [track, returnTrack = "false"] = data.inside.splits;

          if (!track) return d.aoiError.fnError(d, "custom", {}, "track");

          const player = await d.client.lavalinkManager.players.get(d.guild.id);
          if (!player)
            return d.aoiError.fnError(d, "custom", {}, "No lavalink instance");
          if (!player?.connected) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }
          if (player.queue.length < 1) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }

          await player.queue.remove(0, Number(track) - 1);
          await player.stop();

          if (player?.get("autoplay")?.enabled === true) {
            await player.set("autoplay", {
              requester: player.queue.current.requester,
              source: player.queue.current.sourceName,
              previous: player.queue?.current,
              enabled: true,
            });
          }

          data.result = returnTrack === "true" ? player.queue.current : "";

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$seekTo",
        usage: "$seekTo[ms]",
        input: ["ms"],
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);

          let [ms] = data.inside.splits;

          ms = parseInt(Math.abs(ms));

          if (!ms) return d.aoiError.fnError(d, "custom", {}, "ms");

          const player = await d.client.lavalinkManager.players.get(d.guild.id);
          if (!player)
            return d.aoiError.fnError(d, "custom", {}, "No lavalink instance");
          if (!player?.connected) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }
          if (player.queue?.length < 1) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }
          if (player.queue?.current.isSeekable === false) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }
          if (player.queue?.current.length > ms) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }

          await player.seek(ms);

          data.result = "";

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$removeTrack",
        usage: "$removeTrack[position]",
        input: ["position"],
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);

          let [position] = data.inside.splits;

          position = parseInt(Math.abs(position));

          if (!position) return d.aoiError.fnError(d, "custom", {}, "position");

          const player = await d.client.lavalinkManager.players.get(d.guild.id);
          if (!player)
            return d.aoiError.fnError(d, "custom", {}, "No lavalink instance");
          if (!player?.connected) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }
          if (player.queue?.length < 1) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }
          if (player.queue?.lenght < position) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }

          await player.queue.remove(position);

          data.result = "";

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$getFilters",
        usage: "$getFilters[type]",
        input: ["type"],
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);

          const [type] = data.inside.splits;

          if (!track) return d.aoiError.fnError(d, "custom", {}, "track");

          const player = await d.client.lavalinkManager.players.get(d.guild.id);
          if (!player)
            return d.aoiError.fnError(d, "custom", {}, "No lavalink instance");
          if (!player?.connected) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }

          data.result = player.filters?.[type] || player.filters;

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$toggleFilters",
        type: "djs",
        usage: "$toggleFilters[filterType;returnFilters]",
        input: ["filterType", "returnFilters"],
        code: async (d) => {
          const data = await d.util.aoiFunc(d);
          const [filterType, returnFilters = "false"] = data.inside.splits;

          const player = await d.client.lavalinkManager.players.get(d.guild.id);
          if (!player)
            return d.aoiError.fnError(d, "custom", {}, "No lavalink instance");
          if (!player?.connected) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }

          const filters = filterType
            .split(";")
            .map((filter) => filter.trim().toLowerCase());

          filters.forEach((filter) => {
            const parts = filter.split(":");
            const filtertype = parts[0];
            const filterargs = parts.slice(1).map((param) => {
              if (!isNaN(param)) return parseFloat(param);
              return param;
            });

            if (
              [
                "rotating",
                "vibrato",
                "tremolo",
                "lowpass",
                "nightcore",
                "karaoke",
                "audiooutput",
                "echo",
              ].includes(filtertype)
            ) {
              switch (filtertype) {
                case "rotating":
                  player.toggleRotating(...filterargs);
                  //player?.toggleEcho( delay = 0.4, decay = 0.1 );
                  break;
                case "vibrato":
                  player.toggleVibrato(...filterargs);
                  break;
                case "tremolo":
                  player.toggleTremolo(...filterargs);
                  break;
                case "lowpass":
                  player.toggleLowPass(...filterargs);
                  break;
                case "nightcore":
                  player.toggleNightcore(...filterargs);
                  break;
                case "karaoke":
                  player.toggleKaraoke(...filterargs);
                  break;
                case "audiooutput":
                  player.setAudioOutput(filterargs[0]);
                  break;
                case "echo":
                  player.toggleEcho(...filterargs);
                  break;
                case "bassboost":
                  player.node.send({
                    op: "filters",
                    guildId: d.message.guild.id,
                    equalizer: player.bands.map((gain, index) => {
                      var obj = {
                        band: 0,
                        gain: 0,
                      };
                      obj.band = Number(index);
                      obj.gain = Number(gain);
                      return obj;
                    }),
                    timescale: {
                      speed: 1.0,
                      pitch: 1.0,
                      rate: 1.0,
                    },
                  });
                  break;
                default:
                  break;
              }
            }
          });

          data.result =
            returnFilters === "true" ? JSON.stringify(player.filters) : "";

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$clearFilters",
        usage: "$clearFilters",
        input: [],
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);

          const player = await d.client.lavalinkManager.players.get(d.guild.id);
          if (!player)
            return d.aoiError.fnError(d, "custom", {}, "No lavalink instance");
          if (!player?.connected) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }

          await player.resetFilters();

          data.result = "";

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$setVolume",
        usage: "$setVolume[volume]",
        input: ["volume"],
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);

          let [volume, returnVolume = "false"] = data.inside.splits;

          volume = parseInt(Math.abs(volume));

          if (!volume) return d.aoiError.fnError(d, "custom", {}, "volume");

          const player = await d.client.lavalinkManager.players.get(d.guild.id);
          if (!player)
            return d.aoiError.fnError(d, "custom", {}, "No lavalink instance");
          if (!player?.connected) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }

          await player.setVolume(volume);

          player.set("volume", {
            level: volume,
          });

          data.result = returnVolume === "true" ? player.volume : "";

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$shuffleQueue",
        usage: "$shuffleQueue",
        input: ["returnQueue", "returnOldQueue"],
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);

          const [returnQueue = "false", returnOldQueue = "false"] =
            data.inside.splits;

          const player = await d.client.lavalinkManager.players.get(d.guild.id);
          if (!player)
            return d.aoiError.fnError(d, "custom", {}, "No lavalink instance");
          if (!player?.connected) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }

          player.set("shuffle", {
            queueOld: player.queue.map((track) => track),
            enabled: true,
          });

          await player.queue.shuffle();

          data.result =
            returnQueue === "true"
              ? player.queue
              : returnOldQueue === "true"
              ? player.get("shuffle").queueOld
              : "";

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$unShuffleQueue",
        usage: "$unShuffleQueue",
        input: ["returnQueue", "returnOldQueue"],
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);

          const [returnQueue = "false", returnShuffledQueue = "false"] =
            data.inside.splits;

          const player = await d.client.lavalinkManager.players.get(d.guild.id);
          if (!player)
            return d.aoiError.fnError(d, "custom", {}, "No lavalink instance");
          if (!player?.connected) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }

          const shuffle = player?.get("shuffle") || undefined;
          if (shuffle?.enabled !== true) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }

          for (const track of shuffle.queueOld) {
            await player.queue.add(track);
          }

          player.set("shuffle", {
            queueOld: player.queue.map((track) => track),
            enabled: true,
          });

          data.result =
            returnQueue === "true"
              ? player.queue
              : returnShuffledQueue === "true"
              ? player.get("shuffle").queueOld
              : "";

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$clearQueue",
        usage: "$clearQueue",
        input: [],
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);

          const player = await d.client.lavalinkManager.players.get(d.guild.id);
          if (!player)
            return d.aoiError.fnError(d, "custom", {}, "No lavalink instance");
          if (!player?.connected) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }

          await player.queue.clear();

          data.result = "";

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$queue",
        usage: "$queue[limit;separator;format]",
        input: ["limit", "separator", "format"],
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);

          const player = await d.client.lavalinkManager.players.get(d.guild.id);
          if (!player)
            return d.aoiError.fnError(d, "custom", {}, "No lavalink instance");
          if (!player?.connected) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }

          let [
            limit,
            separator = ",\n",
            format = "{title} requested by {requester}",
          ] = data.inside.splits;
          limit = limit ? parseInt(limit) : player.queue.length;

          data.result = player.queue
            .slice(0, limit)
            .map((track) => {
              const keys = Object.keys(track).filter(
                (key) => key !== "requester"
              );
              const requester = Object.keys(track.requester);

              keys.forEach((key) => {
                format = format.replace(`{${key}}`, track[key]);
              });

              requester.forEach((key) => {
                format = format.replace(
                  `{requester.${key}}`,
                  track.requester[key]
                );
                format = format.replace(`{requester}`, track.requester);
              });

              //i know this isnt the best way but i'm too lazy to do it properly currently

              return format;
            })
            .join(separator);

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$autoPlay",
        usage: "$autoPlay[source]",
        input: ["source"],
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);

          const [source = "youtube"] = data.inside.splits;

          if (!source) return d.aoiError.fnError(d, "custom", {}, "source");

          const player = await d.client.lavalinkManager.players.get(d.guild.id);
          if (!player)
            return d.aoiError.fnError(d, "custom", {}, "No lavalink instance");
          if (!player?.connected) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }

          player.set("autoplay", {
            requester: d.message.author,
            source,
            previous: player.queue?.current,
            enabled: !(player.get("autoplay")?.enabled || false),
          });

          data.result = player.get("autoplay")?.enabled || false;

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$searchTrack",
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);
          const [query, index = "0", format = "false"] = data.inside.splits;

          const result = await d.client.lavalinkManager.search({ query });

          if (index === "all") {
            data.result =
              format === "true"
                ? JSON.stringify(result.tracks, null, 2)
                : result.tracks;
          } else {
            data.result =
              format === "true"
                ? JSON.stringify(result.tracks[parseInt(index)], null, 2)
                : result.tracks[parseInt(index)];
          }

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$pauseTrack",
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);

          const [returnState = "false"] = data.inside.splits;

          const player = await d.client.lavalinkManager.players.get(d.guild.id);
          if (!player)
            return d.aoiError.fnError(d, "custom", {}, "No lavalink instance");
          if (!player?.connected) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }

          await player.pause(true);

          data.result = returnState === "true" ? player.paused : "";

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$resumeTrack",
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);

          const [returnState = "false"] = data.inside.splits;

          const player = await d.client.lavalinkManager.players.get(d.guild.id);
          if (!player)
            return d.aoiError.fnError(d, "custom", {}, "No lavalink instance");
          if (!player?.connected) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }

          await player.pause(false);

          data.result = returnState === "true" ? player.paused : "";

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$leaveVoice",
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);

          const player = await d.client.lavalinkManager.players.get(d.guild.id);
          if (!player)
            return d.aoiError.fnError(d, "custom", {}, "No lavalink instance");
          if (!player?.connected) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }

          await player.queue.clear();
          await player.destroy();
          //await d.message.guild.me.voice.channel.disconnect();

          data.result = "";

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$voicePing",
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);

          const player = await d.client.lavalinkManager.players.get(d.guild.id);
          if (!player)
            return d.aoiError.fnError(d, "custom", {}, "No lavalink instance");
          if (!player?.connected) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }

          data.result = player.wsPing;

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$lavalinkPing",
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);

          const player = await d.client.lavalinkManager.players.get(d.guild.id);
          if (!player)
            return d.aoiError.fnError(d, "custom", {}, "No lavalink instance");
          if (!player?.connected) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }

          data.result = player.ping;

          return {
            code: d.util.setCode(data),
          };
        },
      },
      {
        name: "$playerStatus",
        type: "djs",
        code: async (d) => {
          const data = await d.util.aoiFunc(d);

          const player = await d.client.lavalinkManager.players.get(d.guild.id);
          if (!player)
            return d.aoiError.fnError(d, "custom", {}, "No lavalink instance");
          if (!player?.connected) {
            data.result = undefined;
            return { code: d.util.setCode(data) };
          }

          data.result = player?.state;

          return {
            code: d.util.setCode(data),
          };
        },
      }
    );
  }
}

module.exports = { lavalinkManager };
