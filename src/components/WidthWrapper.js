import React from 'react';

import './WidthWrapper.css';

export default function WidthWrapper(props) {
  return (
    <div className="WidthWrapper">
      {props.children}
    </div>
  );
}
