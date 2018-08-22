import React, { Component } from 'react';

export default class ErrorDisplay extends Component {
  constructor(props) {
    super(props);
    this.state = { hadError: false, errorText: '' };
  }

  componentDidMount() {
    this.props.errorEmitter.addListener('error', this.handleError);
  }

  componentWillUnmount() {
    this.props.errorEmitter.removeListener('error', this.handleError);
  }

  handleError = (err) => {
    this.setState({ hadError: true, errorText: err.toString() });
  }

  render() {
    if (this.state.hadError) {
      return (
        <div style={{textAlign: 'center'}}>
          <h1>Something has gone terribly wrong</h1>
          <p style={{color: 'red'}}>{this.state.errorText}</p>
          <p>Also, a panel on the right should have opened with more debug info. Maybe take a screenshot of everything and send it to me.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
