'use strict';

import getLanguageText from '../src/language.js';
import path from 'path';

describe('Crash test', function() {

  it ('Startup and look up a language without crashing', async function() {

    getLanguageText.setLanguageFilename(path.join('test', 'language.yaml'));
    await getLanguageText('xx-nonexistant-language');

  });

});
