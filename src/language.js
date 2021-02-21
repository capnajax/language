'use strict';

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

/**
 * Prevent invalid accept language headers from messing up the cache
 * @param {String} acceptLanguage 
 */
function sanitizeAcceptHeader(acceptLanguage) {
  return acceptLanguage.replace(/\[\]\./g, '-');
}

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

function setLanguageFilename(filename) {
  languageFilename = filename;
  resetLanguages();
}

function resetLanguages() {
  languageFile = undefined;
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

export default getLanguageText;
