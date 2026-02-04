import { makeAutoObservable, toJS } from "mobx";

const USER_TOKEN_STORAGE_KEY = "randomiser_user_token";
const SAVED_PLAYLISTS_STORAGE_KEY = "randomiser_saved_playlists_v1";
const PLAYLIST_PATH_REGEX =
  /^\/playlist\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:\/|$)/;
const MIN_TRACK_WEIGHT = 1;
const MAX_TRACK_WEIGHT = 20;

function normalizeTrackWeight(weight) {
  if (typeof weight !== "number" || Number.isNaN(weight)) {
    return MIN_TRACK_WEIGHT;
  }

  return Math.min(
    MAX_TRACK_WEIGHT,
    Math.max(MIN_TRACK_WEIGHT, Math.round(weight))
  );
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
          weight: normalizeTrackWeight(track.weight)
        };
      })
      .filter(Boolean);

    sanitized[uuid] = { uuid, name, tracks, loadedAt };
  });

  return sanitized;
}

class AppStore {
  userToken = "lalala";
  savedPlaylistsByUuid = {};
  isLoadingPlaylist = false;
  playlistLoadError = "";
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
        weight: MIN_TRACK_WEIGHT
      });
    });

    return {
      uuid: firstPlaylist.uuid,
      name:
        typeof firstPlaylist.name === "string" && firstPlaylist.name
          ? firstPlaylist.name
          : "Untitled playlist",
      tracks,
      loadedAt: new Date().toISOString()
    };
  }

  clearPlaylistError() {
    this.playlistLoadError = "";
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
