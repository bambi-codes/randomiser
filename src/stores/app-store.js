import { makeAutoObservable } from "mobx";

class AppStore {
  userToken = "lalala";

  constructor() {
    makeAutoObservable(this);
  }

  setUserToken(token) {
    this.userToken = token;
  }
}

const appStore = new AppStore();

export default appStore;
