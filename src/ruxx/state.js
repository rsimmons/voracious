import EventEmitter from 'events';

export default class SubscribableState {
  constructor(initialState) {
    this.state = initialState;
    this.emitter = new EventEmitter();
  }

  get() {
    return this.state;
  }

  set(newState) {
    this.state = newState;
    this.emitter.emit('change');
  }

  subscribe(listener) {
    this.emitter.addListener('change', listener);
    return (() => { this.emitter.removeListener('change', listener); });
  }
};
