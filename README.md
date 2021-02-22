# language

Easy i18n for ES6 applications

## Install

```sh
npm install --save @capnajax/language
```

## Language File

The default location for the language file is in `${CWD}`. If you're running your project with npm, (e.g. `npm start`), CWD will be the location of your project's `package.json` file.

### File structure

The language file is a YAML file with a simple structure:

* All arrays are lists of language translations. Each item in the list has a `name` property, and a property for each language provided. There is a special `all` property that's the default of a language-specific translation is not provided. Names should be valid variable names.
* All objects are simply a specification of the language text object hierarchy.

```yaml
global:
  topic1:
  - name: an_apple
    en-us: An apple
    fr: Une pomme
    zh-cn: 一个苹果
    zh-tw: 一個蘋果
```

There is a translation called `an-apple` in `global.topic1` list that has translations for American English, French, and both traditional and simplified Chinese.

## Usage

```es6
import getLanguageText from '@capnajax/language'

// optional -- defaults to ${CWD}/language.yaml
getLanguageText.setLanguageFilename('/path/to.your/langauge.yaml');
// optional but important -- prevent the language cache from cacheing the
// translations for more than 50 different accept-language headers.
getLanguageText.setMaxLanguageCacheSize(50);
// optional but important -- when a cache is purgeed, purge it to this number
// of languages. More space between min and max means less-frequent purging.
getLanguageText.setMinLanguageCacheSize(40);

async function someFunc() {

  // takes one parameter -- an `accept-language` header value
  let language_text = await getLanguageText('zh_tw, en_us;q=0.9, en_uk;q=0.8');
  // returns {global:{topic1:{an_apple:"一個蘋果"}}}. It has the entire language
  // file.

  console.log(language_text.global.topic1.an_apple);
  // prints "一個蘋果"

  // If using lodash (recommended)
  console.log(_.get(language_text, 'global.topic1.an_apple'));
  // prints "一個蘋果"
}
```

## Change History

### 1.0.0 (Current release)

* Periodically purge the calculated language objects cache to prevent it from getting too big over time.

### 0.9.0 (Previous Release)

First release

### Wish List, not scheduled

* Audit capability, provide a script to test the integrity and completeness of a language file
* Separate and merge, provide a script to take the language file and separate it into multiple files, one for each language, and another to merge them back together.
* Identify language headers that would produce the exact same language file so
more languages can be cached with the same amount of memory and the cache would need less frequent purging
