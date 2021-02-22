'use strict';

import debugModule from '@capnajax/debug';
import getLanguageText from '../src/language.js';
import path from 'path';
import { expect } from 'chai';
import _ from 'lodash';

let debug = debugModule('@capnajax/language:test');

describe('Lookups test', function() {

  this.beforeAll(function(next) {
    getLanguageText.setLanguageFilename(path.join('test', 'language.yaml'));
    getLanguageText.setMaxLanguageCacheSize(6);
    getLanguageText.setMinLanguageCacheSize(4);
    next();
  });

  it('should purge the cache', function(done) {
    if (!process.env.TEST_LANGUAGE) {
      this.skip();
      return;
    }
    this.slow(250);

    getLanguageText('en-us, xx-xx;q=0.9');
    getLanguageText('en-us, xx-xx;q=0.8');
    getLanguageText('en-us, xx-xx;q=0.7');
    getLanguageText('en-us, xx-xx;q=0.6');
    getLanguageText('en-us, xx-xx;q=0.5');
    getLanguageText('en-us, xx-xx;q=0.4');
    getLanguageText('en-us, xx-xx;q=0.3');
    getLanguageText('en-us, xx-xx;q=0.2');

    setTimeout(() => {
      let sglt = _.size(getLanguageText._languages);
      debug('getLanguageText._languages:');
      debug(getLanguageText._languages);
      expect(sglt).to.be.equal(4);
      expect(_.keys(getLanguageText._languages)).to.include('en-us, xx-xx;q=0.2');
      expect(_.keys(getLanguageText._languages)).to.not.include('en-us, xx-xx;q=0.9');
      done();
    }, 100);

  });


});
