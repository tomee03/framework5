// Total.js Templates
// The MIT License
// Copyright 2023 (c) Peter Širka <petersirka@gmail.com>

exports.render = function(body, model, $) {
	return new Promise(function(resolve, reject) {

		var cache = F.temporary.templates;
		var id = 'Ttemplate' + HASH(body) + ($ ? $.language : '');
		var data = cache[id];

		if (data) {
			try {
				resolve(data.template({ value: model || data.model }, null, data.helpers));
			} catch (e) {
				if ($ && $.invalid)
					$.invalid(e);
				else
					reject(e);
			}
			return;
		}

		if (body.indexOf('{{') === -1) {

			// URL address or filename
			data = cache[id];

			var start = body.substring(0, 7);
			// http://
			// https:/

			if (start === 'http://' || start === 'https:/') {
				// download template
				var opt = {};
				opt.url = body;
				opt.method = 'GET';
				opt.callback = function(err, response) {

					if (err) {
						if ($ && $.invalid)
							$.invalid(err);
						else
							reject(err);
						return;
					}

					data = parse(response.body, $);
					cache[id] = data;

					try {
						resolve(data.template({ value: model || data.model }, null, data.helpers));
					} catch (e) {
						if ($ && $.invalid)
							$.invalid(e);
						else
							reject(e);
					}
				};
				REQUEST(opt);
				return;
			} else {

				if (body[0] === '~') {
					// absolute path
					body = body.substring(1);
				} else if (body[0] === '#') {
					// plugins
					body = PATH.plugins(body.substring(1));
				} else {
					body = F.path.templates(body);
					if (body.indexOf('.html') === -1)
						body += '.html';
				}

				F.Fs.readFile(body, function(err, response) {

					if (err) {
						if ($ && $.invalid)
							$.invalid(err);
						else
							reject(err);
						return;
					}

					data = parse(response.toString('utf8'), $);

					if (!DEBUG)
						cache[id] = data;

					try {
						resolve(data.template({ value: model || data.model }, null, data.helpers));
					} catch (e) {
						if ($ && $.invalid)
							$.invalid(e);
						else
							reject(e);
					}

				});
				return;
			}
		}

		data = cache[id] = parse(body, $);

		try {
			resolve(data.template({ value: model || data.model }, null, data.helpers));
		} catch (e) {
			if ($ && $.invalid)
				$.invalid(e);
			else
				reject(e);
		}
	});
};

function parse(body, $) {

	if ($ && $.language != null)
		body = F.translate($.language, body);

	var helpers = {};
	var model = EMPTYOBJECT;
	var strhelpers = '';
	var beg = body.indexOf('<scr' + 'ipt>');
	var end;

	// helpers
	if (beg !== -1) {
		end = body.indexOf('</scr' + 'ipt>', beg + 8);
		strhelpers = body.substring(beg + 8, end).trim();
		body = body.substring(0, beg) + body.substring(end + 9);
	}

	// model
	beg = body.indexOf('<scr' + 'ipt type="text/json">');
	if (beg !== -1) {
		end = body.indexOf('</scr' + 'ipt>', beg + 8);
		model = body.substring(beg + 25, end).trim().parseJSON(true);
		body = body.substring(0, beg) + body.substring(end + 9);
	}

	if (strhelpers)
		new Function('Thelpers', strhelpers)(helpers);

	var output = {};
	output.helpers = helpers;
	output.template = Tangular.compile(body);
	output.model = model;
	return output;
}