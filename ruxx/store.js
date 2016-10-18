import EventEmitter from 'events';

export default function createStoreClass(initialState, unboundActions) {
  class Store {
    constructor() {
      this.state = initialState;

      this.boundActions = {};
      for (const k in unboundActions) {
        // TODO: instead of binding to this, we probably want to bind to a diff object with just getState (or read-only state property) and setState?
        this.boundActions[k] = unboundActions[k].bind(this);
      }

      this.emitter = new EventEmitter();
    }

    getState() {
      return this.state;
    }

    // TODO: this should only be exposed to bound actions?
    setState(newState) {
      this.state = newState;
      // console.log('setState:', JSON.stringify(this.state));
      this.emitter.emit('change');
    }

    getActions() {
      return this.boundActions;
    }

    subscribe(listener) {
      this.emitter.addListener('change', listener);
      return (() => { this.emitter.removeListener('change', listener); });
    }
  }

  return Store;
}
