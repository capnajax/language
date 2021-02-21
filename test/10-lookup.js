'use strict';

import debugModule from '@capnajax/debug';
import l from '../src/language.js';
import path from 'path';
import { expect } from 'chai';
import _ from 'lodash';

let debug = debugModule('@capnajax/language:test');

describe('Lookups test', function() {

  this.beforeAll(function(next) {
    l.setLanguageFilename(path.join('test', 'language.yaml'));
    next();
  });

  it ('Simple lookups', async function () {
    let english = await l('en-us');
    debug(english);
    expect(_.get(english, 'global.topic1.text-hi')).to.be.equal('Hi');
    expect(_.get(english, 'global.topic1.text-eaten')).to.be.equal('Have you eaten?');
  });

  it ('Priority lookups', async function () {
    let froren = await l('fr, en-us');
    debug(froren);
    expect(_.get(froren, 'global.topic1.text-hi')).to.be.equal('Salut');
    expect(_.get(froren, 'global.topic1.text-eaten')).to.be.equal('Have you eaten?');
  });

  it ('Variant lookups', async function () {
    let zhtw = await l('zh-tw');
    debug(zhtw);
    expect(_.get(zhtw, 'global.topic1.text-hi')).to.be.equal('你好');
    expect(_.get(zhtw, 'global.topic1.text-apple')).to.be.equal('一個蘋果');
  });

  it ('Default lookups', async function () {
    let nolang = await l('xx-xx');
    debug(nolang);
    expect(_.get(nolang, 'global.topic1.text-universal')).to.be.equal('There are no languages');
    expect(_.get(nolang, 'global.topic1.text-apple')).to.be.equal('An apple');
  });

});
