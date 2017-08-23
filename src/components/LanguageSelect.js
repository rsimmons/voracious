import React, { PureComponent } from 'react';

import Select from './Select';
import { SUPPORTED_LANGUAGES } from '../util/languages';

export default class LanguageSelect extends PureComponent {
  render() {
    const { value, onChange } = this.props;

    return (
      <Select value={value} onChange={onChange} options={SUPPORTED_LANGUAGES.map(lang => ({value: lang.ietf, label: lang.desc}))}/>
    );
  }
}
