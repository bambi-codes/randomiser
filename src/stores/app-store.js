import { makeAutoObservable } from "mobx";

const USER_TOKEN_STORAGE_KEY = "randomiser_user_token";
const SAVED_PLAYLISTS_STORAGE_KEY = "randomiser_saved_playlists_v1";
const ACTIVE_PLAYLIST_UUID_STORAGE_KEY = "randomiser_active_playlist_uuid_v1";
const PLAYLIST_PATH_REGEX =
  /^\/playlist\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:\/|$)/;

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
      typeof playlist.loadedAt === "string" ? playlist.loadedAt : new Date().toISOString();
    const files = Array.isArray(playlist.tracks) ? playlist.tracks : [];

    const tracks = files
      .map((track) => {
        if (!track || typeof track !== "object") {
          return null;
        }

        if (typeof track.id !== "number" || typeof track.uuid !== "string") {
          return null;
        }

        return {
          id: track.id,
          uuid: track.uuid,
          name: typeof track.name === "string" ? track.name : "Untitled track",
          weight: typeof track.weight === "number" ? track.weight : 1.0
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
  activePlaylistUuid = null;
  isLoadingPlaylist = false;
  playlistLoadError = "";
  hasHydrated = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get activePlaylist() {
    if (!this.activePlaylistUuid) {
      return null;
    }

    return this.savedPlaylistsByUuid[this.activePlaylistUuid] || null;
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
        weight: 1.0
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

  setActivePlaylist(uuid) {
    if (typeof uuid === "string" && this.savedPlaylistsByUuid[uuid]) {
      this.activePlaylistUuid = uuid;
    } else {
      this.activePlaylistUuid = null;
    }

    void this.persistPlaylistState();
  }

  async hydrateFromStorage() {
    if (this.hasHydrated) {
      return;
    }

    try {
      const result = await chrome.storage.local.get([
        USER_TOKEN_STORAGE_KEY,
        SAVED_PLAYLISTS_STORAGE_KEY,
        ACTIVE_PLAYLIST_UUID_STORAGE_KEY
      ]);

      const storedToken = result?.[USER_TOKEN_STORAGE_KEY];
      if (typeof storedToken === "string") {
        this.userToken = storedToken;
      }

      this.savedPlaylistsByUuid = sanitizeSavedPlaylists(
        result?.[SAVED_PLAYLISTS_STORAGE_KEY]
      );

      const storedActiveUuid = result?.[ACTIVE_PLAYLIST_UUID_STORAGE_KEY];
      this.activePlaylistUuid =
        typeof storedActiveUuid === "string" &&
        this.savedPlaylistsByUuid[storedActiveUuid]
          ? storedActiveUuid
          : null;
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
      await chrome.storage.local.set({
        [SAVED_PLAYLISTS_STORAGE_KEY]: this.savedPlaylistsByUuid,
        [ACTIVE_PLAYLIST_UUID_STORAGE_KEY]: this.activePlaylistUuid
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

      const playlistUuid = this.extractPlaylistUuidFromLocation(window.location.href);
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
          this.playlistLoadError = "Authentication failed. Reload token and try again.";
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

      this.savedPlaylistsByUuid = {
        ...this.savedPlaylistsByUuid,
        [normalizedPlaylist.uuid]: normalizedPlaylist
      };
      this.activePlaylistUuid = normalizedPlaylist.uuid;
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
