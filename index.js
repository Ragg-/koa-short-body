/**
 * koa-better-body <https://github.com/tunnckoCore/koa-better-body>
 *
 * Copyright (c) 2014-2015 Charlike Mike Reagent, contributors.
 * Released under the MIT license.
 */

'use strict';

/**
 * Module dependencies.
 */

var extend = require('extend');
var parse = require('co-better-body');
var union = require('arr-union');
var formidable = require('formidable');

var defaults = {
  multipart: false,
  encoding: 'utf-8',
  jsonLimit: '1mb',
  formLimit: '56kb',
  formidable: {
    multiples: true,
    keepExtensions: true,
    maxFields: 10
  }
};

var defaultTypes = {
  // default json types
  json: [
    'application/json',
    'application/json-patch+json',
    'application/vnd.api+json',
    'application/csp-report'
  ],
  // default form types
  form: [
    'application/x-www-form-urlencoded'
  ],
  // default multipart types
  multipart: [
    'multipart/form-data'
  ]
}

/**
 * @name  koaBetterBody
 *
 * @param {Object} `[options]`
 *   @option {String} [options] `jsonLimit` default '1mb'
 *   @option {String} [options] `formLimit` default '56kb'
 *   @option {String} [options] `encoding` default 'utf-8'
 *   @option {String} [options] `encode` default 'utf-8'
 *   @option {Boolean} [options] `multipart` default false
 *   @option {Object} [options] `extendTypes`
 *   @option {Object} [options] `qs`
 *   @option {Object} [options] `formidable`
 * @return {GeneratorFunction}
 * @api public
 */
module.exports = function koaBetterBody(options) {
  options = extend(true, {}, defaults, options || {});
  options.extendTypes = extendTypes(options.extendTypes || {});

  return function * main(next) {
    if (this.request.body !== undefined || this.request.method === 'GET') {
      return yield * next;
    }

    var data = yield * handleRequest(this, options);
    data.files = data.files || {};

    Object.keys(data.files).forEach(key => {
        data.files[key] = Array.isArray(data.files[key]) ? data.files[key] : [data.files[key]];
    })

    this.field = key => {
        if (! key) return data.fields;
        return data.fields[key];
    };

    this.file = key => {
        if (! key) return data.files;
        return data.files[key];
    };

    yield * next;
  };
};

/**
 * The magic. Checking and forming the request
 *
 * @param {Object} `that`
 * @param {Object} `opts`
 * @return {Object}
 * @api private
 */
function * handleRequest(that, opts) {
  var cache = {
    fields: {}
  };
  var returns = {};
  var options = {
    encoding: opts.encode || opts.encoding,
    limit: opts.jsonLimit,
    qs: opts.qs
  };

  if (that.request.is(opts.extendTypes.json)) {
    cache.fields = yield parse.json(that, options);
  } else if (that.request.is(opts.extendTypes.form)) {
    options.limit = opts.formLimit;
    cache.fields = yield parse.form(that, options);
  } else if (opts.multipart && that.request.is(opts.extendTypes.multipart)) {
    cache = yield parse.multipart(that, opts.formidable);
  }

  returns.fields = cache.fields;
  returns.files = cache.files;

  return returns;
}

/**
 * Promise-like parsing incoming form
 * and returning thunk
 *
 * @param  {Object} `context`
 * @param  {Object} `options`
 * @return {Function} `thunk`
 * @api private
 */
parse.multipart = function formed(context, options) {
  return function(done) {
    var form = new formidable.IncomingForm(options);
    form.parse(context.req, function(err, fields, files) {
      if (err) {return done(err);}
      done(null, {fields: fields, files: files});
    });
  };
}

function extendTypes(ret) {
  var cache = {};
  var json = ret.json ? ret.json : defaultTypes.json;
  var form = ret.form ? ret.form : defaultTypes.form;
  var multipart = ret.multipart ? ret.multipart : defaultTypes.multipart;

  cache.json = union(json, defaultTypes.json);
  cache.form = union(form, defaultTypes.form);
  cache.multipart = union(multipart, defaultTypes.multipart);

  return cache;
}
