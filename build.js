var fs = require('fs'),
    path = require('path'),
    glob = require('glob'),
    YAML = require('js-yaml'),
    _ = require('./js/lib/lodash'),
    jsonschema = require('jsonschema'),
    fieldSchema = require('./data/presets/schema/field.json'),
    presetSchema = require('./data/presets/schema/preset.json');

function readtxt(f) {
    return fs.readFileSync(f, 'utf8');
}

function read(f) {
    return JSON.parse(readtxt(f));
}

function r(f) {
    return read(__dirname + '/data/' + f);
}

function rp(f) {
    return r('presets/' + f);
}

function stringify(o) {
    return JSON.stringify(o, null, 4);
}

function validate(file, instance, schema) {
    var result = jsonschema.validate(instance, schema);
    if (result.length) {
        console.error(file + ": ");
        result.forEach(function(error) {
            if (error.property) {
                console.error(error.property + ' ' + error.message);
            } else {
                console.error(error);
            }
        });
        process.exit(1);
    }
}

var translations = {
    categories: {},
    fields: {},
    presets: {}
};

function generateCategories() {
    var categories = {};
    glob.sync(__dirname + '/data/presets/categories/*.json').forEach(function(file) {
        var field = read(file),
            id = 'category-' + path.basename(file, '.json');

        translations.categories[id] = {name: field.name};

        categories[id] = field;
    });
    fs.writeFileSync('data/presets/categories.json', stringify(categories));
}

function generateFields() {
    var fields = {};
    glob.sync(__dirname + '/data/presets/fields/*.json').forEach(function(file) {
        var field = read(file),
            id = path.basename(file, '.json');

        validate(file, field, fieldSchema);

        translations.fields[id] = {label: field.label};
        if (field.strings) {
            for (var i in field.strings) {
                translations.fields[id][i] = field.strings[i];
            }
        }

        fields[id] = field;
    });
    fs.writeFileSync('data/presets/fields.json', stringify(fields));
}

function generatePresets() {
    var presets = {};
    glob.sync(__dirname + '/data/presets/presets/**/*.json').forEach(function(file) {
        var preset = read(file),
            id = file.match(/presets\/presets\/([^.]*)\.json/)[1];

        validate(file, preset, presetSchema);

        translations.presets[id] = {
            name: preset.name,
            terms: (preset.terms || []).join(',')
        };

        presets[id] = preset;
    });
    fs.writeFileSync('data/presets/presets.json', stringify(presets));
    fs.writeFileSync('data/presets.yaml', YAML.dump({en: {presets: translations}}));
}

generateCategories();
generateFields();
generatePresets();

fs.writeFileSync('data/data.js', 'iD.data = ' + stringify({
    deprecated: r('deprecated.json'),
    discarded: r('discarded.json'),
    keys: r('keys.json'),
    imagery: r('imagery.json'),
    wikipedia: r('wikipedia.json'),
    presets: {
        presets: rp('presets.json'),
        defaults: rp('defaults.json'),
        categories: rp('categories.json'),
        fields: rp('fields.json')
    },
    imperial: r('imperial.json'),
    maki: r('maki-sprite.json')
}) + ';');

// Push changes from data/core.yaml into data/locales.js
var core = YAML.load(fs.readFileSync('data/core.yaml', 'utf8'));
var presets = YAML.load(fs.readFileSync('data/presets.yaml', 'utf8'));
var en = _.merge(core, presets);
var out = 'locale.en = ' + stringify(en.en) + ';';
fs.writeFileSync('data/locales/en.js', out);
