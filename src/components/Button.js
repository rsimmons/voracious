import React, { Component } from 'react';
import './Button.css';

export default class Button extends Component {
  handleClick = (e) => {
    e.preventDefault();
    this.props.onClick();
  }

  render() {
    return <button onClick={this.handleClick} className="Button">{this.props.children}</button>
  }
}
