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
    next();
  });

  it ('Simple lookups', async function() {
    let english = await getLanguageText('en-us');
    debug(english);
    expect(_.get(english, 'global.topic1.text_hi')).to.be.equal('Hi');
    expect(_.get(english, 'global.topic1.text_eaten')).to.be.equal('Have you eaten?');
  });

  it ('Priority lookups', async function() {
    let froren = await getLanguageText('fr, en-us');
    debug(froren);
    expect(_.get(froren, 'global.topic1.text_hi')).to.be.equal('Salut');
    expect(_.get(froren, 'global.topic1.text_eaten')).to.be.equal('Have you eaten?');
  });

  it ('Variant lookups', async function() {
    let zhtw = await getLanguageText('zh-tw');
    debug(zhtw);
    expect(_.get(zhtw, 'global.topic1.text_hi')).to.be.equal('你好');
    expect(_.get(zhtw, 'global.topic1.text_apple')).to.be.equal('一個蘋果');
  });

  it ('Default lookups', async function() {
    let nolang = await getLanguageText('xx-xx');
    debug(nolang);
    expect(_.get(nolang, 'global.topic1.text_universal')).to.be.equal('There are no languages');
    expect(_.get(nolang, 'global.topic1.text_apple')).to.be.equal('An apple');
  });

});
