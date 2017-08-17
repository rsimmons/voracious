import React, { PureComponent } from 'react';

import RenderUnderBody from './RenderUnderBody';
import './Tooltip.css';

function getPageRect(el) {
  const r = el.getBoundingClientRect();
  const sx = window.scrollX;
  const sy = window.scrollY;

  return {
    left: r.left + sx,
    right: r.right + sx,
    top: r.top + sy,
    bottom: r.bottom + sy,
  }
}

export default class Tooltip extends PureComponent {
  render() {
    const { anchorElems, onMouseEnter, onMouseLeave, children } = this.props;

    const rects = anchorElems.map(el => getPageRect(el));
    const minY = Math.min(...rects.map(r => r.top));
    const topmostRects = rects.filter(r => r.top === minY);
    const minX = Math.min(...topmostRects.map(r => r.left));
    const maxX = Math.max(...topmostRects.map(r => r.right));
    const centerX = 0.5*(minX + maxX);
    const offsetY = -20; // TOOD: could be a prop

    return (
      <RenderUnderBody>
        <div className="Tooltip" style={{ top: minY+offsetY, left: centerX }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
          <div className="Tooltip-content">
            {children}
          </div>
          <div className="Tooltip-triangle">
          </div>
        </div>
      </RenderUnderBody>
    );
  }
}
