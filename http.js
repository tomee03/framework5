const TController = require('./controller');

exports.listen = function(req, res) {

	// req.ip
	// req.headers
	// req.url
	// req.method
	// req.on('data', function(chunk))
	// req.destroy()

	// res.writeHead(status, headers)
	// res.pipe();
	// res.write();
	// res.end()

	// @TODO: check PAUSE()
	// @TODO: check blacklist
	// @TODO: check allow_reqlimit

	if (DEF.blacklist[req.ip]) {
		F.stats.request.blocked++;
		req.destroy();
		return;
	}

	// Not supported
	if (req.method === 'HEAD') {
		F.stats.request.blocked++;
		req.destroy();
		return;
	}

	var ctrl = new TController.Controller(req, res);

	if (F.config.$reqlimit) {
		if (F.temporary.ddos[ctrl.ip] > F.config.$reqlimit) {
			F.stats.response.ddos++;
			ctrl.fallback(503);
			return;
		}
		if (F.temporary.ddos[ctrl.ip])
			F.temporary.ddos[ctrl.ip]++;
		else
			F.temporary.ddos[ctrl.ip] = 1;
	}

	if (ctrl.uri.file) {
		if (F.config.$static_accepts[ctrl.ext])
			ctrl.resume();
		else
			ctrl.fallback(404);
		return;
	}

	// Pending requests
	F.temporary.pending.push(ctrl);

	if (!ctrl.uri.file && DEF.onCORS && F.config.$cors) {
		if (F.TRouting.lookupcors(ctrl))
			ctrl.$route();
	} else
		ctrl.$route();

	// stream.headers
	// stream.url

	// respond(opt);
	// opt.status = 200;
	// opt.headers = {};
	// opt.stream = '';
	// opt.end = '';

};
