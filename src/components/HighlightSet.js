import React, { Component } from 'react';
import Infinite from 'react-infinite';
import escape from 'escape-html';
import shajs from 'sha.js';

import './HighlightSet.css';

import AnnoText from './AnnoText.js';
import Button from './Button.js';
import Editable from './Editable.js';
import { customRender as annoTextCustomRender } from '../util/annotext';
import { downloadFile } from '../util/download';
import { cpSlice } from '../util/string';

const newlinesToBrs = s => s.replace(/\n/g, '<br/>');

export default class HighlightSet extends Component {
  handleExportTSV = () => {
    const { highlightSet } = this.props;

    const lines = [];
    for (const context of highlightSet.contexts) {
      const fields = [];

      fields.push(context.primary.chunkId); // Useful as a stable UID for Anki

      fields.push(context.latestHighlightTimestamp);

      const clozedAnnotextHTML = annoTextCustomRender(
        context.primary.annoText,
        (a, inner) => {
          if (a.kind === 'ruby') {
            return ['<ruby>', ...inner, '<rp>(</rp><rt>', escape(a.data), '</rt><rp>)</rp></ruby>'];
          } else if (a.kind === 'highlight') {
            // Compute cloze number as a hash of contained text.
            //  Hacky, but will give us stable cloze ids.
            const textSlice = cpSlice(context.primary.annoText.text, a.cpBegin, a.cpEnd);
            const clozeNum = parseInt(shajs('sha1').update(textSlice).digest('hex'), 16) % 1000000000;
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
    const { highlightSet, onDelete, onSetName, onSourceSetChunkAnnoText, highlightSets } = this.props;
    const ELEMENT_HEIGHT = 150;

    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <span style={{ float: 'right', fontSize: 14 }}>
            <Button onClick={this.handleExportTSV}>&darr; Export Set As TSV</Button>
            &nbsp;
            <Button onClick={onDelete}>× Delete Set</Button>
          </span>
          <span style={{ fontSize: 24 }}><Editable value={highlightSet.name} onUpdate={newName => { onSetName(newName); }}/></span>
        </div>
        <Infinite elementHeight={ELEMENT_HEIGHT} useWindowAsScrollContainer>
          {highlightSet.contexts.map((context, i) => (
            <div key={i} style={{height: ELEMENT_HEIGHT}} className="HighlightSet-context-list-item">
              <AnnoText annoText={context.primary.annoText} language={context.primary.language} onUpdate={(newAnnoText) => { onSourceSetChunkAnnoText(context.sourceId, context.primary.textNum, context.primary.chunkId, newAnnoText); }} highlightSets={highlightSets} />
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
