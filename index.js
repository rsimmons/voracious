import React from 'react';
import { render } from 'react-dom';

import RootComponent from './components';
import MainStore from './mainStore';

import { connect } from './ruxx';

// Load Kuromoji right away
import { loadKuromoji } from './util/analysis';
loadKuromoji();

const store = new MainStore();

const ConnectedRootComponent = connect(store, (state, actions) => <RootComponent mainState={state} actions={actions} />);

render(<ConnectedRootComponent />, document.getElementById('root'));
