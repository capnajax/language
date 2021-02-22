'use strict';

import { PRIORITY_HIGHEST } from 'constants';
import { promises as fs } from 'fs';
import _ from 'lodash';
import path from 'path';
import yaml from 'yaml';

let languageFilename = path.resolve('language.yaml');

let languageFile;

/**
 * So the language text is only calculated once
 */
let languages;

let maxLanguageCacheSize = 0;

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

async function getLanguageText(acceptLanguage) {

  acceptLanguage = sanitizeAcceptHeader(acceptLanguage);

  if (!languageFile) {
    languages = {};
    try {
      let readFile = await fs.readFile(languageFilename);
      languageFile = yaml.parse(readFile.toString());
    } catch(reason) {
      throw {message: 'Failed to load language file:', reason};
    }
  }

  if (_.has(languages, acceptLanguage)) {
    let languageEntry = languages[acceptLanguage];
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
  
  languages[acceptLanguage] = { text: result };
  updatePriorty(acceptLanguage);
  purgeCache();

  return result;
}

function purgeCache() {
  _.debounce(function purgeCacheImpl() {
    if (maxLanguageCacheSize > 0 && _.size(languages) > maxLanguageCacheSize) {
      // identify the order of priority
      let keyPriorities = _.map(Object.keys(languages), key => { 
        return {priority: _.get(languages[key], 'priority'), key}; 
      });
      // get the keys for the n highest priority accept-languages
      let keepKeys = _.take(
        _.map(
          _.sortBy(keyPriorities, ['priority.accessTime']), 
          o => { return o.key; }),
        maxLanguageCacheSize
      );
      // discard the lowest priority language files.
      languages = _.pick(languages, keepKeys);
    }
  }, 10);
}

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

function updatePriorty(acceptLanguage) {
  if (_.has(languages, acceptLanguage)) {
    let la = languages[acceptLanguage];
    _.has(la, 'priority') || (la.priority = {});
    la.priority.accessTime = Date.now();
  }
}

getLanguageText.reset = resetLanguages;
getLanguageText.setLanguageFilename = setLanguageFilename;
getLanguageText.setMaxLanguageCacheSize = setMaxLanguageCacheSize;

export default getLanguageText;
