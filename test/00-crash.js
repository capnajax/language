'use strict';

import l from '../src/language.js';
import path from 'path';

describe('Crash test', function() {

  it ('Startup and look up a language without crashing', function () {

    l.setLanguageFilename(path.join('test', 'language.yaml'));
    l('xx-nonexistant-language');

  });

});
