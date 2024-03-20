async function autoPlay(player, previousTrack) {

  if (player.get("autoplay") !== true) return;
  if (!previousTrack) return;

  if (previousTrack.info.sourceName === "spotify") {
    const filtered = player.queue.previous
      .filter((v) => v.info.sourceName === "spotify")
      .slice(0, 5);
    const ids = filtered.map(
      (v) =>
        v.info.identifier ||
        v.info.uri.split("/")?.reverse()?.[0] ||
        v.info.uri.split("/")?.reverse()?.[1]
    );
    if (ids.length >= 2) {
      const res = await player
        .search(
          {
            query: `seed_tracks=${ids.join(",")}`,
            source: "sprec",
          },
          previousTrack.requester
        )
        .then((response) => {
          response.tracks = response.tracks.filter(
            (v) => v.info.identifier !== previousTrack.info.identifier
          );
          return response;
        })
        .catch(console.warn);
      if (res && res.tracks.length)
        await player.queue.add(
          res.tracks.slice(0, 1).map((track) => {
            track.pluginInfo.clientData = {
              ...(track.pluginInfo.clientData || {}),
              fromAutoplay: true,
            };
            return track;
          })
        );
    }
  }

  if (previousTrack.info.sourceName === "youtube" || previousTrack.info.sourceName === "youtubemusic") {
    const res = await player
      .search(
        {
          query: `https://www.youtube.com/watch?v=${previousTrack.info.identifier}&list=RD${previousTrack.info.identifier}`,
          source: "youtube",
        },
        previousTrack.requester
      )
      .then((response) => {
        response.tracks = response.tracks.filter(
          (v) => v.info.identifier !== previousTrack.info.identifier
        );
        return response;
      })
      .catch(console.warn);
    if (res && res.tracks.length)
      await player.queue.add(
        res.tracks.slice(0, 1).map((track) => {
          track.pluginInfo.clientData = {
            ...(track.pluginInfo.clientData || {}),
            fromAutoplay: true,
          };
          return track;
        })
      );
  }

  if (!player.playing || player.queue.tracks.length !== 0) await player.play({ volume: player.get("default_volume") || 100, paused: false });

  return;
}

module.exports = autoPlay

// Modified from https://github.com/Tomato6966/lavalink-client/blob/main/testBot/Utils/OptionalFunctions.ts
