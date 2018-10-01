module.exports = class Router {
	constructor(zeroPage) {
		this.routes = [];
		this.currentRoute = "";
		this.currentParams = {};
		this.currentHash = "";
		this.zeroPage = zeroPage;

		this.check("");
	}

	getURL() {
		return this.clearSlashes(
			location.search
				.replace(/[?&]wrapper_nonce=([A-Za-z0-9]+)/, "")
				.replace("?/", "")
		);
	}
	clearSlashes(path) {
		return path.toString().replace(/\/$/, "").replace(/^\//, "");
	}

	add(route) {
		this.routes.push(route);
	}
	remove(arg) {
		let index = this.routes.findIndex(route => route.controller === arg || route.path === arg);
		if(index > -1) {
			this.routes.splice(index, 1);
		}
	}

	check(hash) {
		this.routes.forEach(route => {
			let match = hash
				.replace(/^\//, "")
				.match(
					new RegExp(
						"^" +
						route.path
							.replace(/:([^/]+)/g, "([^/]*)")
							.replace(/\*/g, '(?:[^/]*)') +
						"$"
					)
				);

			if(match) {
				match.shift(); // Shift [0] which has all the pattern

				let keys = route.path.match(/:([^/]+)/g);
				let routeParams = {};
				match.forEach((value, i) => {
					routeParams[keys[i].replace(":", "")] = value;
				});

				this.currentParams = routeParams;
				this.currentRoute = route.path;
				this.currentHash = hash;

				route.controller(routeParams);
			}
		});
	}

	refresh() {
		this.check(this.currentRoute);
	}

	listenForBack(params) {
		this.navigate(params.href.replace(/.*\?/, "").replace(/^\//, ""), false);
	}

	navigate(path, doPush=true) {
		path = path || "";

		if(doPush) {
			this.zeroPage.cmd("wrapperPushState", [{route: path}, path, "/" + this.clearSlashes(path)])
		}

		this.check(path);
	}
};