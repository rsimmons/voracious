import React, { Component } from 'react';

import './SecondaryScreen.css';

import WidthWrapper from './WidthWrapper.js';

export default class SecondaryScreen extends Component {
  render() {
    const { title, children } = this.props;

    return (
      <WidthWrapper>
        <div className="SecondaryScreen-header header-font">
          {title}
        </div>
        <div className="SecondaryScreen-below-header">
          {children}
        </div>
      </WidthWrapper>
    );
  }
}
