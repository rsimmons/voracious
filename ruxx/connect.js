import { Component, createElement } from 'react'

export default function connect(store, mapRender) {
  class Connect extends Component {
    constructor(props) {
      super(props);

      // NOTE: At the time of writing, according to this thread (https://github.com/facebook/react/issues/7671) FB is planning to discourage the use of componentWillMount, and the recommended technique is to do initialization in the constructor.

      // Initialize component state to be store state
      this.state = {storeState: store.getState()};

      // Subscribe to store state changes
      this.unsubscribe = store.subscribe(() => {
        // NOTE: We don't assume that store state is immutable
        this.setState({storeState: store.getState()});
      });
    }

    componentWillUnmount() {
      // Unsubscribe from store
      this.unsubscribe();
    }

    render() {
      return mapRender(this.state.storeState, store.getActions());
    }
  }

  // The resulting connected component class doesn't take any props
  Connect.propTypes = {};

  return Connect;
}
