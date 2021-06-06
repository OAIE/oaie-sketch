<template>
  <div :class="{ editorWide: editorWide }">
    <div id="specEditor" v-if="!settings">
      <div v-for="(settingsKey, settingsName) in allSettings" class="settings" @click="selectSettings(settingsKey)" :key="settingsKey">{{ settingsName }}</div>
      <div class="settings new" @click="newSettings()">&plus; Create a new spec</div>
    </div>
    <div id="specEditor" v-if="settings">
      <div class="editor">
        <div class='measureHelper'>Text</div>
        <textarea wrap='off' v-model="settings.spec" @change='save(); editorChanged = true;' spellcheck="false"></textarea>
      </div>
      <span class='editorWideToggle' @click='editorWide = !editorWide'>{{ editorWide ? '&olt;' : '&ogt;' }}</span>
    </div>
    <div id='outputViewer' v-if="settings">
      <div class='menu'>
        <button @click='load' :class='{ changed: editorChanged }'>&rarr; update from editor</button>
        <button @click='updateInlineViz' :class='{ changed: positionsChanged }'>&larr; update inline viz</button>
        <!--<button @click='dump'>&equiv; dump to console</button>-->
        <button @click='addSchema'>&oplus; schema</button>
        <button v-if="saveToFile" @click='saveSpec'>Save spec</button>
        <button @click='clearSettings'>Clear settings</button>
        <div v-if="spec && spec.info" class='title'>{{ spec.info.title }} <span class='version'>{{ spec.info.version }}</span></div>
      </div>
      <div id='output' v-if='spec && spec.components'>
        <a v-for='(connection, c) in connections'
        v-bind:class='["arrow", connection.type]'
        v-bind:source='connection.source'
        v-bind:target='connection.target'
        v-bind:id='"connection" + c'></a>
        <div v-bind:class='["operation", operation._method]'
        v-bind:id='operation._key'
        v-bind:oaie-key='operation._key'
        v-bind:style='{ left: getPositionLeft(operation._key), top: getPositionTop(operation._key) }'
        v-for='operation in operations'
        v-draggable>
          <div class='path'>
            <b>{{ operation._method }}</b>
            <span @click='selectPath("paths:/" + encodeURIComponent(operation._path) + ":/" + operation._method + ":")'>{{ operation._path }}</span>
          </div>
          <div class='buttonRow'>
            <button class="mini" @click="moveAllY(operation, -50)">&uarr;</button>
            <button class="mini" @click="moveAllY(operation, 50)">&darr;</button>
          </div>
          <div class='summary'><b>{{ operation.operationId }}</b> {{ operation.summary }}</div>
          <ul>
            <li v-for='parameter in operation.parameters'
            v-bind:class='{ required: parameter.required }'>
              <button>-</button>
              <span @click='selectPath("paths:/" + encodeURIComponent(operation._path) + ":/" + operation._method + ":/parameters:/- name: " + parameter.name, parameter.name)'>
                {{ parameter.name }} ({{ parameter.schema ? parameter.schema.type : 'ERR1' }})
              </span>
            </li>
            <li><button>+</button></li>
          </ul>
        </div>
        <div class='schema'
        v-for='(schema, schemaName) in spec.components.schemas'
        v-bind:id='"schema." + schemaName'
        v-bind:oaie-key='"schema." + schemaName'
        v-bind:style='{ left: getPositionLeft("schema." + schemaName), top: getPositionTop("schema." + schemaName) }'
        v-draggable>
          <h1 @click='selectPath("components:/schemas:/" + schemaName + ":")'>{{ schemaName }}</h1>
          <div class='description'>{{ schema.description }}</div>
          <ul>
            <li v-for='(property, propertyName) in schema.properties'>
              <button>-</button>
              <span @click='selectPath("components:/schemas:/" + schemaName + ":/properties:/" + propertyName + ":")'>
                {{ propertyName }} ({{ property.type ? property.type : property.$ref ? property.$ref.replace('#/components/schemas/', '&rarr;') : '' }})
              </span>
            </li>
            <li><button @click='addSchemaProperty(schema, schemaName)'>+</button></li>
          </ul>
        </div>
      </div>
    </div>
    <div id="swaggerEditor"></div>
  </div>
</template>

<script>
import Vue from 'vue';
import $ from "jquery";
const jsyaml = require('js-yaml');
require('webpack-jquery-ui');
require('webpack-jquery-ui/draggable');
const queryString = require('query-string');
const parsed = queryString.parse(location.search);
Vue.directive('draggable', {
  inserted: function(el) {
    connectArrows(el);
    $(el).draggable({
      drag: function() {
        if (arrowsDirty == false) {
          arrowsDirty = true;
          // $nextTick seems to be always after the dragging, so we use a timer.
          window.setTimeout(() => { connectArrows(el); }, 50);
        }
      },
      stop: function() {

        connectArrows(el);
        window.settings = settingsSystem.settings;
        var key = $(el).attr('oaie-key');

        if (settings.positions === undefined) settings.positions = {};
        if (settings.positions[key] === undefined) settings.positions[key] = {};
        settings.positions[key].x = Math.round(this.style.left.replace(/[^\d\.]/g, ''));
        settings.positions[key].y = Math.round(this.style.top.replace(/[^\d\.]/g, ''));
        window.app.$children[0].$refs.sketch.setPositionsChanged();
        settingsSystem.storeSettings();

      }
    });
  }
});
// successCallback(data)
// errorCallback(message, exception)
function json(url, param, successCallback, errorCallback) {
	var xmlhttp = new XMLHttpRequest();
	if (errorCallback == null) errorCallback = function(message, exception) { console.error('json error', message, exception); };
	xmlhttp.timeout = 15000;
	xmlhttp.ontimeout = function() {
		errorCallback('timeout');
	};
	xmlhttp.onreadystatechange = function() {
		if (xmlhttp.readyState == XMLHttpRequest.DONE) {   // XMLHttpRequest.DONE == 4
			if (xmlhttp.status == 200) {
				var data = 'NOT SET';
				try { data = JSON.parse(xmlhttp.responseText); }
				catch (e) { errorCallback('cannot parse json ' + xmlhttp.responseText, e); }
				if (data != 'NOT SET') successCallback(data);
			}
			else
				errorCallback('status ' + xmlhttp.status + xmlhttp.responseText);
		}
	};
	xmlhttp.open('POST', url, true);
	var body = null;
	if (typeof param == 'string') body = param;
	else if (typeof param == 'object') body = JSON.stringify(param);
	xmlhttp.send(body);
	return xmlhttp;

}

function vueSupportTree() {

	// TODO: the open state does not get handled correctly.
	//       currently the tree nodes cannot even collapse
	//       originally it was stored in data, but that is sticky when the model changes which is unusable.
	Vue.component('tree-item', {
		template: `
			<li class='tree'>
				<div v-if='isFolder'>
					<span class='expander'
						v-if='isFolder'
						@click='toggle'
						@dblclick='toggleSiblings'>{{ model.open || model.open === undefined ? '&ndash;' : '+' }}</span>
					<span class='name'>{{ model.name }}</span><span v-if='model.value' class='value'>: {{ model.value }}</span>
					<span class='description'>{{ description }}</span>
				</div>
				<ul v-show='model.open || model.open === undefined' v-if='isFolder'>
					<tree-item v-for='(child, name) in wrappedChildren' :key='name' :model='child'></tree-item>
				</ul>
			</li>`,
		props: {
			model: Object,
		},
		computed: {
			isFolder: function() {
				var children = this.model.isWrapper ? this.model.children : this.model;
				if (children == null) return false;
				if (children == []) return false;
				// TODO: this does not seem to work. we get an expander at every node.
				return children instanceof Object || children instanceof Array;
			},
			wrappedChildren: function() {
				var children = this.model.isWrapper ? this.model.children : this.model;
				var c = [];
				if (children instanceof Object) {
					for (var name in children) {
						var value = children[name];
						if (value instanceof Object || value instanceof Array)
							c.push(this.wrapChild(name, value, null));
						else
							c.push(this.wrapChild(name, [], value));
					}
				}
				if (children instanceof Array) {
					for (var name in children) {
						var value = children[name];
						c.push(this.wrapChild(name, value, null));
					}
				}
				return c;
			},
			description: function() {
				// TODO: we will need the path to this node to really know a good description.
				//       so in wrappedChildren we will need to add a parent property
				if (this.model.parent == null) return "";
				if (this.model.parent.parent == null) return "";
				if (this.model.parent.parent.parent == null) return "";

				// SCHEMA
				if (this.name == "schema" && this.model.parent.parent.name == "items" && this.model.parent.parent.parent.name === undefined)
					return "$schema";
				if (this.model.parent.name == "schema") {
					if (this.model.name == "properties")
						return "{ foreach $schema->" + this.model.name + " as $propertyName => $property } { end }";
					if (this.model.name == "name")
						return "{ $schema->name }";
				}

				// SERVICE
				if (this.name == "service" && this.model.parent.parent.name == "items" && this.model.parent.parent.parent.name === undefined)
					return "$service";

				return "";
			},
		},
		methods: {
			wrapChild: function(name, child, value) {
				return { name: name, children: child, isWrapper: true, value: value, parent: this.model, open: true };
			},
			toggle: function(state) {
				console.log(state);
				// TODO: i am currently writing to the model, but this doesnt stick.
				//       i guess the component copies the data object?
				if (!this.isFolder) return;
				if (this.model.open === undefined) this.model.open = false;
				if (state === undefined || state instanceof Event) state = !this.model.open;
				this.model.open = state;
				this.$forceUpdate();
			},
			toggleChildren: function(state) {
				for (var c in this.$children) {
					var child = this.$children[c];
					child.toggle(state);
				}
			},
			toggleSiblings: function(state) {
				if (state === undefined || state instanceof Event) state = !this.model.open;
				this.$parent.toggleChildren(state);
			},
		}
	});
}
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
		if (this.spec && this.spec.info) {
			if (this.spec.info.title)
				this.settings.name = this.spec.info.title;
			if (this.spec.info.version)
				this.settings.name += " " + this.spec.info.version;
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

	this.clearSettings = function() {
	    var me = this;
	    return new Promise(function(resolve, reject) {
            for (var s in localStorage) {
                if (s.indexOf(appName + '.settings') == -1) continue;
                localStorage.removeItem(s);
            }
            settingsCounter = 0;
            me.getNewSettings().then(function(s) {
              me.settings = s;
              me.storeSettings();
              resolve();
            }).catch(function() {
            });
	    });
	}

	this.loadSettings = function(key) {
		this.settings = JSON.parse(localStorage[key]);
		return this.settings;
	};

	this.getNewSettings = function() {
        return new Promise(function(resolve, reject) {
          if (!!parsed.saveToFileEndpoint) {
            $.ajax({
	      url: parsed.saveToFileEndpoint,
	      success: function(xhr) {
                var specStructure = {"locale":"en"};
                specStructure.id = new Date().getTime();
                specStructure.name = ++settingsCounter;
		console.log(xhr);
		specStructure.spec = xhr.responseText;
		console.log('loaded spec', specStructure);
                resolve(specStructure);
	      },
	      error: function() {
                alert("Error while loading spec from remote url");
                reject();
	      }
            });
          } else {
            var s =
                {"locale":"en","spec":"openapi: \"3.0.0\"\ninfo:\n  version: \"0.1.0\"\n  title: OAIE Sample\n  description: |\n    https://github.com/OAIE/oaie-sketch\n    <!--OAIE.viz--><div style='height:500px;background-color:#eee;overflow:auto;position:relative;white-space:nowrap;border-radius:10px;'><span style='border-bottom:1px solid black;position:absolute;left:172.393px;top:89.9773px;width:32.75px;transform:matrix(0.934602, 0.355696, -0.355696, 0.934602, 0, 0);transform-origin:0 0;'><span style='border:1px solid black;width:5px;height:5px;position:absolute;right:0;transform:rotate(45deg);transform-origin:100% 0;border-left:0;border-bottom:0;'></span></span><span style='border-bottom:1px solid black;position:absolute;left:175.39px;top:144.458px;width:29.4688px;transform:matrix(0.936459, -0.350776, 0.350776, 0.936459, 0, 0);transform-origin:0 0;'><span style='border:1px solid black;width:5px;height:5px;position:absolute;right:0;transform:rotate(45deg);transform-origin:100% 0;border-left:0;border-bottom:0;'></span></span><div oaie-key='operation.get./sample/{sampleId}' style='border:1px solid rgb(97, 175, 254);background:rgb(240, 247, 255);position:absolute;left:28px;top:15px;width:144.391px;height:95px;padding:5px;border-radius:5px;'><div><b>get /sample/{sampleId}</b></div><div style='white-space:normal'>getSample </div><div>sampleId (string)</div></div><div oaie-key='operation.put./sample/{sampleId}' style='border:1px solid rgb(252, 161, 48);background:rgb(255, 246, 236);position:absolute;left:31px;top:124px;width:144.391px;height:95px;padding:5px;border-radius:5px;'><div><b>put /sample/{sampleId}</b></div><div style='white-space:normal'>putSample </div><div>sampleId (string)</div></div><div oaie-key='schema.Sample' style='position:absolute;left:203px;top:70px;width:86.0469px;height:96px;border:1px solid silver;background:white;padding:5px;border-radius:5px;'><div><b>Sample</b></div><div>one (string)</div><div>two (string)</div></div></div><div style='padding:5px;color:gray;float:right;'>OAIE visualization</div><!--/OAIE.viz-->\nservers:\n  - url: localhost:8080\npaths:\n  /sample/{sampleId}:\n    get:\n      operationId: getSample\n      tags:\n        - Sample\n      parameters:\n        - in: path\n          name: sampleId\n          schema:\n            type: string\n          required: true\n      responses:\n        '200':\n          description: Get the Sample\n          content:\n            application/json:\n              schema:\n                $ref: '#/components/schemas/Sample'\n    put:\n      operationId: putSample\n      tags:\n        - Sample\n      parameters:\n        - in: path\n          name: sampleId\n          schema:\n            type: string\n          required: true\n      requestBody:\n        required: true\n        content:\n          application/json:\n            schema:\n              $ref: '#/components/schemas/Sample'\n      responses:\n        '204':\n          description: No content\ncomponents:\n  schemas:\n    Sample:\n      properties:\n        one:\n          type: string\n        two:\n          type: string\n","positions":{"schema.Sample":{"x":203,"y":70},"operation.put./sample/{sampleId}":{"x":31,"y":124},"operation.get./sample/{sampleId}":{"x":28,"y":15}}}
            ;
            s.id = new Date().getTime();
            s.name = ++settingsCounter;
            resolve(s);
          }
        });
	};

	this.allSettings = this.listSettings();

	// init empty document on first start
	if (Object.keys(this.allSettings).length == 0) {
	    var me = this;
		this.getNewSettings().then(function(s) {
		  me.settings = s;
		  me.storeSettings();
		}).catch(function() {});
	}
}
function Rect(x, y, w, h) {
	this.x = x;
	this.y = y;
	this.w = w;
	this.h = h;

	this.isInside = function(p) {
		return p.x >= this.x && p.x <= this.x + this.w && p.y >= this.y && p.y <= this.y + this.h;
	};

	this.center = function() {
		return { x: this.x + this.w / 2, y: this.y + this.h / 2 };
	}

	// find the intersection point of a line going into a rect
	this.findEnd = function(p1) {
		// TODO: i guess there are better and cheaper implementations for this.
		// TODO: this is also quite unstable for small interation counts
		//       we get significantly different solutions for small difference in inputs
		var p2 = this.center();
		var p = { x: p2.x, y: p2.y };
		var s = { x: p2.x - p1.x, y: p2.y - p1.y };
		for (var i = 0; i < 15; i++) {
			s.x /= 2;
			s.y /= 2;
			var sign = this.isInside(p, this) ? -1 : 1;
			p.x += sign * s.x;
			p.y += sign * s.y;
		}
		p.error = Math.sqrt(s.x * s.x + s.y * s.y);
		return p;
	}
}
var arrowConnect = function(arrow, sourceEl, targetEl) {
  var source = new Rect(
    Math.round(sourceEl.style.left.replace(/[^\d\.]/g, '')),
    Math.round(sourceEl.style.top.replace(/[^\d\.]/g, '')),
    $(sourceEl).width(),
    $(sourceEl).height()
  );
  var target = new Rect(
    Math.round(targetEl.style.left.replace(/[^\d\.]/g, '')),
    Math.round(targetEl.style.top.replace(/[^\d\.]/g, '')),
    $(targetEl).width(),
    $(targetEl).height()
  );

  var start = source.findEnd(target.center());
  $(arrow).css('left', start.x);
  $(arrow).css('top', start.y);
  var end = target.findEnd(source.center());
  var dx = end.x - start.x;
  var dy = end.y - start.y;
  var d = Math.sqrt(dx * dx + dy * dy);
  $(arrow).css('width', d + 'px');
  var a = Math.atan2(dy, dx);
  $(arrow).css('transform', 'rotate(' + a + 'rad)');
};

var arrowsDirty = false;
var connectArrows = function(el) {
  $('[source="' + el.id + '"],[target="' + el.id + '"]').each(function(i,o) {
    var source = document.getElementById($(o).attr('source'));
    var target = document.getElementById($(o).attr('target'));
    arrowConnect(o, source, target);
  });
  arrowsDirty = false;
};

var connectArrowsAll = function() {
  $('.arrow').each(function(i,o) {
    var source = document.getElementById($(o).attr('source'));
    var target = document.getElementById($(o).attr('target'));
    arrowConnect(o, source, target);
  });
};
var settingsSystem = new Settings();
var config = {};
var i18n = {
    "en": {
            "localeName": "English",
            "localeCode": "en",
            "title": "OAIE",
    }
};
var ml = i18n[settingsSystem.settings ? settingsSystem.settings.locale : "en"];
export default {
  name: 'Sketch',
  methods: {
    selectSettings(settingsKey) {
      settingsSystem.settings = settingsSystem.loadSettings(settingsKey);
      this.settings = settingsSystem.settings;
      if (window.initSwaggerEditor) initSwaggerEditor(this.settings.spec);
      this.load();
    },
    setPositionsChanged() {
        this.positionsChanged = true;
    },
    clearSettings() {
      var me = this;
      settingsSystem.clearSettings().then(function(s) {
        me.settings = settingsSystem.settings;
        me.load();
	  });
    },
    newSettings() {
      var me = this;
      settingsSystem.getNewSettings().then(function(s) {
        settingsSystem.settings = s;
        me.settings = settingsSystem.settings;
        me.load();
	  }).catch(function() {});
    },
    getPositionLeft: function(key) {
      if (this.settings.positions === undefined) return 0;
      if (this.settings.positions[key] === undefined) return 0;
      return this.settings.positions[key].x + 'px';
    },
    getPositionTop: function(key) {
      if (this.settings.positions === undefined) return 0;
      if (this.settings.positions[key] === undefined) return 0;
      return this.settings.positions[key].y + 'px';
    },
    save: function(e) {
      settingsSystem.storeSettings();
    },
    sortObject: function(object) {
      const sorted = {};
      Object.keys(object).sort().forEach(function(key) {
        sorted[key] = object[key];
      });
      return sorted;
    },
    selectPath: function(path, selectSubString) {
      var textarea = $('#specEditor textarea').get(0);
      var o = 0;
      var t = this.settings.spec;
      path = path.split('/');
      for (var p in path) {
        if (path == '') continue;
        var part = decodeURIComponent(path[p]);
        var re = new RegExp("\n\\s*" + part);
        var m = t.match(re);
        // we could not find the path part
        if (m == null) return;
        o += m.index;
        t = t.substr(m.index);
      }
      if (selectSubString === undefined) selectSubString = part.replace(/^[\n\s]*/, '').replace(/:$/, '');
      // the last mile: skip the whitespace
      var ws = t.indexOf(selectSubString);
      var s = o + ws;
      var e = s + selectSubString.length;
      textarea.setSelectionRange(s, e);
      textarea.focus();

      this.scrollToOffset(o);
    },
    scrollToOffset: function(o) {
      var t = this.settings.spec;
      t = t.substr(0, o);
      var lines = t.match(/\n/g).length;
      // TODO: it would be more elegant to create and destroy the helper on demand
      var helper = $('#specEditor .measureHelper').get(0)
      var lineHeight = $(helper).height();
      $('#specEditor textarea').scrollTop(lines * lineHeight - 100);
    },
    selectSchema: function(name) {
      return this.selectPath("components/schemas/" + name);
    },
    load: function() {
      // TODO: we want to store x and y (and maybe other data) with the document
      //       without violating the OAS schema. jsyaml does not read comments though..
      // ALSO: <<: blah - references are resolved during load and therefore lost on write.

      // if the document contains an inline viz, we restore the positions from there.
      var divs = this.settings.spec.match(/<div ([^>]*)>/g)
      for (var d in divs) {
        var div = divs[d];
        try {
          var key = div.match(/oaie-key='([^']+)'/)[1];
          var x = div.match(/left:([0-9\.]+)px/)[1];
          var y = div.match(/top:([0-9\.]+)px/)[1];
          this.settings.positions[key] = { x: x, y: y };
        }
        catch (e) {
          //console.error("could not extract position info for", div, e);
        }
      }

      var data = jsyaml.load(this.settings.spec);
      console.log(data);
      this.spec = data;
      this.editorChanged = false;
      // do it again after vue has created the elements
      // TODO: rewrite to use vues nextTick
      Vue.nextTick(() => {
        connectArrowsAll();
        this.updateInlineViz();
      });
    },
    updateInlineViz: function() {
      var r = `<!--OAIE.viz--><div style='height:500px;background-color:#eee;overflow:auto;position:relative;white-space:nowrap;border-radius:10px;'>`;
      $('a.arrow').each((i,o) => {
        o = $(o);
        var borderStyle = o.hasClass('propertyArray') ? 'border-bottom:1px dashed black;' : 'border-bottom:1px solid black;'
        r += `<span style='${borderStyle}position:absolute;left:${o.css('left')};top:${o.css('top')};width:${o.css('width')};transform:${o.css('transform')};transform-origin:0 0;'><span style='border:1px solid black;width:5px;height:5px;position:absolute;right:0;transform:rotate(45deg);transform-origin:100% 0;border-left:0;border-bottom:0;'></span></span>`;
      });
      $('div.operation').each((i,o) => {
        o = $(o);
        var colorStyle = `border:1px solid ${o.css('border-color')};background:${o.css('background-color')};`;
        r += `<div oaie-key='${o.attr('oaie-key')}' style='${colorStyle}position:absolute;left:${o.css('left')};top:${o.css('top')};width:${o.width()}px;height:${o.height()}px;padding:5px;border-radius:5px;'>`;
        o.find('.path').each((i,o) => { r += `<div><b>${$(o).text()}</b></div>`; });
        o.find('.summary').each((i,o) => { r += `<div style='white-space:normal'>${$(o).text()}</div>`; });
        o.find('li span').each((i,o) => { r += `<div>${$(o).text().trim()}</div>`; });
        r += `</div>`;
      });
      $('div.schema').each((i,o) => {
        o = $(o);
        r += `<div oaie-key='${o.attr('oaie-key')}' style='position:absolute;left:${o.css('left')};top:${o.css('top')};width:${o.width()}px;height:${o.height()}px;border:1px solid silver;background:white;padding:5px;border-radius:5px;'>`;
        o.find('h1').each((i,o) => { r += `<div><b>${$(o).text()}</b></div>`; });
        o.find('li span').each((i,o) => { r += `<div>${$(o).text().trim()}</div>`; });
        r += `</div>`;
      });
      r += `</div>`;
      r += `<div style='padding:5px;color:gray;float:right;'>OAIE visualization</div><!--/OAIE.viz-->`;
      this.settings.spec = this.settings.spec.replace(/<!--OAIE.viz-->.*<!--\/OAIE.viz-->/, r);
      this.positionsChanged = false;
      this.save();
    },
    dump: function() {
      // TODO: this currently destroys comments and may destroy ordering, etc.
      //       is there a more elegant way?
      //       like walk the whole structure, monitor changes and only apply changes
      //       to parts of the input text..
      var yaml = jsyaml.dump(this.spec);
      console.log(yaml);

      //settings.spec = yaml;
    },
    addSchema: function() {
      var name = prompt("name");
      if (name === undefined) return;
      this.settings.spec += '    ' + name + ':\n      required:\n      properties:';
      this.settings.spec = settingsSystem.settings.spec.replace(/\n\n/, '\n');
      this.load();
      // this.storeSettings();
    },
    saveSpec: function() {
      json(parsed.saveToFileEndpoint, 'spec', function() {
        alert('Spec saved');
      }, function() {
        alert('Error while saving spec');
      });
    },
    addSchemaProperty: function(schema, schemaName) {
      var name = prompt("name");
      if (name === undefined) return;
      // TODO: this is all very hacky
      var s = this.settings.spec.indexOf(schemaName + ":");
      var e = this.settings.spec.substring(s).search(/\n    [^ ]/);
      if (e < 0) { e = this.settings.spec.length } else { e = e + s };
      var props = '\n      properties:';
      var p = this.settings.spec.indexOf(props, s);
      // add properties block if needed
      if (p < s || p > e) {
        this.settings.spec = this.settings.spec.slice(0, e) + props + '\n' + this.settings.spec.slice(e);
        p = e;
        e = e + props.length;
      }
      p = p + props.length;
      var type = 'string';
      var matchType = name.match(/\s+\(([^\)]+)\)/);
      if (matchType) {
        type = matchType[1];
        // TODO: if type is one of our defined types, build a ref instead of the type
        name = name.replace(/\s+\(([^\)]+)\)/, '');
      }
      var prop = '\n        ' + name + ':\n          type: ' + type + '\n';
      this.settings.spec = this.settings.spec.slice(0, e) + prop + this.settings.spec.slice(e);
      this.settings.spec = this.settings.spec.replace(/\n\n/, '\n');
      this.load();
      // TODO: select the new attribute
      // this.storeSettings();
    },
    moveAllY: function(minY, byY) {
      if (typeof minY == "object")
        minY = this.settings.positions[minY._key].y;
      for (var key in this.settings.positions) {
        var y = Number(this.settings.positions[key].y);
        if (y < minY - 10) continue;
        this.settings.positions[key].y = y + byY;
      }
      this.positionsChanged = true;
      settingsSystem.storeSettings();
      Vue.nextTick(() => {
        connectArrowsAll();
      });
    }
  },
  filters: {
    i18nMoustache: function(text) {
      text = text.replace(/\{\{ ?config.(\w*) ?\}\}/, function(m, g1) { return config[g1]; });
      return text;
    },
    i18nError: function(text) {
      if (ml[text] !== undefined)
        return ml[text];
      return text;
    },
  },
  data: function() {
    return {
      allSettings: settingsSystem.allSettings,
      settings: settingsSystem.settings,
      config: config,
      i18n: i18n,
      ml: ml,
      activeExample: null,
      spec: { paths: [], components: { schemas: {}, }, },
      editorChanged: false,
      positionsChanged: false,
      editorWide: false,
      saveToFile: !!parsed.saveToFileEndpoint
    }
  },
  computed: {
    operations: function() {
      var r = [];
      for (var p in this.spec.paths) {
        var path = this.spec.paths[p];
        for (var method in path) {
          var operation = path[method];
          operation._method = method;
          operation._path = p;
          operation._key = "operation." + operation._method + "." + operation._path;
          r.push(operation);
        }
      }
      return r;
    },
    connections: function() {
      var r = [];
      // TODO: array connections
      // TODO: find a more generic way than this
      //       just walk the whole tree and look for '$ref'?
      //       just walk from certain starting points
      // TODO: are there other connections?

      var noInArrows = {};
      for (var s in this.spec.components.schemas) {
        var schema = this.spec.components.schemas[s];
        if (!schema.description) continue;
        if (schema.description.indexOf("OAIE.noInArrows") >= 0)
        noInArrows[s] = true;
      }

      var getRef = function(o) {
        if (o['$ref'] === undefined) return null;
        var ref = o['$ref'];
        return ref.replace(/^#.*\//, '');
      }
      var getSchemaRef = function(o) {
        if (o.content === undefined ||
          o.content['application/json'] === undefined ||
          o.content['application/json'].schema === undefined)
          return null;
        return getRef(o.content['application/json'].schema);
      };
      var getArraySchemaRef = function(o) {
        if (o.content === undefined ||
          o.content['application/json'] === undefined ||
          o.content['application/json'].schema === undefined ||
          o.content['application/json'].schema.items === undefined)
          return null;
        return getRef(o.content['application/json'].schema.items);
      };

      if (!this.spec) return r;

      // connect paths to schemas
      for (var p in this.spec.paths) {
        var path = this.spec.paths[p];
        for (var method in path) {
          var operation = path[method];
          if (operation.requestBody !== undefined) {
            var ref = getSchemaRef(operation.requestBody);
            if (ref == null) continue;
            if (ref != null && !noInArrows[ref]) r.push({ source: "operation." + method + "." + p, target: 'schema.' + ref, type: 'request' });
          }
          for (var code in operation.responses) {
            var response = operation.responses[code];
            var ref = getSchemaRef(response);
            if (ref != null && !noInArrows[ref]) r.push({ source: "operation." + method + "." + p, target: 'schema.' + ref, type: 'response' });

            var ref = getArraySchemaRef(response);
            if (ref != null && !noInArrows[ref]) r.push({ source: "operation." + method + "." + p, target: 'schema.' + ref, type: 'array' });
          }
        }
      }

      // connect schemas to schemas
      for (var s in this.spec.components.schemas) {
        var schema = this.spec.components.schemas[s];
        for (var p in schema.properties) {
          var property = schema.properties[p];
          var ref = getRef(property);
          if (ref != null && !noInArrows[ref]) r.push({ source: 'schema.' + s, target: 'schema.' + ref, type: 'propertyObject'});
          // TODO: is this even a legal syntax?
          if (property.type == 'object') {
            var ref = getRef(property);
            if (ref != null) r.push({ source: 'schema.' + s, target: 'schema.' + ref, type: 'propertyObject'});
          }
          if (property.type == 'array') {
            if (property.items !== undefined) {
              var ref = getRef(property.items);
              if (ref != null && !noInArrows[ref]) r.push({ source: 'schema.' + s, target: 'schema.' + ref, type: 'propertyArray'});
            }
          }
        }
        if (schema.type == 'array') {
          if (schema.items !== undefined) {
            var ref = getRef(schema.items);
            if (ref != null && !noInArrows[ref]) r.push({ source: 'schema.' + s, target: 'schema.' + ref, type: 'array' });
          }
        }
      }
      return r;
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.active { background-color: aliceblue; }

/* tree-item component */
.tree { list-style-type: none; }
.tree div { position: relative; }
.tree .expander { cursor: pointer; color: silver; }
.tree ul { padding-left: 10px; }
.tree .value { color: silver; }
.tree .description { position: absolute; right: 15px; text-align: right; }
.tree div:hover { background-color: aliceblue; }

span.oaie,
span.oaie::before,
span.oaie::after {
        content: 'OAIE';
        position: absolute;
        display: inline-block;
        height: 1em;
        width: 1em;
        border: 0.1em solid yellowgreen;
        top: 0em;
        box-sizing: border-box;
}
span.oaie::before {
        content: '\00a0\00a0\00a0\00a0|';
        color: gold;
        border-color: tomato;
        left: -1.8em;
        border-radius: 1em;
        text-align: left;
        top: -0.1em;
}
span.oaie::after {
        color: transparent;
        border-color: steelblue;
        left: -0.5em;
        top: 0.7em;
        border-right: none;
        border-bottom: none;
        transform: rotate(45deg);
        transform-origin: 0 0;
        outline-left: 0.1em solid yellow;
        outline-offset: 0.4em;
}
span.oaie {
        position: relative;
        left: 0px;
        top: 0px;
        margin: 0 25px;
        border-right: none;
        line-height: 60%;
        padding-left: 0.45em;
        white-space: nowrap;
        color: green;
}
span.oaie::first-letter { color: yellowgreen; }
.menu .title { position: absolute; right: 5px; top: 5px; font-size: 12pt; font-weight: bold; }
.menu .title .version { background-color: gray; color: white; border-radius: 10px; padding: 3px 5px; font-size: 9pt; }
#specEditor             { position: absolute; left: 0;   right: 70%; top: 0;   bottom: 0%; }
#outputViewer   { position: absolute; left: 30%; right: 0;   top: 0;   bottom: 0; }

textarea.fill,
#specEditor textarea,
#specEditor .measureHelper,
#exampleEditor textarea {
        position: absolute; left: 0; right: 0; width: 100%; height: 100%; min-width: 100%; min-height: 100%; max-width: 100%; max-height: 100%;
        border: 0;
        font-size: 10pt; font-family: monospace;
        padding: 5px;
        -webkit-box-sizing: border-box; -moz-box-sizing: border-box; box-sizing: border-box;
}
#specEditor textarea,
#specEditor .measureHelper,
#exampleEditor textarea {
        background-color: #ffe;
}

#specEditor .editor { position: absolute; left: 0; right: 0; top: 0; bottom: 0; }
#specEditor textarea,
#specEditor .measureHelper { background-color: #2d2d2d; color: silver; font-size: 11pt; }

#specEditor .measureHelper { margin: 0; padding: 0; display: inline; min-height: 0; height: auto; }

#specEditor .editorWideToggle { color: silver; position: absolute; right: 5px; font-size: 18pt; cursor: e-resize; }
.editorWide #specEditor .editorWideToggle { cursor: w-resize; }
.editorWide #specEditor { right: 50%; }
.editorWide #outputViewer { left: 50%; }

#locale { position: absolute; left: 5px; bottom: 5px; }

#outputViewer { background-color: #eee; }
#outputViewer .menu { position: absolute; left: 0; right: 0; top: 0; height: 30px; background-color: #eee; -webkit-box-sizing: border-box; -moz-box-sizing: border-box; box-sizing: border-box; padding: 5px; }
#outputViewer #output { position: absolute; left: 0; right: 0; top: 30px; bottom: 0; padding: 0px; overflow: auto; }
#outputViewer #output .file { padding: 10px; border-bottom: 1px solid silver; font-size: 9pt; }

#output > div { border: 1px solid silver; position: absolute; overflow: auto; border-radius: 5px; font-size: 9pt; }
#output > div h1 { padding: 5px; margin: 0; font-size: 10pt; }
#output > div ul { padding: 0 5px; }
#output > div ul li { list-style-type: none; white-space: nowrap; }
#output > div .buttonRow { position: absolute; top: 3px; right: 3px; }
button.mini,
#output > div ul li button { border: 1px solid gray; background-color: white; border-radius: 10px; width: 12px; height: 12px; line-height: 10px; display: inline-block; padding: 0; color: black; }
#output .operation { background-color: #ffe; border-top-left-radius: 20px; }
#output .operation .path { padding-left: 30px; padding-top: 10px; padding-right: 5px; font-weight: bold; }
#output .operation .path b { background-color: gray; color: white; text-transform: uppercase; width: 50px; padding: 2px; font-size: 7pt; display: block; position: absolute; text-align: center; transform: rotate(-45deg); transform-origin: 100% 0; left: -39px; top: -23px; padding-top: 20px; }

#output .operation ul li.required { font-weight: bold; }

#output .operation.delete { background-color: #feeeee; border-color: #f93e3f; }
#output .operation.delete .path b { background-color: #f93e3f; }

#output .operation.post { background-color: #eefaf5; border-color: #49cc90; }
#output .operation.post .path b { background-color: #49cc90; }

#output .operation.get { background-color: #f0f7ff; border-color: #61affe; }
#output .operation.get .path b { background-color: #61affe; }

#output .operation.put { background-color: #fff6ec; border-color: #fca130; }
#output .operation.put .path b { background-color: #fca130; }

#output .schema { background-color: white; }

#output .summary { max-width: 250px; padding: 5px 5px 0 10px; white-space: pre-wrap; }
#output .description { max-width: 250px; padding: 5px 5px 0 10px; white-space: pre-wrap; }

.arrow { transform: rotate(30deg); transform-origin: 0 0; border-width: 0px; border-style: solid; border-color: black; border-top-width: 1px; width: 100px; position: absolute; display: block; padding: 0; top: 100px; left: 100px; }
.arrow::after { content: " "; position: absolute; width: 5px; height: 5px; border-width: 0px; border-right-width: 1px; border-top-width: 1px; border-style: inherit; border-color: inherit; transform: rotate(45deg); transform-origin: 100% 0; right: 0; }
.arrow.array,
.arrow.propertyArray { border-style: dashed; }

.changed { color: goldenrod; }

.settings { background-color: yellowgreen; color: white; padding: 15px; margin: 7px 7px 0 7px; border-radius: 5px; cursor: pointer; border: 3px solid yellowgreen; font-size: 20px; }
.settings.new { background-color: transparent; color: yellowgreen; border-style: dashed; }

@media print {
        #specEditor { display: none; }
        #outputViewer { position: static; left: 0; }
        #outputViewer .menu { display: none; }
        #outputViewer #output { position: static; }
}
</style>
