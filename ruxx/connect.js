import { Component } from 'react'

export default class StateMapper extends Component {
  constructor(props) {
    super(props);

    // NOTE: At the time of writing, according to this thread (https://github.com/facebook/react/issues/7671) FB is planning to discourage the use of componentWillMount, and the recommended technique is to do initialization in the constructor.

    // Initialize component state to be "actual" state
    this.state = {actualState: this.props.subscribableState.get()};

    // Subscribe to state changes
    this.unsubscribe = this.props.subscribableState.subscribe(() => {
      // NOTE: We don't assume that store state is immutable
      this.setState({actualState: this.props.subscribableState.get()});
    });
  }

  componentWillUnmount() {
    // Unsubscribe from state changes
    this.unsubscribe();
  }

  render() {
    return this.props.renderState(this.state.actualState);
  }
}

// TODO: set propTypes
