import React, { Component } from 'react';
import Infinite from 'react-infinite';
import escape from 'escape-html';

import './HighlightSet.css';

import AnnoText from './AnnoText.js';
import Button from './Button.js';
import Editable from './Editable.js';
import { getKind, customRender as annoTextCustomRender } from '../util/annotext';
import { downloadFile } from '../util/download';

const newlinesToBrs = s => s.replace(/\n/g, '<br/>');

export default class HighlightSet extends Component {
  handleExportTSV = () => {
    const { highlightSet } = this.props;

    const lines = [];
    for (const context of highlightSet.contexts) {
      const fields = [];

      fields.push(context.chunkUID); // Useful as a stable UID for Anki

      // Find (latest) timestamp of highlight annotations
      const latestTimestamp = Math.max(...getKind(context.primaryAnnoText, 'highlight').map(a => a.data.timeCreated));
      fields.push(latestTimestamp);

      const clozedAnnotextHTML = annoTextCustomRender(
        context.primaryAnnoText,
        (a, inner) => {
          if (a.kind === 'ruby') {
            return ['<ruby>', ...inner, '<rp>(</rp><rt>', escape(a.data), '</rt><rp>)</rp></ruby>'];
          } else if (a.kind === 'highlight') {
            const clozeNum = parseInt(a.id, 16) % 1000000000; // this is hacky (relies on uid being hex, etc), but should work pretty well to generate a unique cloze id
            return ['{{c' + clozeNum + '::', ...inner, '}}'];
          } else {
            return inner;
          }
        },
        (c, i) => (c === '\n' ? '<br/>' : escape(c))
      ).join('');
      fields.push(clozedAnnotextHTML);

      const translations = [];
      for (const sec of context.secondaryAnnoTexts) {
        for (const at of sec.annoTexts) {
          translations.push(newlinesToBrs(escape(at.text)));
        }
      }
      fields.push(translations.join('<br/>'));

      lines.push(fields.join('\t') + '\n');
    }
    downloadFile(lines.join(''), 'voracious_export-' + highlightSet.name + '-' + Date.now() + '.tsv', 'text/tab-separated-values');
  };

  render() {
    const { highlightSet, onDelete } = this.props;
    const ELEMENT_HEIGHT = 150;

    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <span style={{ float: 'right', fontSize: 14 }}>
            <Button onClick={this.handleExportTSV}>&darr; Export Set As TSV</Button>
            &nbsp;
            <Button onClick={onDelete}>× Delete Set</Button>
          </span>
          <span style={{ fontSize: 24 }}><Editable value={highlightSet.name} onUpdate={newName => { this.props.onSetName(newName); }}/></span>
        </div>
        <Infinite elementHeight={ELEMENT_HEIGHT} useWindowAsScrollContainer>
          {highlightSet.contexts.map((context, i) => (
            <div key={i} style={{height: ELEMENT_HEIGHT}} className="HighlightSet-context-list-item">
              <AnnoText annoText={context.primaryAnnoText} language={context.primaryLanguage} />
              <div>{context.secondaryAnnoTexts.map((sec, i) => (
                <div key={i}>{sec.annoTexts.map((t, i) => (
                  <AnnoText key={i} annoText={t} language={sec.language} alignment="left" />
                ))}</div>
              ))}</div>
            </div>
          ))}
        </Infinite>
      </div>
    );
  }
}
