// TODO: the settings system is too detached from the vue app.
//       this created complexity. should be integrated better.
function Settings() {
	var appName = 'oaie-sketch';

	this.settings = null;

	this.storeSettings = function() {
		if (!this.settings) return;
		var key = appName + '.settings.' + this.settings.id;
		// treat older settings as "the one settings"
		if (this.settings.id == null) key = appName + '.settings';
		if (app.spec && app.spec.info) {
			if (app.spec.info.title)
				this.settings.name = app.spec.info.title;
			if (app.spec.info.version)
				this.settings.name += " " + app.spec.info.version;
		}
		localStorage[key] = JSON.stringify(this.settings);
	}

	var settingsCounter = 0;
	this.listSettings = function() {
		var r = {};
		var counter = 1;
		for (var s in localStorage) {
			if (s.indexOf(appName + '.settings') != 0) continue;
			// TODO: dont do the parsing, instead do a quicker string op
			var settings = JSON.parse(localStorage[s]);
			var name = settings.name;
			if (name === undefined) name = "Unnamed " + counter;
			r[name] = s;
			if (counter > settingsCounter) settingsCounter = counter;
			counter++;
		}
		return r;
	}

	this.loadSettings = function(key) {
		this.settings = JSON.parse(localStorage[key]);
		return this.settings;
	};

	this.getNewSettings = function() {
		var s =
			{"locale":"en","spec":"openapi: \"3.0.0\"\ninfo:\n  version: \"0.1.0\"\n  title: OAIE Sample\n  description: |\n    https://github.com/OAIE/oaie-sketch\n    <!--OAIE.viz--><div style='height:500px;background-color:#eee;overflow:auto;position:relative;white-space:nowrap;border-radius:10px;'><span style='border-bottom:1px solid black;position:absolute;left:172.393px;top:89.9773px;width:32.75px;transform:matrix(0.934602, 0.355696, -0.355696, 0.934602, 0, 0);transform-origin:0 0;'><span style='border:1px solid black;width:5px;height:5px;position:absolute;right:0;transform:rotate(45deg);transform-origin:100% 0;border-left:0;border-bottom:0;'></span></span><span style='border-bottom:1px solid black;position:absolute;left:175.39px;top:144.458px;width:29.4688px;transform:matrix(0.936459, -0.350776, 0.350776, 0.936459, 0, 0);transform-origin:0 0;'><span style='border:1px solid black;width:5px;height:5px;position:absolute;right:0;transform:rotate(45deg);transform-origin:100% 0;border-left:0;border-bottom:0;'></span></span><div oaie-key='operation.get./sample/{sampleId}' style='border:1px solid rgb(97, 175, 254);background:rgb(240, 247, 255);position:absolute;left:28px;top:15px;width:144.391px;height:95px;padding:5px;border-radius:5px;'><div><b>get /sample/{sampleId}</b></div><div style='white-space:normal'>getSample </div><div>sampleId (string)</div></div><div oaie-key='operation.put./sample/{sampleId}' style='border:1px solid rgb(252, 161, 48);background:rgb(255, 246, 236);position:absolute;left:31px;top:124px;width:144.391px;height:95px;padding:5px;border-radius:5px;'><div><b>put /sample/{sampleId}</b></div><div style='white-space:normal'>putSample </div><div>sampleId (string)</div></div><div oaie-key='schema.Sample' style='position:absolute;left:203px;top:70px;width:86.0469px;height:96px;border:1px solid silver;background:white;padding:5px;border-radius:5px;'><div><b>Sample</b></div><div>one (string)</div><div>two (string)</div></div></div><div style='padding:5px;color:gray;float:right;'>OAIE visualization</div><!--/OAIE.viz-->\nservers:\n  - url: localhost:8080\npaths:\n  /sample/{sampleId}:\n    get:\n      operationId: getSample\n      tags:\n        - Sample\n      parameters:\n        - in: path\n          name: sampleId\n          schema:\n            type: string\n          required: true\n      responses:\n        '200':\n          description: Get the Sample\n          content:\n            application/json:\n              schema:\n                $ref: '#/components/schemas/Sample'\n    put:\n      operationId: putSample\n      tags:\n        - Sample\n      parameters:\n        - in: path\n          name: sampleId\n          schema:\n            type: string\n          required: true\n      requestBody:\n        required: true\n        content:\n          application/json:\n            schema:\n              $ref: '#/components/schemas/Sample'\n      responses:\n        '204':\n          description: No content\ncomponents:\n  schemas:\n    Sample:\n      properties:\n        one:\n          type: string\n        two:\n          type: string\n","positions":{"schema.Sample":{"x":203,"y":70},"operation.put./sample/{sampleId}":{"x":31,"y":124},"operation.get./sample/{sampleId}":{"x":28,"y":15}}}
		;
		s.id = new Date().getTime();
		s.name = ++settingsCounter;
		return s;
	};

	this.allSettings = this.listSettings();
	
	// init empty document on first start
	if (Object.keys(this.allSettings).length == 0) {
		this.settings = this.getNewSettings();
		this.storeSettings();
	}
}
