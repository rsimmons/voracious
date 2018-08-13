import React, { Component } from 'react';
import './Button.css';

export default class Button extends Component {
  handleClick = (e) => {
    e.preventDefault();
    this.props.onClick();
  }

  render() {
    const disabled = !!this.props.disabled;
    return <button onClick={this.handleClick} disabled={disabled} className="Button">{this.props.children}</button>
  }
}
