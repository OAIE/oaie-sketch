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
