import { customRender as annoTextCustomRender } from '../util/annotext';

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
