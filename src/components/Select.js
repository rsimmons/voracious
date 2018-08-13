import React, { Component } from 'react';

export default class Select extends Component {
  render() {
    const { value, options, onChange } = this.props;
    return (
      <select style={{verticalAlign: 'bottom'}} value={value} onChange={e => { onChange && onChange(e.target.value)}}>
        {options.map((o, i) => <option key={i} value={o.value} disabled={!!o.disabled}>{o.label}</option>)}
      </select>
    );
  }
}

