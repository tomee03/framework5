// Total.js Builders
// The MIT License
// Copyright 2023 (c) Peter Širka <petersirka@gmail.com>

'use strict';

const REG_ARGS = /\{{1,2}[a-z0-9_.-\s]+\}{1,2}/gi;
const SESSIONSEPARATOR = '\0';

var transforms = { error: {}, restbuilder: {} };
var restbuilderupgrades = [];

function Options(ctrl, error) {
	var t = this;
	t.controller = ctrl;
	t.error = error || new ErrorBuilder();
	t.response = {};
}

Options.prototype = {

	get client() {
		return this.controller;
	},

	get websocket() {
		return this.controller && this.controller.iswebsocket ? this.controller : null;
	},

	get sessionid() {
		return this.controller ? this.controller.sessionid : null;
	},

	get value() {
		return this.payload;
	},

	get model() {
		return this.payload;
	},

	set value(value) {
		this.payload = value;
	},

	set model(value) {
		this.payload = value;
	},

	get url() {
		return (this.controller ? this.controller.url : '') || '';
	},

	get uri() {
		return this.controller ? this.controller.uri : null;
	},

	get path() {
		return this.controller ? this.controller.pathname : EMPTYARRAY;
	},

	get split() {
		return this.controller ? this.controller.split : EMPTYARRAY;
	},

	get split2() {
		return this.controller ? this.controller.split2 : EMPTYARRAY;
	},

	get language() {
		return (this.controller ? this.controller.language : '') || '';
	},

	get ip() {
		return this.controller ? this.controller.ip : null;
	},

	get address() {
		return this.controller ? this.controller.address : null;
	},

	get files() {
		return this.controller ? this.controller.files : null;
	},

	get body() {
		return this.controller ? this.controller.body : null;
	},

	get mobile() {
		return this.controller ? this.controller.mobile : null;
	},

	get headers() {
		return this.controller ? this.controller.headers : null;
	},

	get ua() {
		return this.controller ? this.controller.ua : null;
	}
};

Options.prototype.hostname = function(path) {
	let ctrl = this.controller;
	return ctrl ? ctrl.hostname(path) : path;
};

Options.prototype.unauthorized = function() {
	var args = [this];
	for (let i = 0; i < arguments.length; i++)
		args.push(arguments[i]);
	return F.unauthorized.apply(global, args);
};

Options.prototype.transform = function(name, value, callback) {
	return F.transform(name, value, callback, this.controller);
};

Options.prototype.action = function(schema, payload) {
	let t = this;
	let action = F.action(schema, payload, this.controller);
	if (!t.controller) {
		if (t.user)
			action.options.user = t.user;
		if (t.query)
			action.options.query = t.query;
		if (t.params)
			action.options.params = t.params;
	}
	return action;
};

Options.prototype.promisify = function(fn, a, b, c) {
	var $ = this;
	return new Promise(function(resolve) {

		var callback = function(err, response) {
			if (err)
				$.invalid(err);
			else
				resolve(response);
		};

		if (c !== undefined)
			fn(a, b, c, callback);
		else if (b !== undefined)
			fn(a, b, callback);
		else if (a !== undefined)
			fn(a, callback);
		else
			fn(callback);

	});
};

Options.prototype.status = function() {};

Options.prototype.publish = function(value) {
	var self = this;
	var name = self.id;
	if (F.TTMS.cache.socket && F.TTMS.cache.pcache[name]) {

		var tmp = {};
		if (tmp) {
			for (var key in value) {
				if (!self.$publish || self.$publish[key])
					tmp[key] = value[key];
			}
		}

		F.stats.performance.publish++;
		F.TTMS.cache.socket.send({ type: 'publish', id: name, data: tmp }, client => client.tmsready && client.$subscribers[name]);
	}

	return self;
};

Options.prototype.on = function(name, fn) {
	var self = this;
	if (!self.events)
		self.events = {};
	if (!self.events[name])
		self.events[name] = [];
	self.events[name].push(fn);
	return self;
};

Options.prototype.emit = function(name, a, b, c, d) {

	var self = this;

	if (!self.events || !self.events[name])
		return false;

	for (var evt of self.events[name])
		evt.call(self, a, b, c, d);

	return true;
};

Options.prototype.cancel = function() {
	var self = this;
	self.callback = self.next = null;
	self.error = null;
	self.controller = null;
	self.model = null;
	self.options = null;
	return self;
};

Options.prototype.redirect = function(url) {
	var self = this;
	self.$callback = null;
	if (self.controller) {
		self.controller.redirect(url);
		self.controller.destroyed = true;
	}
	self.cancel();
	return self;
};

Options.prototype.audit = function(message, type) {
	F.audit(this, message ? this.variables(message) : '', type);
};

Options.prototype.success = function(value) {
	var self = this;
	if (self.TYPE === 'auth')
		self.callback(value || EMPTYOBJECT);
	else
		self.callback(DEF.onSuccess(value));
};

Options.prototype.successful = function(callback) {
	var self = this;
	return function(err, a, b, c) {
		if (err)
			self.invalid(err);
		else
			callback.call(self, a, b, c);
	};
};

Options.prototype.callback = Options.prototype.pipe = function(value) {

	var self = this;

	if (arguments.length == 0) {
		return function(err, response) {
			err && self.error.push(err);
			self.callback(response);
		};
	}

	self.$callback(self.error.items.length ? self.error : null, value);
};

Options.prototype.done = function(arg) {
	var self = this;
	return function(err, response) {
		if (err) {
			self.error.push(err);
			self.callback(null);
		} else {
			if (self.TYPE === 'auth')
				self.callback(arg === true ? response : arg);
			else
				self.callback(DEF.onSuccess(arg === true ? response : arg));
		}
	};
};

Options.prototype.output = function(name) {
	// @name {String} json, html, xml, text, redirect, binary, jsonstring, empty, file
	var self = this;
	if (self.controller)
		self.controller.response.output = name;
	return self;
};

function $errorhandling(self) {
	self.$callback(true);
}

Options.prototype.invalid = function(error, path, index) {
	var self = this;
	self.error.push(error, path, index);
	setTimeout($errorhandling, 1, self);
	return self.error;
};

Options.prototype.cookie = function(name, value, expire, options) {
	var self = this;
	if (value === undefined)
		return self.controller.cookie(name);
	if (value === null)
		expire = '-1 day';
	self.controller.cookie(name, value, expire, options);
	return self;
};

Options.prototype.variables = function(str, data) {

	if (str.indexOf('{') === -1)
		return str;

	var $ = this;

	return str.replace(REG_ARGS, function(text) {
		var l = text[1] === '{' ? 2 : 1;
		var key = text.substring(l, text.length - l).trim();
		var val = null;
		var five = key.substring(0, 5);
		if (five === 'user.') {
			if ($.user) {
				key = key.substring(5);
				val = key.indexOf('.') === -1 ? $.user[key] : F.TUtils.get($.user, key);
			}
		} else if (five === 'data.') {
			if (data) {
				key = key.substring(5);
				val = key.indexOf('.') === -1 ? data[key] : F.TUtils.get(data, key);
			}
		} else {
			var six = key.substring(0, 6);
			if (six === 'model.' || six === 'value.') {
				if ($.model) {
					key = key.substring(6);
					val = key.indexOf('.') === -1 ? $.model[key] : F.TUtils.get($.model, key);
				}
			} else if (six === 'query.')
				val = $.query[key.substring(6)];
			else if (key.substring(0, 7) === 'params.')
				val = $.params[key.substring(7)];
		}
		return val == null ? text : val;
	});

};

function ErrorBuilder() {
	var t = this;
	t.items = [];
	// t.replacer = null;
	t.status = 400;
	t.prefix = '';
}

ErrorBuilder.prototype = {
	get length() {
		return this.items.length;
	}
};

ErrorBuilder.prototype.throw = function() {
	this.$throw = true;
	return this;
};

ErrorBuilder.prototype.reject = function(language) {
	return new Error(this.toString(language, ''));
};

ErrorBuilder.prototype.push = function(err, path, index) {

	let self = this;

	if (!err)
		err = 401;

	if (err > 399) {
		self.status = err;
		self.items.push({ error: F.TUtils.httpstatus(err) });
	} else
		self.items.push({ error: err.toString(), path: path, index: index });

	if (self.$throw) {
		let errors = self.output();
		throw new Error(errors[0].error);
	}

	return self;
};

ErrorBuilder.prototype.push2 = function(name, path, index) {
	let self = this;
	self.items.push({ name: self.prefix + name, error: '@', path: path, index: index });

	if (self.$throw) {
		let errors = self.output();
		throw new Error(errors[0].error);
	}

	return self;
};

ErrorBuilder.assign = function(arr) {
	let builder = new ErrorBuilder();
	if (arr instanceof Array) {
		for (let i = 0; i < arr.length; i++) {
			if (arr[i].error)
				builder.items.push(arr[i]);
		}
	} else {
		let type = typeof(arr);
		if (type === 'number' || type === 'string')
			builder.push(arr);
		else if (arr instanceof Error)
			builder.push(arr + '');
	}
	return builder;
};

ErrorBuilder.prototype.replace = function(search, value) {
	let self = this;
	if (!self.replacer)
		self.replacer = {};
	self.replacer[search] = value;
	return self;
};

ErrorBuilder.prototype.output = function(language = 'default') {

	let self = this;
	let output = [];

	for (let m of self.items) {

		let err = m.error;

		if (err == '@') {

			let key = err === '@' ? m.name : err.substring(1);
			let is = false;

			if (self.dictionary) {
				let tmp = self.dictionary[key];
				if (tmp) {
					err = tmp[0] === '@(' ? F.translate(language, tmp) : tmp;
					is = true;
				}
			}

			if (!is)
				err = F.resource(language, (err === '@' ? key : ('T' + key).hash(true).toString(36))) || 'The field "' + key + '" is invalid';

		} else if (err[0] === '@')
			err = F.translate(language, err);

		if (self.replacer) {
			for (let key in self.replacer)
				err = err.replaceAll(key, self.replacer[key]);
		}

		output.push({ name: m.name, error: err, path: m.path, index: m.index });
	}

	if (ErrorBuilder.$transform)
		output = ErrorBuilder.$transform(output, language);

	return output;
};

ErrorBuilder.prototype.toString = function(language = 'default', divider = '\n') {
	var self = this;
	var output = self.output(language);
	var str = '';
	for (let err of output)
		str += (str ? divider : '') + err.error;
	return str;
};

ErrorBuilder.transform = function(callback) {
	ErrorBuilder.$transform = callback;
};

function RESTBuilder(url) {

	this.$length = 0;
	this.$transform = transforms.restbuilder_default;
	this.$persistentcookies = false;

	this.options = { url: url, timeout: 10000, method: 'GET', resolve: true, headers: { 'user-agent': 'Total.js/v' + F.version_header, accept: 'application/json, text/plain, text/plain, text/xml' }};

	// this.$data = {};
	// this.$nodnscache = true;
	// this.$expire;
	// this.$redirect

	// Auto Total.js Error Handling
	this.$errorbuilderhandler = true;
}

RESTBuilder.make = function(fn) {
	var instance = new RESTBuilder();
	fn && fn(instance);
	return instance;
};

RESTBuilder.url = function(url) {
	return new RESTBuilder(url);
};

RESTBuilder.GET = function(url, data) {
	var builder = new RESTBuilder(url);
	builder.options.query = data;
	return builder;
};

RESTBuilder.API = function(url, name, data) {
	var builder = new RESTBuilder(url);
	builder.operation = name;
	builder.options.method = 'POST';
	builder.raw(data, 'raw');
	return builder;
};

RESTBuilder.POST = function(url, data) {
	var builder = new RESTBuilder(url);
	builder.options.method = 'POST';
	data && builder.raw(data, 'json');
	return builder;
};

RESTBuilder.PUT = function(url, data) {
	var builder = new RESTBuilder(url);
	builder.options.method = 'PUT';
	data && builder.raw(data, 'json');
	return builder;
};

RESTBuilder.DELETE = function(url, data) {
	var builder = new RESTBuilder(url);
	builder.$method = 'delete';
	builder.options.method = 'DELETE';
	data && builder.raw(data, 'json');
	return builder;
};

RESTBuilder.PATCH = function(url, data) {
	var builder = new RESTBuilder(url);
	builder.$method = 'patch';
	builder.options.method = 'PATCH';
	data && builder.raw(data, 'json');
	return builder;
};

RESTBuilder.HEAD = function(url) {
	var builder = new RESTBuilder(url);
	builder.options.method = 'HEAD';
	return builder;
};

RESTBuilder.upgrade = function(fn) {
	restbuilderupgrades.push(fn);
};

var RESTP = RESTBuilder.prototype;

RESTP.insecure = function() {
	this.options.insecure = true;
	return this;
};

RESTP.error = function(err) {
	this.$errorhandler = err;
	return this;
};

RESTP.noparse = function() {
	this.$noparse = true;
	return this;
};

RESTP.debug = function() {
	this.$debug = true;
	return this;
};

RESTP.base64 = function() {
	var self = this;
	self.$base64 = true;;
	return self;
};

RESTP.unixsocket = function(socket, path) {
	var self = this;
	self.options.unixsocket = { socket: socket, path: path };
	return self;
};

RESTP.promise = function($) {
	var self = this;
	return new Promise(function(resolve, reject) {
		self.exec(function(err, response) {
			if (err) {
				if ($ && $.invalid)
					$.invalid(err);
				else
					reject(F.TUtils.toError(err));
			} else
				resolve(response);
		});
	});
};

RESTP.proxy = function(value) {
	this.options.proxy = value;
	return this;
};

RESTP.url = function(url) {
	if (url === undefined)
		return this.options.url;
	this.options.url = url;
	return this;
};

RESTP.cert = function(key, cert, dhparam) {
	this.options.key = key;
	this.options.cert = cert;
	this.options.dhparam = dhparam;
	return this;
};

RESTP.file = function(name, filename, buffer) {

	var self = this;
	var obj = { name: name, filename: filename };

	if (buffer) {
		if (typeof(buffer) === 'string') {
			if (buffer.isURL())
				obj.url = buffer;
			else
				obj.path = buffer;
		} else
			obj.buffer = buffer;
	}

	if (self.options.files)
		self.options.files.push(obj);
	else
		self.options.files = [obj];

	return self;
};

RESTP.timeout = function(number) {
	this.options.timeout = number;
	return this;
};

RESTP.maxlength = function(number) {
	this.options.limit = number;
	return this;
};

RESTP.auth = function(user, password) {
	this.options.headers.authorization = password == null ? user : 'Basic ' + Buffer.from(user + ':' + password).toString('base64');
	return this;
};

RESTP.nodnscache = function() {
	this.options.resolve = false;
	return this;
};

RESTP.nocache = function() {
	this.$nocache = true;
	return this;
};

RESTP.make = function(fn) {
	fn.call(this, this);
	return this;
};

RESTP.xhr = function() {
	this.options.xhr = true;
	return this;
};

RESTP.method = function(method, data) {
	this.options.method = method.charCodeAt(0) > 96 ? method.toUpperCase() : method;
	data && this.raw(data, 'json');
	return this;
};

RESTP.referer = RESTP.referrer = function(value) {
	this.options.headers.Referer = value;
	return this;
};

RESTP.origin = function(value) {
	this.options.headers.Origin = value;
	return this;
};

RESTP.robot = function() {
	if (this.options.headers['User-Agent'])
		this.options.headers['User-Agent'] += ' Bot';
	else
		this.options.headers['User-Agent'] = 'Bot';
	return this;
};

RESTP.mobile = function() {
	if (this.options.headers['User-Agent'])
		this.options.headers['User-Agent'] += ' iPhone';
	else
		this.options.headers['User-Agent'] = 'iPhone';
	return this;
};

RESTP.put = RESTP.PUT = function(data) {
	this.options.method = 'PUT';
	data && this.raw(data, this.options.type || 'json');
	return this;
};

RESTP.delete = RESTP.DELETE = function(data) {
	this.options.method = 'DELETE';
	data && this.raw(data, this.options.type || 'json');
	return this;
};

RESTP.get = RESTP.GET = function(data) {
	this.options.method = 'GET';
	this.options.query = data;
	return this;
};

RESTP.post = RESTP.POST = function(data) {
	this.options.method = 'POST';
	data && this.raw(data, this.options.type || 'json');
	return this;
};

RESTP.head = RESTP.HEAD = function() {
	this.options.method = 'HEAD';
	return this;
};

RESTP.patch = RESTP.PATCH = function(data) {
	this.options.method = 'PATCH';
	data && this.raw(data, this.options.type || 'json');
	return this;
};

RESTP.json = function(data) {
	data && this.raw(data, 'json');
	if (this.options.method === 'GET')
		this.options.method = 'POST';
	return this;
};

RESTP.urlencoded = function(data) {
	if (this.options.method === 'GET')
		this.options.method = 'POST';
	this.options.type = 'urlencoded';
	data && this.raw(data, this.options.type);
	return this;
};

RESTP.accept = function(ext) {
	var type;
	if (ext.length > 8)
		type = ext;
	else
		type = F.TUtils.contentTypes[ext];
	this.options.headers.Accept = type;
	return this;
};

RESTP.xml = function(data) {

	if (this.options.method === 'GET')
		this.options.method = 'POST';

	this.options.type = 'xml';
	data && this.raw(data, this.options.type);
	return this;
};

RESTP.redirect = function(value) {
	this.options.noredirect = !value;
	return this;
};

RESTP.raw = function(value, type) {
	this.options.type = type;
	this.options.body = value;
	return this;
};

RESTP.text = RESTP.plain = function(val) {
	this.$plain = true;
	this.options.body = val;
	this.options.type = 'plain';
	return this;
};

RESTP.cook = function(value) {
	this.options.cook = value !== false;
	return this;
};

RESTP.cookies = function(obj) {
	this.options.cookies = obj;
	return this;
};

RESTP.cookie = function(name, value) {
	if (!this.options.cookies)
		this.options.cookies = {};
	this.options.cookies[name] = value;
	return this;
};

RESTP.header = function(name, value) {
	this.options.headers[name] = value;
	return this;
};

RESTP.type = function(value) {
	this.options.headers['Content-Type'] = value;
	return this;
};

function execrestbuilder(instance, callback) {
	instance.exec(callback);
}

RESTP.callback = function(fn) {

	var self = this;

	if (fn instanceof Options)
		fn = fn.callback();

	if (typeof(fn) === 'function') {
		setImmediate(execrestbuilder, self, fn);
		return self;
	}

	self.$ = fn;
	setImmediate(execrestbuilder, self);
	return new Promise(function(resolve, reject) {
		self.$resolve = resolve;
		self.$reject = reject;
	});
};

RESTP.csrf = function(value) {
	this.options.headers['X-Csrf-Token'] = value;
	return this;
};

RESTP.encrypt = function(key) {
	this.options.encrypt = key || DEF.secret_encryption;
	return this;
};

RESTP.compress = function(val) {
	this.$compress = val == null || val == true;
	return this;
};

RESTP.cache = function(expire) {
	this.$expire = expire;
	return this;
};

RESTP.progress = function(fn) {
	this.options.onprogress = fn;
	return this;
};

RESTP.stream = function(callback) {
	var self = this;
	self.options.custom = true;
	setImmediate(streamresponse, self, callback);
	return self;
};

RESTP.convert = function(schema) {
	let self = this;
	self.$jsonschema = schema.toJSONSchema();
	return self;
};

function streamresponse(builder, callback) {
	builder.exec(callback);
}

RESTP.keepalive = function(val) {
	this.options.keepalive = val == null ? true : val;
	return this;
};

RESTP.exec = function(callback) {

	if (!callback)
		callback = NOOP;

	var self = this;

	if (self.operation) {

		// API
		if (self.options.body)
			self.options.body = { data: self.options.body };
		else
			self.options.body = {};

		if (self.options.query) {
			self.options.body.query = self.options.query;
			self.options.query = null;
		}

		self.options.body.schema = self.operation;
		self.options.body = JSON.stringify(self.options.body, self.$compress ? exports.json2replacer : null);
		self.options.type = 'json';
	}

	if (self.options.files && self.options.method === 'GET')
		self.options.method = 'POST';

	if (self.options.body && !self.options.files && typeof(self.options.body) !== 'string' && self.options.type !== 'raw')
		self.options.body = self.options.type === 'urlencoded' ? F.TUtils.toURLEncode(self.options.body) : JSON.stringify(self.options.body);

	if (self.options.unixsocket && self.options.url) {
		if (!self.options.path)
			self.options.path = self.options.url;
		self.options.url = undefined;
	}

	self.$callback = callback;

	if (restbuilderupgrades.length) {
		for (var i = 0; i < restbuilderupgrades.length; i++)
			restbuilderupgrades[i](self);
	}

	var key;

	if (self.$expire && !self.$nocache) {
		key = 'restbuilder' + ((self.options.url || '') + (self.options.socketpath || '') + (self.options.path || '') + (self.options.body || '')).hash(true);
		var data = F.cache.read(key);
		if (data) {
			data = data.value;
			if (self.$resolve) {
				self.$resolve(data);
				self.$reject = null;
				self.$resolve = null;
			} else
				callback(null, data, data);
			return self;
		}
	}

	self.$cachekey = key;
	self.options.callback = restbuilder_callback;
	self.options.response = {};
	self.options.response.builder = self;
	self.request = F.TUtils.request(self.options);
	return self;
};

function restbuilder_callback(err, response) {

	let self = response.builder;

	if (self.options.custom) {
		if (self.$resolve) {
			if (err) {
				if (self.$)
					self.$.invalid(err);
				else
					self.$reject(err);
			} else
				self.$resolve(response);
			self.$ = null;
			self.$reject = null;
			self.$resolve = null;
		} else
			self.$callback.call(self, err, response);
		return;
	}

	let callback = self.$callback;
	let key = self.$cachekey;
	let type = err ? '' : response.headers['content-type'] || '';
	let output = new RESTBuilderResponse();

	if (self.options.cook && self.options.cookies)
		output.cookies = self.options.cookies;

	if (type) {
		let index = type.lastIndexOf(';');
		if (index !== -1)
			type = type.substring(0, index).trim();
	}

	let ishead = response.status === 204;

	if (ishead)
		output.value = response.status < 400;
	else if (self.$plain || self.$noparse)
		output.value = response.body;
	else if (self.$base64)
		output.value = response.body instanceof Buffer ? response.body.toString('base64') : Buffer.from(response.body, 'utf8').toString('base64');
	else {
		switch (type.toLowerCase()) {
			case 'text/xml':
			case 'application/xml':
				output.value = response.body ? response.body.parseXML2() : null;
				break;
			case 'application/x-www-form-urlencoded':
				output.value = response.body ? DEF.parsers.urlencoded(response.body) : {};
				break;
			case 'application/json':
			case 'text/json':
			case 'text/plain':
				output.value = response.body ? response.body.parseJSON(true) : null;
				break;
			default:
				if (response.body instanceof Buffer && response.body.length)
					response.body = response.body.toString('utf8');
				output.value = response.body ? (response.body.isJSON() ? response.body.parseJSON(true) : response.body) : null;
				break;
		}
	}

	if (output.value == null)
		output.value = EMPTYOBJECT;

	output.response = response.body;
	output.status = response.status;
	output.headers = response.headers;
	output.hostname = response.host;
	output.origin = response.origin;
	output.cache = false;

	if (self.$debug)
		console.log('--DEBUG-- RESTBuilder: ' + response.status + ' ' + self.options.method + ' ' + QUERIFY(self.options.url || (self.options.unixsocket + self.options.path), self.options.query), '|', 'Error:', err, '|', 'Response:', response.body);

	let val = output.value;

	if (!err && output.status >= 400) {
		err = output.status;
		if (val instanceof Array && val.length && val[0] && val[0].error)
			err = ErrorBuilder.assign(val);
		else
			err = null;
	}

	if (!err && key)
		F.cache.add(key, output, self.$expire);

	if (self.$errorbuilderhandler) {
		// Is the response Total.js ErrorBuilder?
		if (val instanceof Array && val.length && val[0] && val[0].error) {
			err = ErrorBuilder.assign(val);
			if (err)
				val = null;
		}
	}

	if (!err && output.status >= 400)
		err = output.status;

	if (!err && self.$jsonschema && val) {
		let jsresponse = $jsonschema.transform(val);
		if (jsresponse.error)
			err = jsresponse.error;
		else
			val = jsresponse.response;
	}

	if (self.$resolve) {

		if (err) {
			if (self.$)
				self.$.invalid(err);
			else
				self.$reject(err);
		}
		else
			self.$resolve(val);

		self.$ = null;
		self.$reject = null;
		self.$resolve = null;

	} else {
		callback(err, val, output);
		output.cache = true;
	}

}

function RESTBuilderResponse() {}

RESTBuilderResponse.prototype.cookie = function(name) {

	let self = this;
	if (self.cookies)
		return F.TUtils.decodeURIComponent(self.cookies[name] || '');

	self.cookies = {};

	let cookies = self.headers['set-cookie'];
	if (!cookies)
		return '';

	if (typeof(cookies) === 'string')
		cookies = [cookies];

	for (let i = 0; i < cookies.length; i++) {
		let line = cookies[i].split(';', 1)[0];
		let index = line.indexOf('=');
		if (index !== -1)
			self.cookies[line.substring(0, index)] = line.substring(index + 1);
	}

	return F.TUtils.decodeURIComponent(self.cookies[name] || '');
};

function parseactioncache(obj, meta) {

	let query = meta.query;
	let user = meta.user;
	let params = meta.params;
	let input = meta.input;
	let language = meta.language;
	let search = meta.id || meta.key;

	if (typeof(user) === 'string')
		user = user.split(',').trim();
	else if (user === true)
		user = ['id'];
	else
		user = null;

	if (typeof(params) === 'string')
		params = params.split(',').trim();
	else if (params === true) {
		if (obj.jsparams) {
			params = [];
			for (let key in obj.jsparams.properties)
				params.push(key);
		} else
			params = null;
	} else
		params = null;

	if (typeof(input) === 'string')
		input = input.split(',').trim();
	else if (input === true) {
		if (obj.jsinput) {
			input = [];
			for (let key in obj.jsinput.properties)
				input.push(key);
		} else
			input = null;
	} else
		input = null;

	if (typeof(query) === 'string')
		query = query.split(',').trim();
	else if (query === true) {
		if (obj.jsquery) {
			query = [];
			for (let key in obj.jsquery.properties)
				query.push(key);
		} else
			query = null;
	} else
		query = null;

	return function($, value) {
		if (value === undefined) {

			let key = 'action|' + (search ? (search + '|') : '') + $.ID;
			let sum = '';
			let tmp;

			if (language)
				sum += ($.language || '');

			if (query) {
				for (let key of query) {
					tmp = $.query[key];
					if (tmp)
						sum += '|' + tmp;
				}
			}

			if (params) {
				for (let key of params) {
					tmp = $.params[key];
					if (tmp)
						sum += '|' + tmp;
				}
			}

			if (input) {
				for (let key of input) {
					tmp = $.model[key];
					if (tmp)
						sum += '|' + tmp;
				}
			}

			if (user && $.user) {
				for (let key of user) {
					tmp = $.user[key];
					if (tmp)
						sum += '|' + tmp;
				}
			}

			$.cachekey = key + sum;
			return F.cache.read($.cachekey);
		}

		$.cachekey && F.cache.set($.cachekey, value && value.success ? CLONE(value) : value, meta.expire || '5 minutes');
	};

}

exports.newaction = function(name, obj) {

	if (typeof(name) === 'object') {
		obj = name;
		name = obj.id || obj.name;
	}

	let url = name;

	if (F.actions[name])
		F.actions[name].remove();

	obj.$url = url;

	F.actions[name] = obj;
	obj.id = name;
	obj.jsinput = obj.input ? F.TUtils.jsonschema(obj.input, true) : null;
	obj.jsoutput = obj.output ? F.TUtils.jsonschema(obj.output, true) : null;
	obj.jsparams = obj.params ? F.TUtils.jsonschema(obj.params, true) : null;
	obj.jsquery = obj.query ? F.TUtils.jsonschema(obj.query, true) : null;
	obj.options = {};
	obj.options.csrf = obj.csrf;
	obj.options.encrypt = obj.encrypt;
	obj.options.compress = obj.compress;
	obj.audit = obj.audit === true ? NOOP : (obj.audit ? Tangular.compile(obj.audit) : null);
	obj.called = 0;

	if (obj.cache)
		obj.cache = parseactioncache(obj, obj.cache);

	if (obj.middleware)
		obj.middleware = obj.middleware.replace(/,|\|/g, ' ').replace(/\s{2,}/, ' ').split(' ').trim();

	obj.remove = function() {
		obj.route && obj.route.remove();
		delete F.actions[obj.id];
		obj = null;
		F.makesourcemap && F.makesourcemap();
	};

	if (obj.url) {
		obj.route = obj.url;
		obj.url = undefined;
	}

	if (obj.route) {
		if (obj.route.indexOf('-->') === -1)
			obj.route = obj.route + '  ' + (obj.input ? '+' : '-') + obj.$url + ' --> ' + name;
		obj.route = F.route(obj.route + (obj.encrypt ? ' @encrypt' : ''));
	}

	if (obj.permissions && typeof(obj.permissions) === 'string')
		obj.permissions = obj.permissions.split(/,|;/).trim();

	if (obj.publish) {

		let tmsschema = obj.publish == true ? (obj.input || obj.output) : obj.publish;

		if (typeof(tmsschema) === 'string') {
			if (tmsschema[0] === '+')
				tmsschema = (obj.input || obj.output) + ',' + tmsschema.substring(1);

			let keys = tmsschema.split(',');
			obj.$publish = [];
			for (let key of keys) {
				let index = key.indexOf(':');
				obj.$publish.push(index === -1 ? key : key.substring(0, index));
			}
		}

		F.TTMS.newpublish(name, tmsschema);
	}

	F.makesourcemap && F.makesourcemap();
	return obj;
};

function ActionCallerExec(self) {
	self.exec();
}

function ActionCaller() {
	var self = this;
	self.$ = new Options();
	self.error = new ErrorBuilder();
	self.options = {};
	self.actions = [];
	setImmediate(ActionCallerExec, self);
}

ActionCaller.prototype.debug = function() {
	this.options.debug = true;
	return this;
};

ActionCaller.prototype.params = function(value) {
	this.options.params = value;
	return this;
};

ActionCaller.prototype.status = function(fn) {
	this.options.status = fn;
	return this;
};

ActionCaller.prototype.exec = function() {

	let self = this;
	let id = self.actions.shift();

	if (!id) {
		self.finish && self.finish();
		self.error = null;
		self.options = null;
		self.$ = null;
		return;
	}

	let meta = F.temporary.actions[id];
	if (!meta) {

		let arr = id.split(' ');

		meta = {};
		meta.response = arr[1] ? true : false;
		meta.id = arr[0];
		meta.payload = null;

		let c = meta.id[0];
		if (c === '+' || c === '-' || c === '%') {
			// + payload
			// - without payload
			// % partial payload
			meta.payload = c;
			meta.id = meta.id.substring(1);
		}

		F.temporary.actions[id] = meta;
	}

	let action = F.actions[meta.id];

	if (!action) {
		self.error.push('The action "{0}" not found'.format(meta.id));
		self.cancel();
		return;
	}

	let type = meta.payload || (action.input ? '+' : '-');
	let $ = self.$;

	$.id = action.id;
	$.error = self.error;
	$.controller = self.controller;
	$.user = self.options.user;
	$.config = action.config || EMPTYOBJECT;

	action.called++;

	$.$callback = function(err, response) {

		if (!err) {
			if (action.jsoutput)
				response = action.jsoutput.transform(response).response;

			if (action.extend) {
				if (action.extend.includes('.'))
					U.set($.payload, action.extend, response);
				else
					$.payload[action.extend] = response;
				response = $.payload;
			}
		}

		if (err) {
			// close
			self.cancel();
		} else {

			$.response[$.id] = response;
			meta.response && self.finish && self.finish(response);

			if (action.audit)
				F.audit('actions', $, action.audit(null, $) || '');

			let key = '@' + $.id;
			if (F.$events[key])
				F.emit(key, $, response);

			self.exec();
		}
	};

	if (action.user != null) {
		if ((action.user && !$.user) || (!action.user && $.user)) {
			$.invalid(401);
			return;
		}
	}

	if (action.sa || action.su) {
		if (!$.user || (!$.user.sa && !$.user.su)) {
			$.invalid(401);
			return;
		}
	}

	if (action.permissions) {
		let permissions = action.permissions.slice(0);
		permissions.unshift($);
		if (F.unauthorized.apply(global, permissions))
			return;
	}

	var params = self.options.params || EMPTYOBJECT;
	var query = self.options.query || EMPTYOBJECT;
	var payload = self.options.payload || (action.extend ? {} : EMPTYOBJECT);
	var response = null;

	if (action.jsquery) {
		self.error.prefix = 'query.';
		response = action.jsquery.transform(query, false, self.error);
		self.error.prefix = '';
		if (response.error) {
			self.cancel();
			return;
		}
		$.query = response.response;
	} else
		$.query = query;

	if (action.jsparams) {
		self.error.prefix = 'params.';
		response = action.jsparams.transform(params, false, self.error);
		self.error.prefix = '';
		if (response.error) {
			self.cancel();
			return;
		}
		$.params = response.response;
	} else
		$.params = params;

	if (action.jsinput && type !== '-') {
		response = action.jsinput.transform(payload, action.partial, self.error);
		if (response.error) {
			self.cancel();
			return;
		}
		$.payload = response.response;
	} else
		$.payload = payload;

	if (self.options.status)
		$.status = self.options.status;

	if (action.middleware) {
		action.middleware.wait(function(name, next) {
			let fn = F.routes.middleware[name];
			if (fn) {
				fn($, next);
			} else {
				Total.error('The middleware "{0}" not found.'.format(name), action.id, $.url);
				next();
			}
		}, () => action.action($, $.payload));
	} else
		action.action($, $.payload);
};

ActionCaller.prototype.finish = function(value) {
	var self = this;
	self.finish = null;
	if (self.options.callback) {

		if (self.options.callback instanceof Options) {
			let $ = self.options.callback;
			if (self.error.length)
				$.invalid(self.error);
			else
				$.callback(value === undefined ? self.$.response : value);
		} else
			self.options.callback(self.error.length ? self.error : null, value === undefined ? self.$.response : value);

		self.options.callback = null;
	}
};

ActionCaller.prototype.cancel = function() {
	var self = this;
	self.actions.length = 0;
	self.exec();
};

ActionCaller.prototype.payload = function(value) {
	this.options.payload = value;
	return this;
};

ActionCaller.prototype.query = function(value) {
	this.options.query = value;
	return this;
};

ActionCaller.prototype.user = function(value) {

	if (value instanceof Options)
		value = value.user;

	this.options.user = value;
	return this;
};

ActionCaller.prototype.language = function(value) {
	this.options.language = value;
	return this;
};

ActionCaller.prototype.error = function(value) {
	this.options.error = value;
	return this;
};

ActionCaller.prototype.ctrl = function(ctrl) {
	this.controller = ctrl ? (ctrl.controller || ctrl) : null;
	return this;
};

ActionCaller.prototype.done = function($, fn) {
	this.options.callback = function(err, response) {
		if (err)
			$.invalid(err);
		else
			fn(response);
	};
	return this;
};

ActionCaller.prototype.callback = ActionCaller.prototype.pipe = function(value) {
	this.options.callback = value;
	return this;
};

ActionCaller.prototype.promise = function($) {
	var self = this;
	return new Promise(function(resolve, reject) {
		self.options.callback = function(err, response) {
			if (err) {
				self.options.error && self.options.error(err);
				if ($ && $.invalid)
					$.invalid(err);
				else
					reject(err.reject());
			} else
				resolve(response);
		};
	});
};

ActionCaller.prototype.autorespond = function() {
	var self = this;
	self.options.callback = function(err, response, a, b) {
		if (err)
			self.controller.invalid(err);
		else
			self.controller.respond(response, a, b);
	};
	return self;
};

ActionCaller.prototype.controller = function(ctrl) {
	if (ctrl instanceof Options)
		ctrl = ctrl.controller;
	this.options.controller = ctrl;
	return this;
};

exports.action = function(name, payload, controller) {

	let key = '$' + name;
	let actions = F.temporary.actions[key];

	if (!actions) {
		actions = name.replace(/(\s)?\(response\)/i, '\0').split(/\s|\,|\n/);
		let isresponse = false;
		for (let i = 0; i < actions.length; i++) {
			actions[i] = actions[i].replaceAll('\0', ' (response)');
			if (actions[i].indexOf('(') !== -1)
				isresponse = true;
		}

		if (actions.length === 1 && !isresponse)
			actions[0] += ' (response)';
		F.temporary.actions[key] = actions;
	}

	let action = new ActionCaller();
	action.controller = controller;
	action.payload = payload;
	action.actions = actions.slice(0);
	action.options.payload = payload;
	action.options.user = controller?.user;
	action.options.query = controller?.query;
	action.options.params = controller?.params;
	return action;
};

exports.newschema = function(name, callback) {

	if (name[0] === '@')
		name = name.substring(1);

	if (typeof(callback) === 'string')
		return F.jsonschemas[name] = F.TUtils.jsonschema(callback, true);

	let $ = {};
	$.name = name;
	$.actions = {};
	$.action = function(aname, meta) {
		return $.actions[aname] = F.newaction(name + '/' + aname, meta);
	};

	callback($);
};

exports.builtinauth = function(opt) {

	// opt.secret {String}
	// opt.ddos {Number}
	// opt.expire {String}
	// opt.cookie {String} A cookie name
	// opt.header {String} A header name
	// opt.options {Object} A cookie options
	// opt.strict {Boolean}

	if (opt.strict == null)
		opt.strict = true;

	// Delegates
	// opt.onddos = function($)
	// opt.onread = function({ sessionid: String, userid: String, ua: String }, callback(USER_DATA), $)
	// opt.onfree = function({ sessions: Array, users: Array })
	// opt.onlogout = function(sessionid, userid)
	// opt.onauthorize = function($) must return true for canceling of processing

	opt.sessions = {};
	opt.blocked = {};
	opt.pending = {};

	if (!opt.cleaner)
		opt.cleaner = 5;

	if (!opt.secret)
		opt.secret = F.secret;

	opt.logout = function($) {

		var id = $;

		if (typeof(id) === 'object')
			id = $.sessionid;

		var ctrl = $.controller;

		if (ctrl && !id)
			id = ctrl.sessionid;

		if (id) {
			for (var key in opt.sessions) {
				var session = opt.sessions[key];
				if (session.sessionid === id) {
					delete opt.sessions[key];
					opt.onlogout && opt.onlogout(session);
					opt.cookie && ctrl && !ctrl.parent && ctrl.cookie && ctrl.cookie(opt.cookie, '', '-1 year', opt.options);
					return true;
				}
			}
			opt.onremove && opt.onremove(id);
		}
	};

	opt.update = function(userid, fn) {
		var count = 0;
		for (var key in opt.sessions) {
			var session = opt.sessions[key];
			if (session.userid === userid) {
				count++;
				fn(session.data, session);
			}
		}
		return count;
	};

	opt.refresh = function(userid, exceptsessionid) {
		var count = 0;
		for (var key in opt.sessions) {
			var session = opt.sessions[key];
			if (session.userid === userid && session.sessionid !== exceptsessionid) {
				count++;
				delete opt.sessions[key];
			}
		}
		return count;
	};

	opt.sign = function(sessionid, userid) {
		return (sessionid + SESSIONSEPARATOR + userid + SESSIONSEPARATOR + Date.now().toString(36)).encrypt(opt.secret);
	};

	opt.authcookie = function($, sessionid, userid, expiration, options) {
		if (!options)
			options = opt.options;
		var ctrl = $.controller ? $.controller : $;
		var token = opt.sign(sessionid, userid);
		ctrl.cookie && !ctrl.parent && $.cookie(opt.cookie, token, expiration, options);
		return token;
	};

	if (!opt.expire)
		opt.expire = '5 minutes';

	var callpending = function(pending, data) {
		for (var i = 0; i < pending.length; i++) {
			if (data)
				pending[i].success(data);
			else
				pending[i].invalid();
		}
	};

	opt.auth = function($) {

		if (opt.onauthorize && opt.onauthorize($))
			return;

		var sessionid = opt.cookie ? $.cookie(opt.cookie) : null;
		if (!sessionid && opt.header)
			sessionid = $.controller.headers[opt.header];

		var localize = opt.locale || opt.localize;

		if (!sessionid) {

			if (localize)
				$.controller.language = localize(null, $.controller);

			$.invalid();
			return;
		}

		var id = sessionid.decrypt(opt.secret);
		if (id) {

			id = id.split(SESSIONSEPARATOR);

			if (!id[0] || !id[1] || !id[2])
				id = null;

			if (id) {
				var session = opt.sessions[id[0]];
				if (session && session.data) {
					if (!opt.strict || session.ua === $.controller.ua) {
						$.controller.session = session;
						$.controller.sessionid = session.sessionid;
						if (!opt.onsession || !opt.onsession(session, $)) {
							if (localize)
								$.controller.language = localize(session.data, $.controller);
							$.success(session.data);
						}
					} else {

						if (localize)
							$.controller.language = localize(null, $.controller);

						$.invalid();
						sessionid = null;
					}
					return;
				}
			}
		}

		if (opt.ddos && opt.blocked[$.controller.ip] > opt.ddos) {
			opt.onddos && opt.onddos($);
			$.invalid();
			return;
		}

		if (!id) {

			if (opt.ddos) {
				if (opt.blocked[$.controller.ip])
					opt.blocked[$.controller.ip]++;
				else
					opt.blocked[$.controller.ip] = 1;
			}

			opt.cookie && $.controller && !$.controller.parent && $.controller.cookie && $.controller.cookie(opt.cookie, '', '-1 year', opt.options);
			$.invalid();
			return;
		}

		var meta = { ip: $.controller.ip, ua: $.controller.ua, sessionid: id[0], userid: id[1] };

		if (opt.pending[meta.sessionid]) {
			opt.pending[meta.sessionid].push($);
			return;
		}

		opt.pending[meta.sessionid] = [];
		opt.onread(meta, function(err, data) {

			var pending = opt.pending[meta.sessionid];
			delete opt.pending[meta.sessionid];

			if (!err && data) {

				$.controller.session = opt.sessions[meta.sessionid] = { sessionid: meta.sessionid, userid: meta.userid, data: data, ua: $.controller.ua, expire: NOW.add(opt.expire) };
				$.controller.sessionid = meta.sessionid;

				if (localize)
					$.controller.language = localize(data, $.controller);

				if (!opt.onsession || !opt.onsession($.controller.session, $, true))
					$.success(data);

				if (pending.length)
					setImmediate(callpending, pending, data);

			} else {

				if (opt.ddos) {
					if (opt.blocked[$.controller.ip])
						opt.blocked[$.controller.ip]++;
					else
						opt.blocked[$.controller.ip] = 1;
				}

				opt.cookie && !$.controller.parent && $.controller.cookie && $.controller.cookie(opt.cookie, '', '-1 year', opt.options);
				$.invalid();

				if (pending.length)
					setImmediate(callpending, pending);
			}

		}, $);

	};

	F.def.onAuthorize = opt.auth;

	F.on('service', function(counter) {

		if (counter % opt.cleaner)
			return;

		var expired = [];
		var users_expired = {};
		var users_live = {};

		for (var key in opt.sessions) {
			var session = opt.sessions[key];
			if (session.expire < NOW) {
				expired.push(key);
				delete opt.sessions[key];
				users_expired[session.userid] = 1;
			} else
				users_live[session.userid] = 1;
		}

		if (expired.length) {
			for (var key in users_expired) {
				if (users_live[key])
					delete users_expired[key];
			}
		}

		if (expired.length && opt.onfree) {
			var meta = {};
			meta.sessions = expired;
			meta.users = expired.length ? Object.keys(users_expired) : null;
			opt.onfree && opt.onfree(meta);
		}

		opt.blocked = {};

	});

	return opt;
};

exports.RESTBuilder = RESTBuilder;
exports.ErrorBuilder = ErrorBuilder;
exports.Options = Options;