import React from 'react';
import { render } from 'react-dom';

import RootComponent from './components';
import MainActions from './mainActions';

import { SubscribableState, StateMapper } from './ruxx';

// Load Kuromoji right away
import { loadKuromoji } from './util/analysis';
loadKuromoji();

const subscribableMainState = new SubscribableState();
const actions = new MainActions(subscribableMainState);

render(<StateMapper subscribableState={subscribableMainState} renderState={state => <RootComponent mainState={state} actions={actions} />} />, document.getElementById('root'));
