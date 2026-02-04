import { makeAutoObservable } from "mobx";

const USER_TOKEN_STORAGE_KEY = "randomiser_user_token";

class AppStore {
  userToken = "lalala";
  hasHydrated = false;

  constructor() {
    makeAutoObservable(this);
  }

  async hydrateFromStorage() {
    if (this.hasHydrated) {
      return;
    }

    try {
      const result = await chrome.storage.local.get(USER_TOKEN_STORAGE_KEY);
      const storedToken = result?.[USER_TOKEN_STORAGE_KEY];
      if (typeof storedToken === "string") {
        this.userToken = storedToken;
      }
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

  setUserToken(token) {
    this.userToken = token;
    void this.persistUserToken();
  }

  resetUserToken() {
    this.userToken = "";
    void this.persistUserToken();
  }
}

const appStore = new AppStore();

export default appStore;
