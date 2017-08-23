import React, { Component } from 'react';

export default class Select extends Component {
  render() {
    const { value, options, onChange } = this.props;
    return (
      <select value={value} onChange={e => { onChange && onChange(e.target.value)}}>
        {options.map((o, i) => <option key={i} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
}

