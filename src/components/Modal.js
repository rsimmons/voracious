import React, { PureComponent } from 'react';

import './Modal.css';

export default class Modal extends PureComponent {
  handleClick = (e) => {
    if (e.target === e.currentTarget) {
      this.props.onClickOutside();
    }
  }

  render() {
    return (
      <div className="Modal" onClick={this.handleClick}>
        <div className="Modal-content">
          {this.props.children}
        </div>
      </div>
    );
  }
}
