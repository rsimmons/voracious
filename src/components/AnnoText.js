import React, { PureComponent } from 'react';
import Immutable, { Record } from 'immutable';

import { cpSlice } from '../util/string';
import { getKindAtIndex, addAnnotation, customRender as annoTextCustomRender, clearKindInRange, getInRange, deleteAnnotation } from '../util/annotext';

// ClipboardCopier
class ClipboardCopier extends PureComponent {
  onSubmit = (e) => {
    e.preventDefault();
    // TODO: could check input is set and input.select is truthy, and wrap copy+blur in a try block
    this.inputElem.select();
    document.execCommand('copy');
    this.inputElem.blur();
  }

  render() {
    const { text, buttonText } = this.props;
    return (
      <form onSubmit={this.onSubmit}>
        <input style={{ /*width: '2em'*/ }} type="text" value={text} readOnly ref={(el) => { this.inputElem = el; }} />
        <button type="submit">{buttonText}</button>
      </form>
    );
  }
}

const CPRange = new Record({
  cpBegin: null,
  cpEnd: null,
});

export default class AnnoText extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      selectionRange: null,
      inspectedIndex: null, // codepoint index of char we're doing a "tooltip" for
    };
    this.tooltipTimeout = null; // it does not work to have this in state
    this.dragStartIndex = null; // codepoint index of character that mousedown happened on, if mouse is still down
  }

  componentDidMount() {
  }

  componentWillUnmount() {
    document.removeEventListener('mouseup', this.handleMouseUp);

    this.clearTooltipTimeout();
  }

  clearTooltipTimeout() {
    if (this.tooltipTimeout) {
      window.clearTimeout(this.tooltipTimeout);
      this.tooltipTimeout = null;
    }
  }

  setTooltipTimeout() {
    if (this.tooltipTimeout) {
      window.clearTimeout(this.tooltipTimeout);
    }
    this.tooltipTimeout = window.setTimeout(
      () => { this.setState({ inspectedIndex: null }); this.tooltipTimeout = null; },
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

  handleCharMouseDown = (e) => {
    e.preventDefault();
    const cpIndex = +e.currentTarget.getAttribute('data-index');
    this.dragStartIndex = cpIndex;
    if (this.state.selectionRange && (cpIndex >= this.state.selectionRange.cpBegin) && (cpIndex < this.state.selectionRange.cpEnd)) {
      this.clearSelection();
    } else {
      this.setSelection(cpIndex, cpIndex+1);
    }
    document.addEventListener('mouseup', this.handleMouseUp);
  };

  handleCharMouseEnter = (e) => {
    const cpIndex = +e.currentTarget.getAttribute('data-index');
    this.setState({inspectedIndex: cpIndex});
    if (this.dragStartIndex !== null) {
      let a = this.dragStartIndex;
      let b = cpIndex;
      if (b < a) {
        [a, b] = [b, a];
      }
      this.setSelection(a, b+1);
    }
    this.clearTooltipTimeout();
  };

  handleCharMouseLeave = (e) => {
    this.setTooltipTimeout();
  };

  handleSetRuby = () => {
    const { annoText, onUpdate } = this.props;
    const rubyText = this.setRubyTextInput.value.trim();
    const {cpBegin, cpEnd} = this.state.selectionRange;
    let newAnnoText = clearKindInRange(annoText, cpBegin, cpEnd, 'ruby');
    if (rubyText !== '') {
      newAnnoText = addAnnotation(newAnnoText, cpBegin, cpEnd, 'ruby', rubyText);
    }
    onUpdate(newAnnoText);
    this.clearSelection();
  };

  handleSetLemma = () => {
    const { annoText, onUpdate } = this.props;
    const lemmaText = this.setLemmaTextInput.value.trim();
    if (lemmaText === '') {
      return;
    }
    const {cpBegin, cpEnd} = this.state.selectionRange;
    const newAnnoText = addAnnotation(annoText, cpBegin, cpEnd, 'lemma', lemmaText);
    onUpdate(newAnnoText);
    this.clearSelection();
  };

  handleAddHighlight = () => {
    const { annoText, onUpdate } = this.props;
    const {cpBegin, cpEnd} = this.state.selectionRange;
    // TODO: the data for the annotation should be immutable, a Record
    let newAnnoText = addAnnotation(annoText, cpBegin, cpEnd, 'highlight', {timeCreated: Date.now(), setId: this.props.activeSetId});
    onUpdate(newAnnoText);
    this.clearSelection();
  };

  render() {
    const { annoText, language, onUpdate, highlightSets, activeSetId, onSetActiveSetId } = this.props;

    const inspectedIndex = this.state.inspectedIndex;
    const hitLemmaInfoElems = [];
    const hitLemmaIndexes = new Set();
    if (inspectedIndex !== null) {
      const hitLemmaAnnos = getKindAtIndex(annoText, 'lemma', inspectedIndex);
      hitLemmaAnnos.forEach((lemmaAnno) => {
        var encLemma = encodeURIComponent(lemmaAnno.data);
        hitLemmaInfoElems.push(
          <span key={`wordinfo-${lemmaAnno.cpBegin}:${lemmaAnno.cpEnd}`}>{lemmaAnno.data}<br />
            <span style={{ fontSize: '0.5em' }}>
              <a className="dict-linkout" href={'http://ejje.weblio.jp/content/' + encLemma} target="_blank">Weblio</a>{' '}
              <a className="dict-linkout" href={'http://eow.alc.co.jp/search?q=' + encLemma} target="_blank">ALC</a>{' '}
              <a className="dict-linkout" href={'http://dictionary.goo.ne.jp/srch/all/' + encLemma + '/m0u/'} target="_blank">goo</a>{' '}
              <a className="dict-linkout" href={'http://tangorin.com/general/' + encLemma} target="_blank">Tangorin</a>
            </span>
          </span>
        );
      });
      hitLemmaAnnos.forEach((lemmaAnno) => {
        for (let i = lemmaAnno.cpBegin; i < lemmaAnno.cpEnd; i++) {
          hitLemmaIndexes.add(i);
        }
      });
    }
    const selectedIndexes = new Set();
    if (this.state.selectionRange) {
      for (let i = this.state.selectionRange.cpBegin; i < this.state.selectionRange.cpEnd; i++) {
        selectedIndexes.add(i);
      }
    }

    let annosInSelection = [];
    if (this.state.selectionRange) {
      annosInSelection = getInRange(annoText, this.state.selectionRange.cpBegin, this.state.selectionRange.cpEnd);
    }

    const annoTextChildren = annoTextCustomRender(
      annoText,
      (a, inner) => {
        if (a.kind === 'ruby') {
          return [<ruby key={`ruby-${a.cpBegin}:${a.cpEnd}`}>{inner}<rp>(</rp><rt>{a.data}</rt><rp>)</rp></ruby>];
        } else if (a.kind === 'highlight') {
          return [<span key={`highlight-${a.cpBegin}:${a.cpEnd}`} className='annotext-highlight'>{inner}</span>];
        } else {
          return inner;
        }
      },
      (c, i) => {
        if (c === '\n') {
          return <br key={`char-${i}`} />;
        } else {
          const isInspected = (i === inspectedIndex);

          const toolTipElem = (isInspected && (hitLemmaInfoElems.length > 0))
            ? <span style={{zIndex: 100}}><span className="textchar-tooltip">{hitLemmaInfoElems}</span><span className="textchar-tooltip-triangle"> </span></span>
            : '';

          const classNames = ['textchar'];
          if (isInspected) {
            classNames.push('inspected');
          }
          if (selectedIndexes.has(i)) {
            classNames.push('selected');
          } else if (hitLemmaIndexes.has(i)) {
            classNames.push('word');
          }

          return <span className={classNames.join(' ')} onMouseDown={this.handleCharMouseDown} onMouseEnter={this.handleCharMouseEnter} onMouseLeave={this.handleCharMouseLeave} data-index={i} key={`char-${i}`}>{toolTipElem}{c}</span>;
        }
      }
    );

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

    const floatWidth = '240px';
    return (
      <div>
        <div style={{ float: 'right', width: floatWidth, textAlign: 'left', backgroundColor: '#eee', padding: '10px', fontSize: '12px' }}>
          <ClipboardCopier text={annoTextHTML} buttonText="Copy HTML" />
          {(this.state.selectionRange && onUpdate) ? (
            <form>
              <input ref={(el) => { this.setRubyTextInput = el; }} placeholder="ruby text" /><button type="button" onClick={this.handleSetRuby} >Set Ruby</button><br />
              <input ref={(el) => { this.setLemmaTextInput = el; }} placeholder="lemma" /><button type="button" onClick={this.handleSetLemma} >Set Lemma</button><br />
              <select value={activeSetId} onChange={e => onSetActiveSetId(e.target.value)}>
                {highlightSets.valueSeq().map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button type="button" onClick={this.handleAddHighlight} {...(highlightSets.isEmpty() ? {disabled: true} : {})}>Highlight</button>
              <br />
              {annosInSelection.map(a => (
                <div key={a.id}>[{cpSlice(annoText.text, a.cpBegin, a.cpEnd)}]:{a.kind}={a.kind === 'highlight' ? ('set:' + highlightSets.get(a.data.setId).name) : ('[' + a.data + ']')} <button onClick={(e) => {
                  e.preventDefault();
                  onUpdate(deleteAnnotation(annoText, a.id));
                }}>X</button></div>
              ))}
            </form>
          ) : ''}
        </div>
        <div style={{ margin: '0 ' + floatWidth }} lang={language} ref={(el) => { this.textContainerElem = el; }}>{annoTextChildren}</div>
      </div>
    );
  }
}
