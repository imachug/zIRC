import Bot from "libs/irc/object/bot";
import UserStorage from "libs/irc/userstorage";
import {zeroPage, zeroFS} from "zero";
import {
	isValidName, getBotMetadata, getDeployedBotList, getUserBotList, createBot,
	renameBot, deleteBot, deployBot, undeployBot
} from "libs/irc/bots";

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

const SLASH_COMMANDS = [
	[
		{text: "/help"},
		{text: "/storage"},
		{text: "/notifications"}
	],
	[
		{text: "/newbot"},
		{text: "/deploybot"},
		{text: "/undeploybot"},
		{text: "/renamebot"},
		{text: "/deletebot"},
		{text: "/mybots"}
	],
	[
		{text: "/initdeployer", color: "yellow"},
		{text: "/restartdeployer", color: "yellow"},
		{text: "/publish", color: "yellow"}
	]
];

export default class HelloBot extends Bot {
	static async get(...args) {
		return new this(...args);
	}


	constructor() {
		super("/HelloBot", "1chat4ahuD4atjYby2JA9T9xZWdTY4W4D");
		this.state = "start";
		this.showHelloMessage = true;

		this.on("start", this.onStart);
		this.on("received", this.onReceived);
		this.on("tabOpened", this.onTabOpened);
	}

	async onStart() {
		// Let's check whether there's a storage we haven't setup yet
		const mergedSites = await zeroPage.cmd("mergerSiteList", [true]);
		for(const address of Object.keys(mergedSites)) {
			const content = mergedSites[address].content;
			if(content && content.permanent_storage && !content.setup) {
				// Yay, we've found an unset hub!
				this.send(
					dedent`
						Okay, so you've just made a permanent storage! It has
						address "${address}", but you don't have to remember
						that. Just know that nothing will be lost now! When
						you're ready to start using IRC, tell me.
					`,
					[
						[
							{text: "Ok, I'm ready"}
						]
					],
				);
				this.state = "tour";
				this.showHelloMessage = false; // Get rid of "Hello" message

				let content = await zeroFS.readFile(`merged-IRC/${address}/content.json`);
				content = JSON.parse(content);
				content.setup = true;
				content = JSON.stringify(content, null, 1);
				await zeroFS.writeFile(`merged-IRC/${address}/content.json`, content);

				return;
			}
		}
	}

	async onReceived(message) {
		// First, handle commands
		if(message.text === "/help") {
			await sleep(1000);

			this.send(
				dedent`
					Help: /storage -- create a new permanent storage;
					/notifications -- enable or disable web notifications;
					/newbot -- create a new bot (like me!); /deploybot -- make
					your bot available under a short name; /undeploybot -- take
					your bot off the public storage; /renamebot -- rename your
					bot; /deletebot -- delete your bot completely; /mybots --
					get a list of my bots; /initdeployer -- [admin-only command]
					init a deployer to handle bot deployment; /restartdeployer
					-- [admin-only command] restart the bot deployer; /publish
					-- [admin-only command] publish zIRC site
				`,
				SLASH_COMMANDS
			);
			return;
		} else if(message.text === "/storage") {
			await sleep(1000);

			this.send(dedent`
				You'll see a message inviting to clone a site, please do it! ^_^
			`);
			this.state = "clone";

			await sleep(1000);

			const siteInfo = await zeroPage.getSiteInfo();
			zeroPage.cmd("siteClone", [siteInfo.address, "storage"]);
			return;
		} else if(message.text === "/notifications") {
			await sleep(1000);

			const notificationsEnabled = UserStorage.storage.notificationsEnabled;

			this.send(
				dedent`
					Do you want to enable or to disable web notifications?
					(they are currently
					${notificationsEnabled ? "enabled" : "disabled"})
				`,
				[
					[
						{text: "Enable", color: "green"},
						{text: "Disable", color: "red"},
						{text: "Nothing"}
					]
				]
			);

			this.state = "notifications";
			return;
		} else if(message.text === "/newbot") {
			await sleep(1000);

			this.send(
				dedent`
					Creating a new bot, right? Make up a good and memorizable
					name for it. Good examples are "/Calculator" and "/QuizBot".
					You should avoid snake-case, underscore_case or camelCase,
					use PascalCase instead (i.e. "/QuizBot", not "/quiz_bot").
					The name must start with "/" and only contain digits and
					English letters.
				`,
				[
					[
						{
							text: "Wait wait I didn't want to register a bot",
							color: "red"
						},
					]
				]
			);

			this.state = "newbot";
			return;
		} else if(message.text === "/deploybot") {
			await sleep(1000);

			this.send("Send the name of the bot that you want to deploy.");
			this.state = "deploybot";
			return;
		} else if(message.text === "/undeploybot") {
			await sleep(1000);

			this.send("Send the name of the bot that you want to undeploybot.");
			this.state = "undeploybot";
			return;
		} else if(message.text === "/renamebot") {
			await sleep(1000);

			this.send("Send the name of the bot that you want to rename.");
			this.state = "renamebot";
			return;
		} else if(message.text === "/deletebot") {
			await sleep(1000);

			this.send("Send the name of the bot that you want to delete.");
			this.state = "deletebot";
			return;
		} else if(message.text === "/mybots") {
			const siteInfo = await zeroPage.getSiteInfo();
			const authAddress = siteInfo.auth_address;
			const bots = await getUserBotList(authAddress, false);
			this.send(`Your bots: ${bots.join(" ")}`);
			this.state = "done";
			return;
		} else if(message.text === "/initdeployer") {
			// Get private key
			const privatekey = await zeroPage.prompt("Enter deployer private key:", "password");

			// Save private key
			let settings = await zeroPage.cmd("userGetSettings");
			settings.deploy_privatekey = privatekey;
			await zeroPage.cmd("userSetSettings", [settings]);

			// Start BackgroundProcessing
			await zeroPage.cmd("wrapperPermissionAdd", ["BACKGROUND"]);

			await zeroPage.cmd("restartBackgroundScripts");

			this.send(dedent`
				Deployer initialized. Check the logs in ZeroNet console.
			`);
			this.state = "done";
			return;
		} else if(message.text === "/restartdeployer") {
			await zeroPage.cmd("restartBackgroundScripts");

			this.send(dedent`
				Deployer restarted. Check the logs in ZeroNet console.
			`);
			this.state = "done";
			return;
		} else if(message.text === "/publish") {
			await zeroPage.cmd("sitePublish", ["stored"]);

			this.send("Published content.json.");
			this.state = "done";
			return;
		}

		if(this.state === "start") {
			await sleep(1000);

			this.send(dedent`
				First, let me briefly explain what's going on. ZeroNet has a
				plugin called "PeerMessage". Unfortunately, it's not included to
				the standard package. It will let you send and receive messages
				very fast. If you don't have the plugin, you'll still be able to
				receive and send messages, but with 30-second limit. So, if you
				need fast communication, we recommend you to install the plugin
				at: [https://github.com/HelloZeroNet/Plugin-PeerMessage] .
			`);
			this.state = "plugin";

			await sleep(5000);

			this.send(dedent`
				Aah, yet another thing. On our IRC, you can log in as
				"Anonymous". You may find this feature useful -- but! You'll
				only be able to use "Anonymous" if you use PeerMessage plugin,
				and others will only be able to read "Anonymous" messages if
				they have PeerMessage plugin.
			`);
			this.state = "anonymous";

			await sleep(1000);

			this.send(
				dedent`
					After that, please login (if you want to) by clicking the
					[Change] button ^^ and tell me when you're ready.
				`,
				[
					[
						{text: "I'm done"}
					]
				]
			);
			this.state = "login";
		} else if(this.state === "login") {
			await sleep(1000);

			this.send(
				dedent`
					Nice! Now another question: would you like to save the
					messages you receive and send to a permanent storage? This
					means that Anonymous messages will be saved (not deleted, as
					usual), and if someone deletes his message, you'll still
					have it. Please answer "yes"/"no", whether you want to set
					up a permanent storage.
				`,
				[
					[
						{text: "Yes", color: "green"},
						{text: "No", color: "red"}
					]
				]
			);
			this.state = "storage";
		} else if(this.state === "storage") {
			if(message.text.toLowerCase() === "yes") {
				await sleep(1000);

				this.send(dedent`
					Niiice! So, you'll see a message inviting to clone a site,
					please do it! ^_^
				`);
				this.state = "clone";

				await sleep(1000);

				const siteInfo = await zeroPage.getSiteInfo();
				zeroPage.cmd("siteClone", [siteInfo.address, "storage"]);
			} else if(message.text.toLowerCase() === "no") {
				await sleep(1000);

				this.send(
					dedent`
						Oh. Okaay, you can always setup the permanent storage
						any time later by accessing me (reminder: press "Join",
						then "/HelloBot" ^_^) and pressing "/storage" button.
						When you're ready to start using IRC, tell me.
					`,
					[
						[
							{text: "I'm ready!!"}
						]
					]
				);
				this.state = "tour";
			} else {
				await sleep(1000);

				this.send(`Please answer "yes" or "no".`);
			}
		} else if(this.state === "tour") {
			await sleep(1000);

			this.send(dedent`
				Okay. Now, look at the sidebar at the left << Right now, you
				only see /HelloBot (that's me!!) here. Let's start our tour by
				opening #lobby. Press the "Join" button at the bottom-left
				corner and type in "#lobby". Now, enjoy using the IRC! ^_^
			`);
			await sleep(1000);

			this.send(
				dedent`
					By the way, I have some interesting features you might
					want to learn about. Press "/help" button if you want to
					learn about them!
				`,
				SLASH_COMMANDS
			);

			this.state = "done";
		} else if(this.state === "notifications") {
			this.state = "done";

			if(message.text.toLowerCase() === "enable") {
				this.send("Ok, I'm enabling notifications!");

				UserStorage.storage.notificationsEnabled = true;
				await UserStorage.save();

				await zeroPage.cmd("wrapperWebNotification", [
					"Notifications are enabled!",
					"enableNotifications"
				]);

				this.send(dedent`
					Done. You will now get a notification when someone sends a
					message.
				`);
			} else if(message.text.toLowerCase() === "disable") {
				this.send("Ok, I'm disabling notifications :(");

				UserStorage.storage.notificationsEnabled = false;
				await UserStorage.save();

				this.send("Done.");
			}
		} else if(this.state === "newbot") {
			await sleep(1000);

			if(
				message.text === "Wait wait I didn't want to register a bot" ||
				message.text === "I give up"
			) {
				this.send("Ah, ok, try again next time :)")
				this.state = "done";
				return;
			}

			if(!isValidName(message.text)) {
				this.send(dedent`
					Nope, that's an invalid name. Please make up a name that
					starts with "/" (slash) and only contains digits and English
					letters.
				`);
				return;
			}

			let bots = await getDeployedBotList();
			if(bots.indexOf(message.text.toLowerCase()) > -1) {
				this.send(
					dedent`
						Um, there's a small problem. ${message.text} is a
						registered bot name, so you won't even be able to
						publish your own bot to the network. I'd recommend you
						to choose another name. Ideas?
					`,
					[
						[
							{text: "I give up"}
						]
					]
				);
				return;
			}


			const siteInfo = await zeroPage.getSiteInfo();
			const authAddress = siteInfo.auth_address;
			if(!siteInfo.cert_user_id) {
				this.send("Sorry, but you have to be logged in to make a bot.");
				this.state = "done";
				return;
			}

			bots = await getUserBotList(authAddress);
			if(bots.indexOf(message.text.toLowerCase()) > -1) {
				this.send(
					dedent`
						Um, there's a small problem. ${message.text} is already
						your bot. (Are you okay?) Try to come up with another
						name.
					`,
					[
						[
							{text: "I give up"}
						]
					]
				);
				return;
			}

			await createBot(message.text);
			this.send(dedent`
				There, done! You can now change your bot code by changing the
				following file:
				PATH_TO_ZERONET_DATA/${siteInfo.address}/data/users/${authAddress}/bots/${name}.js .
				When you are ready to test your bot, open a chat with
				/${name}@${authAddress}. To refresh the bot, just type
				"/HelloBot debug" in your bot's chat, and you'll get some useful
				controls. When you are ready to publish your bot, come here and
				run /deploybot .
			`);
			this.state = "done";
		} else if(this.state === "deploybot") {
			await sleep(1000);

			if(message.text === "I give up") {
				this.send("That's a pity.");
				this.state = "done";
				return;
			}


			if(!isValidName(message.text)) {
				this.send(dedent`
					Nope, that's an invalid name. Try to /deploybot again when
					you remember the name.
				`);
				this.state = "done";
				return;
			}

			const siteInfo = await zeroPage.getSiteInfo();
			const authAddress = siteInfo.auth_address;
			if(!siteInfo.cert_user_id) {
				this.send(dedent`
					Sorry, but you have to be logged in to deploy a bot.
				`);
				this.state = "done";
				return;
			}

			let bots = await getUserBotList(authAddress);
			if(bots.indexOf(message.text.toLowerCase()) === -1) {
				this.send(
					dedent`
						Um, there's a small problem. You don't have a bot called
						${message.text}. Are you sure you created the bot from
						*this* account? Try to remember.
					`,
					[
						[
							{text: "I give up"}
						]
					]
				);
				return;
			}

			bots = await getDeployedBotList();
			if(bots.indexOf(message.text.toLowerCase()) > -1) {
				// Check that the bot is owned by us
				const metadata = await getBotMetadata(message.text);
				if(metadata.author.auth_address !== authAddress) {
					this.send(dedent`
						Um, there's a small problem. ${message.text} is owned
						by another user. Either rename your bot (use /renamebot)
						and publish it with a new name, or ask the holder of the
						bot (${metadata.author.cert_user_id}) to undeploy/rename
						the bot.
					`);
					this.state = "done";
					return;
				}
			}

			await deployBot(message.text);

			this.send(dedent`
				The request was sent. The latest version of your bot will be
				available in a few minutes as ${message.text}. However, you can
				access it right now at ${message.text}@${authAddress} if you
				don't care about a long name.
			`);
			this.state = "done";
		} else if(this.state === "undeploybot") {
			await sleep(1000);

			if(message.text === "I give up") {
				this.send("That's a pity.");
				this.state = "done";
				return;
			}

			const siteInfo = await zeroPage.getSiteInfo();
			const authAddress = siteInfo.auth_address;

			let bots = await getUserBotList(authAddress);
			if(bots.indexOf(message.text.toLowerCase()) === -1) {
				this.send(
					dedent`
						Um, there's a small problem. You don't have a bot called
						${message.text}. Are you sure you created the bot from
						*this* account? Try to remember.
					`,
					[
						[
							{text: "I give up"}
						]
					]
				);
				return;
			}

			bots = await getDeployedBotList();
			if(bots.indexOf(message.text.toLowerCase()) === -1) {
				this.send(
					dedent`
						Um, there's a small problem. There is no bot called
						${message.text} at all.
					`,
					[
						[
							{text: "I give up"}
						]
					]
				);
				return;
			}

			// Check that the bot is owned by us
			const metadata = await getBotMetadata(message.text);
			if(metadata.author.auth_address !== authAddress) {
				this.send(dedent`
					Um, there's a small problem. ${message.text} is owned by
					another user, and you can't undeploy another user's bot. Ask
					${metadata.author.cert_user_id} to do it.
				`);
				this.state = "done";
				return;
			}

			await undeployBot(message.text);

			this.send(dedent`
				The request was sent to the deployer and will be handled in a
				few minutes. However, remember that even if the bot is
				undeployed, you (and others) will be able to access it at
				${message.text}@${authAddress}. If you want to disable this as
				well, use /deletebot.
			`);
			this.state = "done";
		} else if(this.state === "renamebot") {
			await sleep(1000);

			if(message.text === "I give up") {
				this.send("That's a pity.");
				this.state = "done";
				return;
			}


			const siteInfo = await zeroPage.getSiteInfo();
			const authAddress = siteInfo.auth_address;

			let bots = await getUserBotList(authAddress);
			if(bots.indexOf(message.text.toLowerCase()) === -1) {
				this.send(
					dedent`
						Um, there's a small problem. You don't have a bot called
						${message.text}. Are you sure you created the bot from
						*this* account? Try to remember.
					`,
					[
						[
							{text: "I give up"}
						]
					]
				);
				return;
			}

			bots = await getDeployedBotList();
			if(bots.indexOf(message.text.toLowerCase()) > -1) {
				const metadata = await getBotMetadata(message.text);
				if(metadata.author.auth_address === authAddress) {
					this.send(dedent`
						You can't rename a bot that you have deployed already.
						Undeploy the bot first via /undeploybot command, or
						create a new bot from scratch via /newbot.
					`);
					this.state = "done";
					return;
				}
			}

			this._renamebotOriginalName = message.text;

			this.send("And what do you want to rename it to?");
			this.state = "renamebotTo";
		} else if(this.state === "deletebot") {
			await sleep(1000);

			if(message.text === "I give up") {
				this.send("That's a pity.");
				this.state = "done";
				return;
			}

			const siteInfo = await zeroPage.getSiteInfo();
			const authAddress = siteInfo.auth_address;

			let bots = await getUserBotList(authAddress);
			if(bots.indexOf(message.text.toLowerCase()) === -1) {
				this.send(
					dedent`
						Um, there's a small problem. You don't have a bot called
						${message.text}. Are you sure you created the bot from
						*this* account? Try to remember.
					`,
					[
						[
							{text: "I give up"}
						]
					]
				);
				return;
			}

			bots = await getDeployedBotList();
			if(bots.indexOf(message.text.toLowerCase()) > -1) {
				// Check that the bot is not owned by us
				const metadata = await getBotMetadata(message.text);
				if(metadata.author.auth_address === authAddress) {
					this.send(dedent`
						Um, there's a small problem. ${message.text} is
						deployed. You can't delete a bot that has been deployed
						-- use /undeploybot first.
					`);
					this.state = "done";
					return;
				}
			}

			await deleteBot(message.text);

			this.send(dedent`
				There, done! You don't own ${message.text} anymore.
			`);
			this.state = "done";
		} else if(this.state === "renamebotTo") {
			await sleep(1000);

			if(message.text === "I give up") {
				this.send("Ah, ok, try again next time :)")
				this.state = "done";
				return;
			}

			if(!isValidName(message.text)) {
				this.send(dedent`
					Nope, that's an invalid name. Please make up a name that
					starts with "/" (slash) and only contains digits and English
					letters.
				`);
				return;
			}

			let bots = await getDeployedBotList();
			if(bots.indexOf(message.text.toLowerCase()) > -1) {
				this.send(
					dedent`
						Um, there's a small problem. ${message.text} is a
						registered bot name, so you won't even be able to
						publish your own bot to the network. I'd recommend you
						to choose another name. Ideas?
					`,
					[
						[
							{text: "I give up"}
						]
					]
				);
				return;
			}


			const siteInfo = await zeroPage.getSiteInfo();
			const authAddress = siteInfo.auth_address;

			await renameBot(this._renamebotOriginalName, message.text);

			const name = message.text.substr(1);
			this.send(dedent`
				There, done! You can now change your bot code by changing the
				following file:
				PATH_TO_ZERONET_DATA/${siteInfo.address}/data/users/${authAddress}/bots/${name}.js .
				When you are ready to test your bot, open a chat with
				/${name}@${authAddress}. To refresh the bot, just type
				"/HelloBot debug" in your bot's chat, and you'll get some useful
				controls. When you are ready to publish your bot, come here and
				run /deploybot .
			`);
			this.state = "done";
		}
	}

	onTabOpened() {
		if(this.showHelloMessage) {
			this.send(
				dedent`
					Hi, I'm /HelloBot! I'll help you start using our IRC.
					Please, tell me something or press the button below! ^_^
				`,
				[
					[
						{text: "Continue!!", color: "green"}
					]
				].concat(SLASH_COMMANDS)
			);
		}
	}



	send(text, buttons=null) {
		text = text.replace(/^\t+/gm, "");
		super.send(text, buttons);
	}
}