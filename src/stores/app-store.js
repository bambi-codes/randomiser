import { makeAutoObservable } from "mobx";

class AppStore {
  userToken = "lalala";

  constructor() {
    makeAutoObservable(this);
  }
}

const appStore = new AppStore();

export default appStore;
