import React, { PureComponent } from 'react';
import Immutable, { Record } from 'immutable';

import './AnnoText.css';

import Tooltip from './Tooltip';
import CopyInterceptor from './CopyInterceptor';

import { cpSlice } from '../util/string';
import { getKindAtIndex, getKindInRange, addAnnotation, customRender as annoTextCustomRender, clearKindInRange, getInRange, deleteAnnotation } from '../util/annotext';

const CPRange = new Record({
  cpBegin: null,
  cpEnd: null,
});

export default class AnnoText extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      selectionRange: null,
      hoverRange: null,
      tooltipExpandedEditing: false, // is the tooltip (if any) showing full edit controls?
    };
    this.charElem = {}; // map from cpIndex to element wrapping character
    this.hoverTimeout = null;
    this.dragStartIndex = null; // codepoint index of character that mousedown happened on, if mouse is still down
  }

  componentDidMount() {
  }

  componentWillUnmount() {
    document.removeEventListener('mouseup', this.handleMouseUp);

    this.clearHoverTimeout();
  }

  clearHoverTimeout() {
    if (this.hoverTimeout) {
      window.clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
  }

  setHoverTimeout() {
    if (this.hoverTimeout) {
      window.clearTimeout(this.hoverTimeout);
    }
    this.hoverTimeout = window.setTimeout(
      () => { this.setState({ hoverRange: null }); this.hoverTimeout = null; },
      500
    );
  }

  setSelRange = (newSelRange) => {
    if (!Immutable.is(newSelRange, this.state.selectionRange)) {
      this.setState({selectionRange: newSelRange});
    }
  };

  clearSelection = () => {
    this.setSelRange(null);
  }

  setSelection = (begin, end) => {
    this.setSelRange(new CPRange({cpBegin: begin, cpEnd: end}));
  }

  handleMouseUp = (e) => {
    this.dragStartIndex = null;
    document.removeEventListener('mouseup', this.handleMouseUp);
  };

  wordRangeFromIndex = (cpIndex) => {
    const hitWordAnnos = getKindAtIndex(this.props.annoText, 'word', cpIndex);
    if (hitWordAnnos.length > 0) {
      const a = hitWordAnnos[0];
      return new CPRange({cpBegin: a.cpBegin, cpEnd: a.cpEnd});
    } else {
      return null;
    }
  };

  handleCharMouseDown = (e) => {
    e.preventDefault();
    const cpIndex = +e.currentTarget.getAttribute('data-index');
    this.dragStartIndex = cpIndex;
    if (this.state.selectionRange && (cpIndex >= this.state.selectionRange.cpBegin) && (cpIndex < this.state.selectionRange.cpEnd)) {
      this.clearSelection();
    } else {
      if (this.state.hoverRange) {
        this.setSelection(this.state.hoverRange.cpBegin, this.state.hoverRange.cpEnd);
      } else {
        this.setSelection(cpIndex, cpIndex+1);
      }
    }
    document.addEventListener('mouseup', this.handleMouseUp);
  };

  handleCharMouseEnter = (e) => {
    const cpIndex = +e.currentTarget.getAttribute('data-index');

    this.setState({hoverRange: this.wordRangeFromIndex(cpIndex)});

    if (this.dragStartIndex !== null) {
      let a = this.dragStartIndex;
      let b = cpIndex;
      if (b < a) {
        [a, b] = [b, a];
      }
      this.setSelection(a, b+1);
    }
    this.clearHoverTimeout();
  };

  handleCharMouseLeave = (e) => {
    this.setHoverTimeout();
  };

  handleSetRuby = () => {
    const { annoText, onUpdate } = this.props;
    const rubyText = this.setRubyTextInput.value.trim();
    const tooltipRange = this.state.selectionRange || this.state.hoverRange;
    const {cpBegin, cpEnd} = tooltipRange;
    let newAnnoText = clearKindInRange(annoText, cpBegin, cpEnd, 'ruby');
    if (rubyText !== '') {
      newAnnoText = addAnnotation(newAnnoText, cpBegin, cpEnd, 'ruby', rubyText);
    }
    onUpdate(newAnnoText);
  };

  handleSetWord = () => {
    const { annoText, onUpdate } = this.props;
    const lemma = this.setWordLemmaTextInput.value.trim();
    const data = lemma === '' ? {} : {lemma};
    const tooltipRange = this.state.selectionRange || this.state.hoverRange;
    const {cpBegin, cpEnd} = tooltipRange;
    const newAnnoText = addAnnotation(annoText, cpBegin, cpEnd, 'word', data);
    onUpdate(newAnnoText);
  };

  addHighlightOnRange = (setId, range) => {
    const { annoText, onUpdate } = this.props;
    const {cpBegin, cpEnd} = range;
    // TODO: the data for the annotation should be immutable, a Record
    const newAnnoText = addAnnotation(annoText, cpBegin, cpEnd, 'highlight', {timeCreated: Date.now(), setId: setId});
    onUpdate(newAnnoText);
  };

  removeHighlightOnRange = (setId, range) => {
    const { annoText, onUpdate } = this.props;
    const {cpBegin, cpEnd} = range;
    const newAnnoText = clearKindInRange(annoText, cpBegin, cpEnd, 'highlight');
    onUpdate(newAnnoText);
  };

  handleTooltipMouseEnter = () => {
    this.clearHoverTimeout();
  };

  handleTooltipMouseLeave = () => {
    this.setHoverTimeout();
  };

  handleTooltipExpandedEditClick = (e) => {
    e.preventDefault();
    this.setState(state => ({ ...state, tooltipExpandedEditing: !state.tooltipExpandedEditing}));
  };

  renderTooltipEditControls = (tooltipRange) => {
    const { annoText, onUpdate, highlightSets } = this.props;

    if (!onUpdate) {
      return null;
    }

    const annosInRange = getInRange(annoText, tooltipRange.cpBegin, tooltipRange.cpEnd);

    // For each highlight set, determine if there are any highlight
    //  annos that intersect tooltipRange.
    const existingHighlight = {};
    const rangeHighlights = getKindInRange(annoText, 'highlight', tooltipRange.cpBegin, tooltipRange.cpEnd);
    for (const s of highlightSets.values()) {
      existingHighlight[s.id] = rangeHighlights.some(h => h.data.setId === s.id);
    }

    return (
      <div className="AnnoText-edit-controls">
        <div style={{textAlign: 'center'}}>
          <span>
            {highlightSets.valueSeq().map(s => existingHighlight[s.id] ? (
              <button key={s.id} onClick={(e) => {
                this.removeHighlightOnRange(s.id, tooltipRange);
                // Blur so that subsequent space/enter to play video doesn't cause button press
                e.currentTarget.blur();
              }}>- {s.name}</button>
            ) : (
              <button key={s.id} onClick={(e) => {
                this.addHighlightOnRange(s.id, tooltipRange);
                // Blur so that subsequent space/enter to play video doesn't cause button press
                e.currentTarget.blur();
              }}>+ {s.name}</button>
            ))}
          </span>
          &nbsp;&nbsp;<button onClick={this.handleTooltipExpandedEditClick}>Edit</button>
        </div>
        {this.state.tooltipExpandedEditing ? (
          <form style={{marginTop: 10}}>
            <input ref={(el) => { this.setRubyTextInput = el; }} placeholder="ruby text" /><button type="button" onClick={this.handleSetRuby} >Set Ruby</button><br />
            <input ref={(el) => { this.setWordLemmaTextInput = el; }} placeholder="lemma" /><button type="button" onClick={this.handleSetWord} >Set Word</button><br />
            <br />
            {annosInRange.map((a, i) => (
              <div key={i}>[{cpSlice(annoText.text, a.cpBegin, a.cpEnd)}]:{a.kind}={(() => {
                switch (a.kind) {
                  case 'highlight':
                    return 'set:' + highlightSets.get(a.data.setId).name;
                  case 'ruby':
                    return '[' + a.data + ']';
                  case 'word':
                    return JSON.stringify(a.data);
                  default:
                    return '';
                }
              })()} <button onClick={(e) => {
                e.preventDefault();
                onUpdate(deleteAnnotation(annoText, a));
              }}>X</button></div>
            ))}
          </form>
        ) : null}
      </div>
    );
  }

  renderTooltip = () => {
    const { annoText } = this.props;

    const tooltipRange = this.state.selectionRange || this.state.hoverRange;

    if (tooltipRange) {
      const hitWordAnnos = getKindInRange(annoText, 'word', tooltipRange.cpBegin, tooltipRange.cpEnd);
      const limitedHitWordAnnos = hitWordAnnos.slice(0, 3);

      const anchorElems = [];
      for (let i = tooltipRange.cpBegin; i < tooltipRange.cpEnd; i++) {
        const el = this.charElem[i];
        if (el) {
          anchorElems.push(el);
        }
      }

      return (
        <Tooltip anchorElems={anchorElems} onMouseEnter={this.handleTooltipMouseEnter} onMouseLeave={this.handleTooltipMouseLeave}>
          <div className="AnnoText-tooltip">
            <ul className="AnnoText-tooltip-dictionary-hits">
              {limitedHitWordAnnos.map(wordAnno => {
                const lemma = wordAnno.data.lemma || cpSlice(annoText.text, wordAnno.cpBegin, wordAnno.cpEnd);
                const encLemma = encodeURIComponent(lemma);
                return (
                  <li key={`wordinfo-${wordAnno.cpBegin}:${wordAnno.cpEnd}`} className="AnnoText-tooltip-dictionary-hit">
                    <div className="AnnoText-tooltip-word">{lemma}</div>
                    <div className="AnnoText-tooltip-links">
                      <a className="AnnoText-dict-linkout" href={'http://ejje.weblio.jp/content/' + encLemma} target="_blank">Weblio</a>{' '}
                      <a className="AnnoText-dict-linkout" href={'http://eow.alc.co.jp/search?q=' + encLemma} target="_blank">ALC</a>{' '}
                      <a className="AnnoText-dict-linkout" href={'http://dictionary.goo.ne.jp/srch/all/' + encLemma + '/m0u/'} target="_blank">goo</a>{' '}
                      <a className="AnnoText-dict-linkout" href={'http://tangorin.com/general/' + encLemma} target="_blank">Tangorin</a>
                    </div>
                  </li>
                );
              })}
            </ul>
            {(hitWordAnnos.length > limitedHitWordAnnos.length) ? (
              <div style={{fontSize: '0.5em', marginTop: 10, textAlign: 'center', fontStyle: 'italic'}}> and {hitWordAnnos.length - limitedHitWordAnnos.length} more...</div>
            ) : null}
            {this.renderTooltipEditControls(tooltipRange)}
          </div>
        </Tooltip>
      );
    } else {
      return null;
    }
  };

  render() {
    const { annoText, language } = this.props;

    const annoTextChildren = annoTextCustomRender(
      annoText,
      (a, inner) => {
        if (a.kind === 'ruby') {
          return [<ruby key={`ruby-${a.cpBegin}:${a.cpEnd}`}>{inner}<rp>(</rp><rt>{a.data}</rt><rp>)</rp></ruby>];
        } else if (a.kind === 'highlight') {
          return [<span key={`highlight-${a.cpBegin}:${a.cpEnd}`} className='AnnoText-highlight'>{inner}</span>];
        } else {
          return inner;
        }
      },
      (c, i) => {
        if (c === '\n') {
          return <br key={`char-${i}`} />;
        } else {
          const classNames = ['AnnoText-textchar'];
          if ((this.state.selectionRange !== null) && (i >= this.state.selectionRange.cpBegin) && (i < this.state.selectionRange.cpEnd)) {
            classNames.push('AnnoText-selected');
          } else if ((this.state.hoverRange !== null) && (i >= this.state.hoverRange.cpBegin) && (i < this.state.hoverRange.cpEnd)) {
            classNames.push('AnnoText-hover');
          }

          return <span className={classNames.join(' ')} onMouseDown={this.handleCharMouseDown} onMouseEnter={this.handleCharMouseEnter} onMouseLeave={this.handleCharMouseLeave} data-index={i} key={`char-${i}`} ref={(el) => { this.charElem[i] = el; }}>{c}</span>;
        }
      }
    );

/*
    const annoTextHTML = annoTextCustomRender(
      annoText,
      (a, inner) => {
        if (a.kind === 'ruby') {
          return ['<ruby>', ...inner, '<rp>(</rp><rt>', escape(a.data), '</rt><rp>)</rp></ruby>'];
        } else {
          return inner;
        }
      },
      (c, i) => (c === '\n' ? '<br/>' : escape(c))
    ).join('');
*/
    return (
      <div className="AnnoText">
        <div {... ((language === 'und' ? {} : {lang: language}))}>{annoTextChildren}</div>
        {this.renderTooltip()}
        {this.state.selectionRange ? (
          <CopyInterceptor copyData={[{format: 'text/plain', data: cpSlice(annoText.text, this.state.selectionRange.cpBegin, this.state.selectionRange.cpEnd)}]}/>
        ) : null}
      </div>
    );
  }
}
