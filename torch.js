class Torch {
	static addTorchButton(app, html, data) {

		/*
		 * Returns true if a torch can be used... ie:
		 * 1) If the user is the GM.
		 * 2) If the system is not dnd5e, and the playerTorches setting is enabled.
		 * 3) If a dnd5e player knows the Light spell.
		 * 4) if a dnd5e player has at least one torch in inventory
		 */
		function hasTorch() {
			let torches = false;

			if (data.isGM)
				return true;
			if (game.system.id !== 'dnd5e') {
				return game.settings.get("torch", "playerTorches");
			}

			let actor = game.actors.get(data.actorId);
			if (actor === undefined)
				return false;
			actor.data.items.forEach(item => {
				if (item.type === 'spell') {
					if (item.name === 'Light') {
						torches = true;
						return;
					}
				}
				else {
					if (item.name.toLowerCase() === 'torch') {
						if (item.data.quantity.value > 0) {
							torches = true;
							return;
						}
					}
				}
			});
			return torches;
		}

		/*
		 * Performs inventory tracking for torch uses.  Deducts one
		 * torch from inventory if all of the following are true:
		 * 1) The system is dnd5e.
		 * 2) The player doesn't know the Light spell.
		 * 3) The player has at least one torch.
		 * 4) The user is not the GM or the gmUsesInventory setting is enabled.
		 */
		function useTorch() {
			let torch = -1;

			if (data.isGM && !game.settings.get("torch", "gmUsesInventory"))
				return;
			if (game.system.id !== 'dnd5e')
				return;
			let actor = game.actors.get(data.actorId);
			if (actor === undefined)
				return;

			// First, check for the light cantrip...
			actor.data.items.forEach((item, offset) => {
				if (item.type === 'spell') {
					if (item.name === 'Light') {
						torch = -2;
						return;
					}
				}
				else {
					if (torch === -1 && item.name.toLowerCase() === 'torch' && item.data.quantity.value > 0) {
						torch = offset;
					}
				}
			});
			if (torch < 0)
				return;

			// Now, remove a torch from inventory...
			actor.data.items[torch].data.quantity.value -= 1;
			actor.updateOwnedItem(actor.data.items[torch]);
		}

		if (data.isGM === true || game.settings.get("torch", "playerTorches") === true) {
			let dimRadius = game.settings.get("torch", "dimRadius");
			let brightRadius = game.settings.get("torch", "brightRadius");
			let tbutton = $(`<div class="control-icon torch"><i class="fas fa-fire"></i></div>`);
			let allowEvent = true;
			let ht = hasTorch();
			let oldTorch = app.object.getFlag("torch", "oldValue");
			let newTorch = app.object.getFlag("torch", "newValue");

			// Clear torch flags if light has been changed somehow.
			if (newTorch !== undefined && newTorch !== null && (newTorch !== data.brightLight + '/' + data.dimLight)) {
				app.object.setFlag("torch", "oldValue", null);
				app.object.setFlag("torch", "newValue", null);
				oldTorch = null;
				newTorch = null;
			}

			if (newTorch !== undefined && newTorch !== null) {
				// If newTorch is still set, light hasn't changed.
				tbutton.addClass("active");
			}
			else if ((data.brightLight >= brightRadius && data.dimLight >= dimRadius) || !ht) {
				/*
				 * If you don't have a torch, *or* you're already emitting more light than a torch,
				 * disallow the torch button
				 */
				let disabledIcon = $(`<i class="fas fa-slash" style="position: absolute; color: tomato"></i>`);
				tbutton.addClass("fa-stack");
				tbutton.find('i').addClass('fa-stack-1x');
				disabledIcon.addClass('fa-stack-1x');
				tbutton.append(disabledIcon);
				allowEvent = false;
			}
			html.find('.col.left').prepend(tbutton);
			if (allowEvent) {
				tbutton.find('i').click(ev => {
					let btn = $(ev.currentTarget.parentElement);
					let dimRadius = game.settings.get("torch", "dimRadius");
					let brightRadius = game.settings.get("torch", "brightRadius");
					let oldTorch = app.object.getFlag("torch", "oldValue");

					ev.preventDefault();
					ev.stopPropagation();
					if (ev.ctrlKey) {
						data.brightLight = 0;
						data.dimLight = 0;
						app.object.setFlag("torch", "oldValue", null);
						app.object.setFlag("torch", "newValue", null);
						btn.removeClass("active");
					}
					else if (oldTorch === null || oldTorch === undefined) {
						app.object.setFlag("torch", "oldValue", data.brightLight + '/' + data.dimLight);
						if (brightRadius > data.brightLight)
							data.brightLight = brightRadius;
						if (dimRadius > data.dimLight)
							data.dimLight = dimRadius;
						app.object.setFlag("torch", "newValue", data.brightLight + '/' + data.dimLight);
						btn.addClass("active");
						useTorch();
					}
					else {
						let thereBeLight = oldTorch.split('/');
						data.brightLight = parseFloat(thereBeLight[0]);
						data.dimLight = parseFloat(thereBeLight[1]);
						app.object.setFlag("torch", "oldValue", null);
						app.object.setFlag("torch", "newValue", null);
						btn.removeClass("active");
					}
					app.object.update(canvas.scene._id, {brightLight: data.brightLight, dimLight: data.dimLight});
				});
			}
		}
	}
}

Hooks.on('ready', () => {
	Hooks.on('renderTokenHUD', (app, html, data) => { Torch.addTorchButton(app, html, data) });
	Hooks.on('renderControlsReference', (app, html, data) => {
		html.find('div').first().append('<h3>Torch</h3><ol class="hotkey-list"><li><h4>'+
			game.i18n.localize("torch.turnOffAllLights")+
			'</h4><div class="keys">'+
			game.i18n.localize("torch.holdCtrlOnClick")+
			'</div></li></ol>');
	});
});
Hooks.once("init", () => {
	game.settings.register("torch", "playerTorches", {
		name: game.i18n.localize("torch.playerTorches.name"),
		hint: game.i18n.localize("torch.playerTorches.hint"),
		scope: "world",
		config: true,
		default: true,
		type: Boolean
	});
	if (game.system.id === 'dnd5e') {
		game.settings.register("torch", "gmUsesInventory", {
			name: game.i18n.localize("torch.gmUsesInventory.name"),
			hint: game.i18n.localize("torch.gmUsesInventory.hint"),
			scope: "world",
			config: true,
			default: true,
			type: Boolean
		});
	}
	game.settings.register("torch", "brightRadius", {
		name: game.i18n.localize("TOKEN.VisionBrightEmit"),
		hint: game.i18n.localize("torch.brightRadius.hint"),
		scope: "world",
		config: true,
		default: 20,
		type: Number
	});
	game.settings.register("torch", "dimRadius", {
		name: game.i18n.localize("TOKEN.VisionDimEmit"),
		hint: game.i18n.localize("torch.dimRadius.hint"),
		scope: "world",
		config: true,
		default: 40,
		type: Number
	});
	game.settings.register("torch", "offBrightRadius", {
		name: game.i18n.localize("torch.offBrightRadius.name"),
		hint: game.i18n.localize("torch.offBrightRadius.hint"),
		scope: "world",
		config: true,
		default: 0,
		type: Number
	});
	game.settings.register("torch", "offDimRadius", {
		name: game.i18n.localize("torch.offBrightRadius.name"),
		hint: game.i18n.localize("torch.offBrightRadius.hint"),
		scope: "world",
		config: true,
		default: 0,
		type: Number
	});
});

console.log("--- Flame on!");
