/* global L */

(function ($) { var escape_html = function (str) { return str.replace(/</gm, "&lt;").replace(/>/gm, "&gt;") }; var unescape_html = function (str) { return str.replace(/&lt;/gm, "<").replace(/&gt;/gm, ">") }; $.fn.editable = function (event, callback) { if (typeof callback !== "function") callback = function () { }; if (typeof event === "string") { var trigger = this; var action = event; var type = "input" } else if (typeof event === "object") { var trigger = event.trigger || this; if (typeof trigger === "string") trigger = $(trigger); var action = event.action || "click"; var type = event.type || "input" } else { throw 'Argument Error - jQuery.editable("click", function(){ ~~ })' } var target = this; var edit = {}; edit.start = function (e) { trigger.unbind(action === "clickhold" ? "mousedown" : action); if (trigger !== target) trigger.hide(); var old_value = (type === "textarea" ? target.text().replace(/<br( \/)?>/gm, "\n").replace(/&gt;/gm, ">").replace(/&lt;/gm, "<") : target.text()).replace(/^\s+/, "").replace(/\s+$/, ""); var input = type === "textarea" ? $("<textarea>") : $("<input>"); input.val(old_value).css("width", type === "textarea" ? "100%" : target.width() + target.height()).css("font-size", "100%").css("margin", 0).attr("id", "editable_" + new Date * 1).addClass("editable"); if (type === "textarea") input.css("height", target.height()); var finish = function () { var result = input.val().replace(/^\s+/, "").replace(/\s+$/, ""); var html = escape_html(result); if (type === "textarea") html = html.replace(/[\r\n]/gm, "<br />"); target.html(html); callback({ value: result, target: target, old_value: old_value }); edit.register(); if (trigger !== target) trigger.show() }; input.blur(finish); if (type === "input") { input.keydown(function (e) { if (e.keyCode === 13) finish() }) } target.html(input); input.focus() }; edit.register = function () { if (action === "clickhold") { var tid = null; trigger.bind("mousedown", function (e) { tid = setTimeout(function () { edit.start(e) }, 500) }); trigger.bind("mouseup mouseout", function (e) { clearTimeout(tid) }) } else { trigger.bind(action, edit.start) } }; edit.register(); return this } })(jQuery);
L.Control.GroupedLayers = L.Control.extend({

  options: {
    collapsed: true,
    position: 'topright',
    autoZIndex: true,
    exclusiveGroups: [],
    groupCheckboxes: false,
    removableGroups: []
  },

  initialize: function (baseLayers, groupedOverlays, options) {
    var i, j;
    L.Util.setOptions(this, options);

    this._layers = [];
    this._lastZIndex = 0;
    this._handlingClick = false;
    this._groupList = [];
    this._domGroups = [];

    for (i in baseLayers) {
      this._addLayer(baseLayers[i], i);
    }

    for (i in groupedOverlays) {
      for (j in groupedOverlays[i]) {
        this._addLayer(groupedOverlays[i][j], j, i, true);
      }
    }
  },

  onAdd: function (map) {
    this._initLayout();
    this._update();

    map
      .on('layeradd', this._onLayerChange, this)
      .on('layerremove', this._onLayerChange, this);

    return this._container;
  },

  onRemove: function (map) {
    map
      .off('layeradd', this._onLayerChange, this)
      .off('layerremove', this._onLayerChange, this);
  },

  addBaseLayer: function (layer, name) {
    this._addLayer(layer, name);
    this._update();
    return this;
  },

  addOverlay: function (layer, name, group) {
    this._addLayer(layer, name, group, true);
    this._update();
    return this;
  },

  removeLayer: function (layer) {
    var id = L.Util.stamp(layer);
    var _layer = this._getLayer(id);

    if (_layer) {

      for (let index = 0; index < this._layers.length; index++) {
        const element = this._layers[index];

        if (element.name === _layer.name) {
          this._layers.splice(index, 1);
          map.removeLayer(element.layer);
        }
      }
    }

    this._update();
    return this;
  },

  _getLayer: function (id) {
    for (var i = 0; i < this._layers.length; i++) {
      if (this._layers[i] && L.stamp(this._layers[i].layer) === id) {
        return this._layers[i];
      }
    }
  },

  _initLayout: function () {
    var className = 'leaflet-control-layers',
      container = this._container = L.DomUtil.create('div', className);

    // Makes this work on IE10 Touch devices by stopping it from firing a mouseout event when the touch is released
    container.setAttribute('aria-haspopup', true);

    if (L.Browser.touch) {
      L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
    } else {
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(container, 'wheel', L.DomEvent.stopPropagation);
    }

    var form = this._form = L.DomUtil.create('form', className + '-list');

    if (this.options.collapsed) {
      if (!L.Browser.android) {
        L.DomEvent
          .on(container, 'mouseover', this._expand, this)
          .on(container, 'mouseout', this._collapse, this);
      }
      var link = this._layersLink = L.DomUtil.create('a', className + '-toggle', container);
      link.href = '#';
      link.title = 'Layers';

      if (L.Browser.touch) {
        L.DomEvent
          .on(link, 'click', L.DomEvent.stop)
          .on(link, 'click', this._expand, this);
      } else {
        L.DomEvent.on(link, 'focus', this._expand, this);
      }

      this._map.on('click', this._collapse, this);
      // TODO keyboard accessibility
    } else {
      this._expand();
    }

    this._baseLayersList = L.DomUtil.create('div', className + '-base', form);
    this._separator = L.DomUtil.create('div', className + '-separator', form);
    this._overlaysList = L.DomUtil.create('div', className + '-overlays', form);

    container.appendChild(form);
  },

  _addLayer: function (layer, name, group, overlay) {
    var id = L.Util.stamp(layer);

    var _layer = {
      layer: layer,
      name: name,
      overlay: overlay
    };
    this._layers.push(_layer);

    group = group || '';
    var groupId = this._indexOf(this._groupList, group);

    if (groupId === -1) {
      groupId = this._groupList.push(group) - 1;
    }

    var exclusive = (this._indexOf(this.options.exclusiveGroups, group) !== -1);

    _layer.group = {
      name: group,
      id: groupId,
      exclusive: exclusive
    };

    if (this.options.autoZIndex && layer.setZIndex) {
      this._lastZIndex++;
      layer.setZIndex(this._lastZIndex);
    }
  },

  _update: function () {
    if (!this._container) {
      return;
    }

    this._baseLayersList.innerHTML = '';
    this._overlaysList.innerHTML = '';
    this._domGroups.length = 0;

    var baseLayersPresent = false,
      overlaysPresent = false,
      i, obj;

    for (var i = 0; i < this._layers.length; i++) {
      obj = this._layers[i];
      this._addItem(obj);
      overlaysPresent = overlaysPresent || obj.overlay;
      baseLayersPresent = baseLayersPresent || !obj.overlay;
    }

    this._separator.style.display = overlaysPresent && baseLayersPresent ? '' : 'none';
  },

  _onLayerChange: function (e) {
    var obj = this._getLayer(L.Util.stamp(e.layer)),
      type;

    if (!obj) {
      return;
    }

    if (!this._handlingClick) {
      this._update();
    }

    if (obj.overlay) {
      type = e.type === 'layeradd' ? 'overlayadd' : 'overlayremove';
    } else {
      type = e.type === 'layeradd' ? 'baselayerchange' : null;
    }

    if (type) {
      this._map.fire(type, obj);
    }
  },

  // IE7 bugs out if you create a radio dynamically, so you have to do it this hacky way (see http://bit.ly/PqYLBe)
  _createRadioElement: function (name, checked) {
    var radioHtml = '<input type="radio" class="leaflet-control-layers-selector" name="' + name + '"';
    if (checked) {
      radioHtml += ' checked="checked"';
    }
    radioHtml += '/>';

    var radioFragment = document.createElement('div');
    radioFragment.innerHTML = radioHtml;

    return radioFragment.firstChild;
  },

  _addItem: function (obj) {
    var label = document.createElement('div'),
      input,
      checked = this._map.hasLayer(obj.layer),
      container,
      groupRadioName;

    if (obj.overlay) {
      if (obj.group.exclusive) {
        groupRadioName = 'leaflet-exclusive-group-layer-' + obj.group.id;
        input = this._createRadioElement(groupRadioName, checked);
      } else {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'leaflet-control-layers-selector';
        input.defaultChecked = checked;
      }
    } else {
      input = this._createRadioElement('leaflet-base-layers', checked);
    }

    input.layerId = L.Util.stamp(obj.layer);
    input.groupID = obj.group.id;
    L.DomEvent.on(input, 'click', this._onInputClick, this);

    var name = document.createElement('span');
    name.innerHTML = ' ' + obj.name;

    var deleteImage = document.createElement('img');
    deleteImage.src = "../images/delete.png";
    deleteImage.style = "float: right";
    deleteImage.layerId = L.Util.stamp(obj.layer);
    L.DomEvent.on(deleteImage, 'click', () => this._onDeleteClick(deleteImage.layerId), this);

    label.appendChild(input);

    if (this.options.removableGroups.includes(obj.group.name)) {
      $(label).append($(name).editable("click", this._onEditClick.bind(this)));
    } else {
      label.appendChild(name);
    }

    if (this.options.removableGroups.includes(obj.group.name)) {
      label.appendChild(deleteImage);
    }

    if (obj.overlay) {
      container = this._overlaysList;

      var groupContainer = this._domGroups[obj.group.id];

      // Create the group container if it doesn't exist
      if (!groupContainer) {
        groupContainer = document.createElement('div');
        groupContainer.className = 'leaflet-control-layers-group';
        groupContainer.id = 'leaflet-control-layers-group-' + obj.group.id;

        var groupLabel = document.createElement('label');
        groupLabel.className = 'leaflet-control-layers-group-label';

        if (obj.group.name !== '' && !obj.group.exclusive) {
          // ------ add a group checkbox with an _onInputClickGroup function
          if (this.options.groupCheckboxes) {
            var groupInput = document.createElement('input');
            groupInput.type = 'checkbox';
            groupInput.className = 'leaflet-control-layers-group-selector';
            groupInput.groupID = obj.group.id;
            groupInput.legend = this;
            L.DomEvent.on(groupInput, 'click', this._onGroupInputClick, groupInput);
            groupLabel.appendChild(groupInput);
          }
        }

        var groupName = document.createElement('span');
        groupName.className = 'leaflet-control-layers-group-name';
        groupName.innerHTML = obj.group.name;
        groupLabel.appendChild(groupName);

        groupContainer.appendChild(groupLabel);
        container.appendChild(groupContainer);

        this._domGroups[obj.group.id] = groupContainer;
      }

      container = groupContainer;
    } else {
      container = this._baseLayersList;
    }

    container.appendChild(label);

    return label;
  },

  _onGroupInputClick: function () {
    var i, input, obj;

    var this_legend = this.legend;
    this_legend._handlingClick = true;

    var inputs = this_legend._form.getElementsByTagName('input');
    var inputsLen = inputs.length;

    for (i = 0; i < inputsLen; i++) {
      input = inputs[i];
      if (input.groupID === this.groupID && input.className === 'leaflet-control-layers-selector') {
        input.checked = this.checked;
        obj = this_legend._getLayer(input.layerId);
        if (input.checked && !this_legend._map.hasLayer(obj.layer)) {
          this_legend._map.addLayer(obj.layer);
        } else if (!input.checked && this_legend._map.hasLayer(obj.layer)) {
          this_legend._map.removeLayer(obj.layer);
        }
      }
    }

    this_legend._handlingClick = false;
  },

  _onInputClick: function () {
    var i, input, obj,
      inputs = this._form.getElementsByTagName('input'),
      inputsLen = inputs.length;

    this._handlingClick = true;

    for (i = 0; i < inputsLen; i++) {
      input = inputs[i];
      if (input.className === 'leaflet-control-layers-selector') {
        obj = this._getLayer(input.layerId);

        if (input.checked && !this._map.hasLayer(obj.layer)) {
          this._map.addLayer(obj.layer);
        } else if (!input.checked && this._map.hasLayer(obj.layer)) {
          this._map.removeLayer(obj.layer);
        }
      }
    }

    this._handlingClick = false;
  },

  _onDeleteClick: function (layerId) {
    var obj = this._getLayer(layerId);
    this.removeLayer(obj.layer);
    if (this.onRemoveLayer) {
      this.onRemoveLayer(obj.name);
    }
  },

  _onEditClick: function (e) {
    if (e.value === "") {
      e.target.html(e.old_value);
      alert(e.value + " is not valid layer name");
    } else {
      if (this.onEditLayer) {
        this.onEditLayer(e.old_value, e.value);
      }
    }
  },

  _expand: function () {
    L.DomUtil.addClass(this._container, 'leaflet-control-layers-expanded');
    // permits to have a scrollbar if overlays heighter than the map.
    var acceptableHeight = this._map._size.y - (this._container.offsetTop * 4);
    if (acceptableHeight < this._form.clientHeight) {
      L.DomUtil.addClass(this._form, 'leaflet-control-layers-scrollbar');
      this._form.style.height = acceptableHeight + 'px';
    }
  },

  _collapse: function () {
    this._container.className = this._container.className.replace(' leaflet-control-layers-expanded', '');
  },

  _indexOf: function (arr, obj) {
    for (var i = 0, j = arr.length; i < j; i++) {
      if (arr[i] === obj) {
        return i;
      }
    }
    return -1;
  }
});

L.control.groupedLayers = function (baseLayers, groupedOverlays, options) {
  return new L.Control.GroupedLayers(baseLayers, groupedOverlays, options);
};
