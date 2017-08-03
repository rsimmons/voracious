import React, { Component } from 'react';

// Select, "uncontrolled" but watches changes
export default class Select extends Component {
  componentWillMount() {
    const { options, onSet } = this.props;
    if (options.length > 0) {
      onSet(options[0].value);
    }
  }

  render() {
    const { options, onSet } = this.props;
    return (
      <select onChange={e => onSet(e.target.value)}>
        {options.map((o, i) => <option key={i} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
}

