import { makeAutoObservable, toJS } from "mobx";

const USER_TOKEN_STORAGE_KEY = "randomiser_user_token";
const SAVED_PLAYLISTS_STORAGE_KEY = "randomiser_saved_playlists_v1";
const PLAYLIST_PATH_REGEX =
  /^\/playlist\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:\/|$)/;
const MIN_TRACK_WEIGHT = 1;
const MAX_TRACK_WEIGHT = 20;
const DEFAULT_HFO_VALUE = 0.5;
const MIN_HFO_VALUE = 0;
const MAX_HFO_VALUE = 1;
const MIN_PLAYLIST_MINUTES = 30;
const MAX_PLAYLIST_MINUTES = 120;
const DEFAULT_PLAYLIST_MINUTES = 60;
const PLAYLIST_OVERRUN_MINUTES = 10;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_MINUTE = SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
const PLAYLIST_OVERRUN_MILLISECONDS =
  PLAYLIST_OVERRUN_MINUTES * MILLISECONDS_PER_MINUTE;

function normalizeTrackWeight(weight) {
  if (typeof weight !== "number" || Number.isNaN(weight)) {
    return MIN_TRACK_WEIGHT;
  }

  return Math.min(
    MAX_TRACK_WEIGHT,
    Math.max(MIN_TRACK_WEIGHT, Math.round(weight))
  );
}

function normalizeHfoValue(value) {
  const parsedValue = Number(value);
  if (Number.isNaN(parsedValue)) {
    return DEFAULT_HFO_VALUE;
  }

  const clampedValue = Math.min(
    MAX_HFO_VALUE,
    Math.max(MIN_HFO_VALUE, parsedValue)
  );
  return Math.round(clampedValue * 100) / 100;
}

function normalizePlaylistDurationMinutes(value) {
  const parsedValue = Number(value);
  if (Number.isNaN(parsedValue)) {
    return DEFAULT_PLAYLIST_MINUTES;
  }

  return Math.min(
    MAX_PLAYLIST_MINUTES,
    Math.max(MIN_PLAYLIST_MINUTES, Math.round(parsedValue))
  );
}

function parseDurationString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const parts = value
    .trim()
    .split(":")
    .map((part) => Number(part));

  if (!parts.length || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * SECONDS_PER_MINUTE + seconds;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * SECONDS_PER_MINUTE + seconds;
  }

  return null;
}

function normalizeTrackDurationMilliseconds(track) {
  if (!track || typeof track !== "object") {
    return null;
  }

  const numericCandidates = [
    track.durationMilliseconds,
    track.durationMs,
    track.durationSeconds,
    track.duration_seconds,
    track.durationSecs,
    track.durationInSeconds,
    track.lengthSeconds,
    track.seconds,
    track.lengthMs,
    track.milliseconds,
    track.duration,
    track.length,
    track.runtime
  ];

  for (const candidate of numericCandidates) {
    if (Number.isFinite(candidate) && candidate > 0) {
      return Math.round(candidate);
    }
  }

  const stringCandidates = [track.duration, track.length, track.runtime];
  for (const candidate of stringCandidates) {
    const parsed = parseDurationString(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed * MILLISECONDS_PER_SECOND);
    }
  }

  return null;
}

function isValidDurationMilliseconds(value) {
  return Number.isFinite(value) && value > 0;
}

function dedupeTracksById(tracks) {
  const map = new Map();

  tracks.forEach((track) => {
    if (!track || typeof track !== "object") {
      return;
    }

    const parsedId = Number(track.id);
    if (!Number.isFinite(parsedId) || !Number.isInteger(parsedId)) {
      return;
    }

    const existing = map.get(parsedId);
    if (!existing) {
      map.set(parsedId, track);
      return;
    }

    const existingHasDuration = isValidDurationMilliseconds(
      existing.durationMilliseconds
    );
    const nextHasDuration = isValidDurationMilliseconds(
      track.durationMilliseconds
    );

    if (nextHasDuration && !existingHasDuration) {
      map.set(parsedId, track);
      return;
    }

    if (
      nextHasDuration === existingHasDuration &&
      track.weight > existing.weight
    ) {
      map.set(parsedId, track);
    }
  });

  return Array.from(map.values());
}

function collectTracksFromPlaylists(playlists) {
  const tracks = [];
  playlists.forEach((playlist) => {
    if (!playlist || !Array.isArray(playlist.tracks)) {
      return;
    }
    tracks.push(...playlist.tracks);
  });
  return tracks;
}

function pickWeightedItem(items, getWeight) {
  if (!items.length) {
    return null;
  }

  const totalWeight = items.reduce((sum, item) => {
    const weight = Number(getWeight(item));
    if (Number.isNaN(weight) || weight <= 0) {
      return sum;
    }
    return sum + weight;
  }, 0);

  if (totalWeight <= 0) {
    return null;
  }

  let threshold = Math.random() * totalWeight;
  for (const item of items) {
    const weight = Number(getWeight(item));
    if (Number.isNaN(weight) || weight <= 0) {
      continue;
    }
    threshold -= weight;
    if (threshold <= 0) {
      return item;
    }
  }

  return items[items.length - 1];
}

function shuffleArray(items) {
  const array = [...items];
  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
  }
  return array;
}

function formatPlaylistDate(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date();
  return date.toLocaleDateString("en-CA");
}

async function readResponseErrorMessage(response, fallbackMessage) {
  try {
    const payload = await response.json();
    if (payload && typeof payload.message === "string" && payload.message) {
      return payload.message;
    }
  } catch {
    // Ignore parse failures.
  }

  if (fallbackMessage) {
    return fallbackMessage;
  }

  return `Request failed (HTTP ${response.status}).`;
}

function normalizePlaylistTypeFlags({ isInduction, isAwakener, isHfo }) {
  const normalizedIsInduction = Boolean(isInduction);
  const normalizedIsAwakener = Boolean(isAwakener);
  const normalizedIsHfo = Boolean(isHfo);

  if (normalizedIsInduction) {
    return { isInduction: true, isAwakener: false, isHfo: false };
  }

  if (normalizedIsAwakener) {
    return { isInduction: false, isAwakener: true, isHfo: false };
  }

  if (normalizedIsHfo) {
    return { isInduction: false, isAwakener: false, isHfo: true };
  }

  return { isInduction: false, isAwakener: false, isHfo: false };
}

function sanitizeSavedPlaylists(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const entries = Object.entries(value);
  const sanitized = {};

  entries.forEach(([uuid, playlist]) => {
    if (!playlist || typeof playlist !== "object") {
      return;
    }

    const name = typeof playlist.name === "string" ? playlist.name : "";
    const loadedAt =
      typeof playlist.loadedAt === "string"
        ? playlist.loadedAt
        : new Date().toISOString();
    const playlistType = normalizePlaylistTypeFlags({
      isInduction: playlist.isInduction,
      isAwakener: playlist.isAwakener,
      isHfo: playlist.isHfo
    });
    let files = [];
    if (Array.isArray(playlist.tracks)) {
      files = playlist.tracks;
    } else if (playlist.tracks && typeof playlist.tracks === "object") {
      files = Object.values(playlist.tracks);
    }

    const tracks = files
      .map((track) => {
        if (!track || typeof track !== "object") {
          console.warn("Skipping stored track: invalid track object");
          return null;
        }

        const parsedTrackId = Number(track.id);
        const hasValidId =
          Number.isFinite(parsedTrackId) &&
          Number.isInteger(parsedTrackId) &&
          parsedTrackId > 0;

        if (!hasValidId) {
          console.warn("Skipping stored track: invalid id", { id: track.id });
          return null;
        }

        const trackUuid =
          typeof track.uuid === "string" ? track.uuid.trim() : "";
        if (!trackUuid) {
          console.warn("Skipping stored track: missing uuid", {
            id: parsedTrackId
          });
          return null;
        }

        return {
          id: parsedTrackId,
          uuid: trackUuid,
          name: typeof track.name === "string" ? track.name : "Untitled track",
          weight: normalizeTrackWeight(track.weight),
          durationMilliseconds: normalizeTrackDurationMilliseconds(track)
        };
      })
      .filter(Boolean);

    sanitized[uuid] = {
      uuid,
      name,
      tracks,
      loadedAt,
      isInduction: playlistType.isInduction,
      isAwakener: playlistType.isAwakener,
      isHfo: playlistType.isHfo,
      hfoValue: normalizeHfoValue(playlist.hfoValue)
    };
  });

  return sanitized;
}

class AppStore {
  userToken = "lalala";
  savedPlaylistsByUuid = {};
  isLoadingPlaylist = false;
  playlistLoadError = "";
  isCreatingPlaylist = false;
  playlistCreateError = "";
  playlistCreateSuccess = "";
  hasHydrated = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get savedPlaylists() {
    return Object.values(this.savedPlaylistsByUuid).sort((a, b) =>
      b.loadedAt.localeCompare(a.loadedAt)
    );
  }

  get savedPlaylistCount() {
    return Object.keys(this.savedPlaylistsByUuid).length;
  }

  getCookieValue(cookieKey) {
    const cookiePrefix = `${cookieKey}=`;
    const cookie = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(cookiePrefix));

    if (!cookie) {
      return "";
    }

    return decodeURIComponent(cookie.slice(cookiePrefix.length));
  }

  loadUserTokenFromCookie() {
    const token = this.getCookieValue("bambicloud_user");
    if (!token) {
      return false;
    }

    this.setUserToken(token);
    return true;
  }

  extractPlaylistUuidFromLocation(locationHref) {
    try {
      const locationUrl = new URL(locationHref);
      const match = locationUrl.pathname.match(PLAYLIST_PATH_REGEX);
      return match?.[1] || null;
    } catch {
      return null;
    }
  }

  normalizePlaylistResponse(apiPayload) {
    const firstPlaylist = Array.isArray(apiPayload?.playlists)
      ? apiPayload.playlists[0]
      : null;
    if (!firstPlaylist || typeof firstPlaylist !== "object") {
      return null;
    }

    if (typeof firstPlaylist.uuid !== "string") {
      return null;
    }

    const files = Array.isArray(firstPlaylist.files) ? firstPlaylist.files : [];
    const tracks = [];

    files.forEach((file) => {
      if (!file || typeof file !== "object") {
        return;
      }

      if (typeof file.id !== "number" || typeof file.uuid !== "string") {
        console.warn("Skipping track with missing id/uuid", file);
        return;
      }

      tracks.push({
        id: file.id,
        uuid: file.uuid,
        name: typeof file.name === "string" ? file.name : "Untitled track",
        weight: MIN_TRACK_WEIGHT,
        durationMilliseconds: normalizeTrackDurationMilliseconds(file)
      });
    });

    return {
      uuid: firstPlaylist.uuid,
      name:
        typeof firstPlaylist.name === "string" && firstPlaylist.name
          ? firstPlaylist.name
          : "Untitled playlist",
      tracks,
      loadedAt: new Date().toISOString(),
      isInduction: false,
      isAwakener: false,
      isHfo: false,
      hfoValue: DEFAULT_HFO_VALUE
    };
  }

  clearPlaylistError() {
    this.playlistLoadError = "";
  }

  clearPlaylistCreateStatus() {
    this.playlistCreateError = "";
    this.playlistCreateSuccess = "";
  }

  buildRandomizedPlaylist(targetMinutes) {
    const normalizedMinutes = normalizePlaylistDurationMinutes(targetMinutes);
    const targetMilliseconds = normalizedMinutes * MILLISECONDS_PER_MINUTE;
    const maxTotalMilliseconds =
      targetMilliseconds + PLAYLIST_OVERRUN_MILLISECONDS;

    const playlists = this.savedPlaylists;
    const inductionPlaylists = playlists.filter(
      (playlist) => playlist.isInduction
    );
    const awakenerPlaylists = playlists.filter(
      (playlist) => playlist.isAwakener
    );

    const inductionTracks = dedupeTracksById(
      collectTracksFromPlaylists(inductionPlaylists)
    ).filter((track) =>
      isValidDurationMilliseconds(track.durationMilliseconds)
    );
    const awakenerTracks = dedupeTracksById(
      collectTracksFromPlaylists(awakenerPlaylists)
    ).filter((track) =>
      isValidDurationMilliseconds(track.durationMilliseconds)
    );

    if (!inductionTracks.length) {
      return {
        error:
          "Select at least one induction playlist with tracks that include duration data."
      };
    }

    if (!awakenerTracks.length) {
      return {
        error:
          "Select at least one awakener playlist with tracks that include duration data."
      };
    }

    const validInductionTracks = inductionTracks.filter((inductionTrack) => {
      if (inductionTrack.durationMilliseconds > maxTotalMilliseconds) {
        return false;
      }

      return awakenerTracks.some((awakenerTrack) => {
        if (awakenerTrack.id === inductionTrack.id) {
          return false;
        }

        return (
          inductionTrack.durationMilliseconds +
            awakenerTrack.durationMilliseconds <=
          maxTotalMilliseconds
        );
      });
    });

    if (!validInductionTracks.length) {
      return {
        error:
          "Induction and awakener tracks are too long for the selected playlist length."
      };
    }

    const inductionTrack = pickWeightedItem(
      validInductionTracks,
      (track) => track.weight
    );
    if (!inductionTrack) {
      return { error: "Unable to select an induction track." };
    }

    const selectedTrackIds = new Set([inductionTrack.id]);
    let totalMilliseconds = inductionTrack.durationMilliseconds;

    const awakenerCandidates = awakenerTracks.filter(
      (track) =>
        !selectedTrackIds.has(track.id) &&
        totalMilliseconds + track.durationMilliseconds <= maxTotalMilliseconds
    );
    const awakenerTrack = pickWeightedItem(
      awakenerCandidates,
      (track) => track.weight
    );

    if (!awakenerTrack) {
      return {
        error: "No awakener track fits within the remaining playlist length."
      };
    }

    selectedTrackIds.add(awakenerTrack.id);
    totalMilliseconds += awakenerTrack.durationMilliseconds;

    const hfoTracks = [];
    const hfoPlaylists = playlists.filter((playlist) => playlist.isHfo);
    hfoPlaylists.forEach((playlist) => {
      const inclusionChance = normalizeHfoValue(
        playlist.hfoValue ?? DEFAULT_HFO_VALUE
      );
      if (Math.random() > inclusionChance) {
        return;
      }

      const hfoCandidates = dedupeTracksById(
        collectTracksFromPlaylists([playlist])
      )
        .filter((track) => !selectedTrackIds.has(track.id))
        .filter((track) =>
          isValidDurationMilliseconds(track.durationMilliseconds)
        )
        .filter(
          (track) =>
            totalMilliseconds + track.durationMilliseconds <=
            maxTotalMilliseconds
        );

      const hfoTrack = pickWeightedItem(hfoCandidates, (track) => track.weight);
      if (!hfoTrack) {
        return;
      }

      selectedTrackIds.add(hfoTrack.id);
      hfoTracks.push(hfoTrack);
      totalMilliseconds += hfoTrack.durationMilliseconds;
    });

    if (totalMilliseconds > maxTotalMilliseconds) {
      return {
        error: "Selected tracks exceed the maximum allowed playlist length."
      };
    }

    const basePlaylists = playlists.filter(
      (playlist) =>
        !playlist.isInduction && !playlist.isAwakener && !playlist.isHfo
    );
    let availableBaseTracks = dedupeTracksById(
      collectTracksFromPlaylists(basePlaylists)
    )
      .filter((track) => !selectedTrackIds.has(track.id))
      .filter((track) =>
        isValidDurationMilliseconds(track.durationMilliseconds)
      );

    const middleTracks = [];
    while (totalMilliseconds < targetMilliseconds) {
      const remainingMilliseconds = targetMilliseconds - totalMilliseconds;
      const maxAllowedTotal =
        remainingMilliseconds < PLAYLIST_OVERRUN_MILLISECONDS
          ? maxTotalMilliseconds
          : targetMilliseconds;

      const candidates = availableBaseTracks.filter(
        (track) =>
          totalMilliseconds + track.durationMilliseconds <= maxAllowedTotal
      );

      if (!candidates.length) {
        break;
      }

      const nextTrack = pickWeightedItem(candidates, (track) => track.weight);
      if (!nextTrack) {
        break;
      }

      middleTracks.push(nextTrack);
      selectedTrackIds.add(nextTrack.id);
      totalMilliseconds += nextTrack.durationMilliseconds;
      availableBaseTracks = availableBaseTracks.filter(
        (track) => track.id !== nextTrack.id
      );
    }

    const shuffledMiddle = shuffleArray([...middleTracks, ...hfoTracks]);
    const orderedTracks = [inductionTrack, ...shuffledMiddle, awakenerTrack];

    return {
      playlistName: `randomised playlist, ${formatPlaylistDate(new Date())}`,
      trackIds: orderedTracks.map((track) => track.id),
      trackCount: orderedTracks.length,
      totalMilliseconds,
      targetMinutes: normalizedMinutes
    };
  }

  async createRandomizedPlaylist(targetMinutes) {
    if (this.isCreatingPlaylist) {
      return;
    }

    this.clearPlaylistCreateStatus();
    this.isCreatingPlaylist = true;

    try {
      let token = this.userToken.trim();
      if (!token) {
        this.loadUserTokenFromCookie();
        token = this.userToken.trim();
      }

      if (!token) {
        this.playlistCreateError = "Token not found. Load token first.";
        return;
      }

      const buildResult = this.buildRandomizedPlaylist(targetMinutes);
      if (!buildResult || buildResult.error) {
        this.playlistCreateError =
          buildResult?.error || "Failed to build a randomized playlist.";
        return;
      }

      if (!buildResult.trackIds.length) {
        this.playlistCreateError = "No tracks were selected for the playlist.";
        return;
      }

      const createResponse = await fetch(
        "https://api.bambicloud.com/playlists",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: buildResult.playlistName,
            description: "",
            expLevel: 1,
            isCore: false
          })
        }
      );

      if (!createResponse.ok) {
        this.playlistCreateError = await readResponseErrorMessage(
          createResponse,
          `Failed to create playlist (HTTP ${createResponse.status}).`
        );
        return;
      }

      const createdPayload = await createResponse.json();
      console.log({ createdPayload, createResponse });
      const playlistId = Number(createdPayload[0].id);

      if (!Number.isFinite(playlistId)) {
        this.playlistCreateError = "Playlist creation response missing an id.";
        return;
      }

      const addResponse = await fetch("https://api.bambicloud.com/playlists", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: playlistId,
          fileIds: buildResult.trackIds
        })
      });

      if (!addResponse.ok) {
        this.playlistCreateError = await readResponseErrorMessage(
          addResponse,
          `Failed to add tracks (HTTP ${addResponse.status}).`
        );
        return;
      }

      this.playlistCreateSuccess = `Created "${buildResult.playlistName}" with ${buildResult.trackCount} tracks.`;
    } catch (error) {
      console.error("Failed to create playlist:", error);
      this.playlistCreateError = "Failed to create playlist. Please try again.";
    } finally {
      this.isCreatingPlaylist = false;
    }
  }

  async hydrateFromStorage() {
    if (this.hasHydrated) {
      return;
    }

    try {
      const result = await chrome.storage.local.get([
        USER_TOKEN_STORAGE_KEY,
        SAVED_PLAYLISTS_STORAGE_KEY
      ]);

      const storedToken = result?.[USER_TOKEN_STORAGE_KEY];
      if (typeof storedToken === "string") {
        this.userToken = storedToken;
      }

      this.savedPlaylistsByUuid = sanitizeSavedPlaylists(
        result?.[SAVED_PLAYLISTS_STORAGE_KEY]
      );
    } catch (error) {
      console.error("Failed to hydrate user token:", error);
    } finally {
      this.hasHydrated = true;
    }
  }

  async persistUserToken() {
    try {
      await chrome.storage.local.set({
        [USER_TOKEN_STORAGE_KEY]: this.userToken
      });
    } catch (error) {
      console.error("Failed to persist user token:", error);
    }
  }

  async persistPlaylistState() {
    try {
      const payload = toJS(this.savedPlaylistsByUuid);
      await chrome.storage.local.set({
        [SAVED_PLAYLISTS_STORAGE_KEY]: payload
      });
    } catch (error) {
      console.error("Failed to persist playlists:", error);
      this.playlistLoadError = "Could not save playlists to extension storage.";
    }
  }

  setUserToken(token) {
    this.userToken = token;
    void this.persistUserToken();
  }

  resetUserToken() {
    this.userToken = "";
    void this.persistUserToken();
  }

  updateTrackWeight(playlistUuid, trackUuid, nextWeight) {
    const playlist = this.savedPlaylistsByUuid[playlistUuid];
    if (!playlist) {
      return;
    }

    const track = playlist.tracks.find((item) => item.uuid === trackUuid);
    if (!track) {
      return;
    }

    track.weight = normalizeTrackWeight(nextWeight);
    void this.persistPlaylistState();
  }

  setPlaylistTypeFlags(playlistUuid, { isInduction, isAwakener, isHfo }) {
    const playlist = this.savedPlaylistsByUuid[playlistUuid];
    if (!playlist) {
      return;
    }

    const normalizedFlags = normalizePlaylistTypeFlags({
      isInduction,
      isAwakener,
      isHfo
    });
    playlist.isInduction = normalizedFlags.isInduction;
    playlist.isAwakener = normalizedFlags.isAwakener;
    playlist.isHfo = normalizedFlags.isHfo;

    if (!playlist.isHfo) {
      playlist.hfoValue = DEFAULT_HFO_VALUE;
    } else {
      playlist.hfoValue = normalizeHfoValue(playlist.hfoValue);
    }

    void this.persistPlaylistState();
  }

  setPlaylistHfoValue(playlistUuid, nextValue) {
    const playlist = this.savedPlaylistsByUuid[playlistUuid];
    if (!playlist) {
      return;
    }

    playlist.hfoValue = normalizeHfoValue(nextValue);
    void this.persistPlaylistState();
  }

  removePlaylist(playlistUuid) {
    if (!this.savedPlaylistsByUuid[playlistUuid]) {
      return;
    }

    const nextPlaylists = { ...this.savedPlaylistsByUuid };
    delete nextPlaylists[playlistUuid];
    this.savedPlaylistsByUuid = nextPlaylists;
    void this.persistPlaylistState();
  }

  async loadPlaylistFromCurrentUrl() {
    this.clearPlaylistError();
    this.isLoadingPlaylist = true;

    try {
      let token = this.userToken.trim();
      if (!token) {
        this.loadUserTokenFromCookie();
        token = this.userToken.trim();
      }

      if (!token) {
        this.playlistLoadError = "Token not found. Load token first.";
        return;
      }

      const playlistUuid = this.extractPlaylistUuidFromLocation(
        window.location.href
      );
      if (!playlistUuid) {
        this.playlistLoadError = "Open a bambicloud playlist URL first.";
        return;
      }

      const response = await fetch(
        `https://api.bambicloud.com/playlists?uuid=${encodeURIComponent(playlistUuid)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          this.playlistLoadError =
            "Authentication failed. Reload token and try again.";
          return;
        }

        if (response.status === 404) {
          this.playlistLoadError = "Playlist not found for this URL.";
          return;
        }

        this.playlistLoadError = `Failed to load playlist (HTTP ${response.status}).`;
        return;
      }

      const payload = await response.json();
      const normalizedPlaylist = this.normalizePlaylistResponse(payload);
      if (!normalizedPlaylist) {
        this.playlistLoadError = "Playlist response was empty or invalid.";
        return;
      }

      const existingPlaylist =
        this.savedPlaylistsByUuid[normalizedPlaylist.uuid];
      if (existingPlaylist) {
        const existingWeightsByTrackUuid = Object.fromEntries(
          existingPlaylist.tracks.map((track) => [track.uuid, track.weight])
        );

        normalizedPlaylist.tracks = normalizedPlaylist.tracks.map((track) => ({
          ...track,
          weight: normalizeTrackWeight(
            existingWeightsByTrackUuid[track.uuid] ?? MIN_TRACK_WEIGHT
          )
        }));

        const existingFlags = normalizePlaylistTypeFlags({
          isInduction: existingPlaylist.isInduction,
          isAwakener: existingPlaylist.isAwakener,
          isHfo: existingPlaylist.isHfo
        });
        normalizedPlaylist.isInduction = existingFlags.isInduction;
        normalizedPlaylist.isAwakener = existingFlags.isAwakener;
        normalizedPlaylist.isHfo = existingFlags.isHfo;
        normalizedPlaylist.hfoValue = normalizeHfoValue(
          existingPlaylist.hfoValue
        );
      }

      this.savedPlaylistsByUuid = {
        ...this.savedPlaylistsByUuid,
        [normalizedPlaylist.uuid]: normalizedPlaylist
      };
      await this.persistPlaylistState();
    } catch (error) {
      console.error("Failed to load playlist:", error);
      this.playlistLoadError = "Failed to load playlist. Please try again.";
    } finally {
      this.isLoadingPlaylist = false;
    }
  }
}

const appStore = new AppStore();

export default appStore;
