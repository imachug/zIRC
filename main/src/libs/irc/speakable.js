import PeerTransport from "libs/irc/transport/peer";
import EventEmitter from "wolfy87-eventemitter";
import {zeroPage} from "zero";

export default class Speakable extends EventEmitter {
	constructor() {
		super();
		this.history = null;
		this.received = {};

		// Listen from peers
		setTimeout(() => {
			this._listen(PeerTransport);
		}, 0);
	}

	async loadHistory() {
		if(!this.history) {
			this.history = await this._loadHistory();
		}

		return this.history;
	}

	async send(message) {
		message = {
			date: Date.now(),
			text: message,
			id: Math.random().toString(36).substr(2) + "/" + Date.now()
		};

		// Transfer via peers
		this._transfer(message, PeerTransport);

		// Receive, in case the transfers are slow
		const siteInfo = await zeroPage.getSiteInfo();
		this._received({
			authAddress: siteInfo.auth_address,
			certUserId: siteInfo.cert_user_id,
			message
		});
	}

	async _received({authAddress, certUserId, message}) {
		if(!this.received[message.id]) {
			this.received[message.id] = true;

			const object = {
				authAddress,
				certUserId,
				receiveDate: Date.now(),
				message
			};
			if(this.history) {
				this.history.push(object);
			} else {
				await this.loadHistory();
			}

			this.emit("received", object);
		}
	}
}