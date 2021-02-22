'use strict';

import { promises as fs } from 'fs';
import _ from 'lodash';
import path from 'path';
import yaml from 'yaml';

const CACHE_PURGE_TIME = 50;
const IS_TESTING = !!process.env.TEST_LANGUAGE;

const debugEnabled = (() => {
  if (_.has(process.env, 'DEBUG')) {
    if (process.env.DEBUG.match(/@capnajax\/language(,|$)/)) {
      return true;
    }
  }
  return false;
})();

let languageFilename = path.resolve('language.yaml');
let languageFile;

/**
 * So the language text is only calculated once for any given Accept-Language
 * header.
 * DO NOT SET THIS DIRECTLY or it'll harm unit testing. Use the `setLanguages`
 * method.
 */
let _languages;

let maxLanguageCacheSize = 0;
let minLanguageCacheSize = Number.MAX_SAFE_INTEGER;

function calculatePreferenceOrder(acceptLanguage) {

  // default preference
  let result = ['all', 'en', 'en-us'];

  let als = _.map(acceptLanguage.split('/, */'), (al, i) => {
    let breakdown = al.match(/^(\w\w)([_-]([\w_-]+))?(;(q=([0-9\.]+))?)?/);
    let result = {
      language: breakdown[1],
      variant: breakdown[3],
      qfactor: breakdown[6],
      sequence: i
    }
    _.isNil(result.qfactor) && (result.qfactor = 1);
    _.isNil(result.variant) || (result.variant = result.variant.toLowerCase());
    // negative qfactor
    result.nqfactory = 0 - result.qfactor;
    return result;
  });
  als = _.sortBy(als, ['nqfactor', 'sequence']);
  while(als.length > 0) {
    let al = als.pop();
    result.unshift(al.language);
    if (!_.isNil(al.variant)) {
      result.unshift(`${al.language}-${al.variant}`)
    }
  }

  return result;
}

function debug(method, ...items) {
  if (debugEnabled) {
    if (items.length == 0) {
      console.log(method);
    } else if (items.length == 1 && !_.isString(_.first(items))) {
      console.log(_.first(items));
    } else {
      console.log.apply(null, 
        [`  @capnajax/language [${method}]`]
          .concat(items));
    }
  }
}

async function getLanguageText(acceptLanguage) {

  acceptLanguage = sanitizeAcceptHeader(acceptLanguage);

  if (!languageFile) {
    setLanguages({});
    try {
      let readFile = await fs.readFile(languageFilename);
      languageFile = yaml.parse(readFile.toString());
    } catch(reason) {
      throw {message: 'Failed to load language file:', reason};
    }
  }

  if (_.has(_languages, acceptLanguage)) {
    let languageEntry = _languages[acceptLanguage];
    updatePriorty(acceptLanguage);
    return languageEntry.text;
  } else {
    return processLanguage(acceptLanguage);
  }
}

/**
 * Create language object for an acceptLanguage header
 * @param {String} acceptLanguage the `Accept-Language` header text
 */
function processLanguage(acceptLanguage) {

  let resultPairs = [];
  let result = {};
  let preferenceOrder = calculatePreferenceOrder(acceptLanguage);

  let levelsToProcess = _.keys(languageFile);

  for (let i = 0; i < levelsToProcess.length; i++) {
    let li = _.get(languageFile, levelsToProcess[i]);
    if (_.isObject(li) && !_.isArray(li)) {
      levelsToProcess = levelsToProcess.concat(_.map(_.keys(li), j => {
        return `${levelsToProcess[i]}.${j}`;
      }));
    }
  }

  for (let level of levelsToProcess) {
    let ll = _.get(languageFile, level);
    if (_.isArray(ll)) {
      resultPairs = resultPairs.concat(_.map(ll, languageItem => {
        let translation = selectPreferredLanguage(preferenceOrder, languageItem);
        translation[0] = `${level}.${translation[0]}`
        return translation;
      }));
    }
  }

  for (let pair of resultPairs) {
    _.set(result, pair[0], pair[1]);
  }
  
  _languages[acceptLanguage] = { text: result };
  updatePriorty(acceptLanguage);
  purgeCache();

  return result;
}

function _purgeCacheImpl() {

  let d = _.partial(debug, 'purgeCacheImpl');
  debugEnabled && d('called impl, _.size(languages) ==', _.size(_languages));

  if (maxLanguageCacheSize > 0 && _.size(_languages) > maxLanguageCacheSize) {
    // identify the order of priority
    let keyPriorities = _.map(Object.keys(_languages), key => { 
      return {priority: _.get(_languages[key], 'priority'), key}; 
    });

    // get the keys for the n highest priority accept-languages
    let keepKeys = _.take(
      _.reverse(
        _.map(
          _.sortBy(keyPriorities, ['priority.accessTime']), 
          o => { return o.key; })
      ),
      Math.min(minLanguageCacheSize, maxLanguageCacheSize)
    );

    d('Keeping accept-language headers:');
    d(keepKeys);

    // discard the lowest priority language files.
    setLanguages(_.pick(_languages, keepKeys));
  }
}
const purgeCache = _.throttle(
  _purgeCacheImpl,
  CACHE_PURGE_TIME,
  { trailing: true,
    leading: false
  });

function resetLanguages() {
  languageFile = undefined;
}

/**
 * Prevent invalid accept language headers from messing up the cache
 * @param {String} acceptLanguage 
 */
function sanitizeAcceptHeader(acceptLanguage) {
  return acceptLanguage.replace(/\[\]\./g, '-');
}

function selectPreferredLanguage(preferenceOrder, languageItem) {

  let value;
  for (let preference of preferenceOrder) {
    if (_.has(languageItem, preference)) {
      value = _.get(languageItem, preference);
      break;
    }
  }

  return [
    languageItem.name,
    value 
  ];
}

function setLanguageFilename(filename) {
  languageFilename = filename;
  resetLanguages();
}

function setLanguages(newObj) {
  _languages = newObj;
  if (IS_TESTING) {
    getLanguageText._languages = newObj;
  }
}

/**
 * @method setMaxLanguageCacheSize
 * Set the largest the language cache should be allowed to grow.
 * @param {Integer} size maximum number of Accept-Language headers, and
 *  corresponding calculated language files, to store.
 */
function setMaxLanguageCacheSize(size) {
  if (_.isInteger(size) && size >= 0) {
    maxLanguageCacheSize = size
  } else {
    throw `Invalid argument ${size}`;
  }
}

/**
 * @method setMinLanguageCacheSize
 * Set the minimum size the language cache should be purged to.
 * @param {Integer} size minimum number of Accept-Language headers, and
 *  corresponding calculated language files, to store.
 */
function setMinLanguageCacheSize(size) {
  if (_.isInteger(size) && size >= 0) {
    maxLanguageCacheSize = size
  } else {
    throw `Invalid argument ${size}`;
  }
}

function updatePriorty(acceptLanguage) {
  if (_.has(_languages, acceptLanguage)) {
    let la = _languages[acceptLanguage];
    _.has(la, 'priority') || (la.priority = {});
    la.priority.accessTime = Date.now();
  }
}

getLanguageText.reset = resetLanguages;
getLanguageText.setLanguageFilename = setLanguageFilename;
getLanguageText.setMaxLanguageCacheSize = setMaxLanguageCacheSize;
getLanguageText.setMinLanguageCacheSize = setMinLanguageCacheSize;
setLanguages(null);

export default getLanguageText;
