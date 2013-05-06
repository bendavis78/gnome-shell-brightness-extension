/*
 * Copyright/Copyleft (C) 2012
 * Luis Medinas <lmedinas@gmail.com>, Orest Tarasiuk <orest.tarasiuk@tum.de>
 *
 * This file is part of Gnome Shell Extension Brightness Control (GSEBC).
 *
 * GSEBC is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * GSEBC is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with GSEBC. If not, see <http://www.gnu.org/licenses/>.
 *
 * Special thanks to dsboger.
 *
 */

const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;
const ExtensionUtils = imports.misc.extensionUtils;
const Convenience = ExtensionUtils.getCurrentExtension().imports.convenience;

const Name = "brightness_control";
const UUID = Name + "@lmedinas.org";
const _ = imports.gettext.domain(UUID).gettext;
const GCC_ = imports.gettext.domain('gnome-control-center-2.0').gettext;

const BrightnessIface = <interface name="org.gnome.SettingsDaemon.Power.Screen">
<method name="GetPercentage">
    <arg type="u" direction="out" />
</method>
<method name="SetPercentage">
    <arg type="u" direction="in" />
    <arg type="u" direction="out" />
</method>
<method name="StepUp">
    <arg type="u" direction="out" />
</method>
<method name="StepDown">
    <arg type="u" direction="out" />
</method>
<!--
<signal name="Changed">
    <arg type="" direction="in" />
</signal>-->
</interface>;

const BrightnessDbus = Gio.DBusProxy.makeProxyWrapper(BrightnessIface);

const KeyBindings = {
    'increasedisplaybrightness': function() {
        indicator._stepUp();
    },

    'decreasedisplaybrightness': function() {
        indicator._stepDown();
    }
}

const SETTING_ICON = "showicon";

let indicator, settings, settingsId, persist, showIcon;
let settingsIdArray = [];

function ScreenBrightness() {
    this._init.apply(this, arguments);
}

ScreenBrightness.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,

    _init: function() {
        PanelMenu.SystemStatusButton.prototype._init.call(this,
            'display-brightness-symbolic');

        this._proxy = new BrightnessDbus(Gio.DBus.session,
            'org.gnome.SettingsDaemon', '/org/gnome/SettingsDaemon/Power');

//        /* TODO: This doesn't seem to work on GS > 3.4 */
//        this._onChangedId = this._proxy.connect('Changed',
//            Lang.bind(this, this._updateBrightness));

        let level = settings.get_string("level");
        persist = settings.get_boolean("persist");
        if (persist) {
            this._proxy.SetPercentageRemote(parseInt(level));
        }

        this._updateBrightness();

        this.setIcon('display-brightness-symbolic');
        let label = new PopupMenu.PopupMenuItem(GCC_("Brightness"), {
            reactive: false
        });

        this.menu.addMenuItem(label);
        this._slider = new PopupMenu.PopupSliderMenuItem(0);
        this._slider.connect('value-changed', Lang.bind(this, function(item) {
            this._setBrightness(item._value * 100, 0);
        }));

        this.menu.addMenuItem(this._slider);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addSettingsAction(GCC_("Power Settings"),
            'gnome-power-panel.desktop');
        this.newMenuItem = new PopupMenu.PopupMenuItem(_("Extension Settings"));
        this.menu.addMenuItem(this.newMenuItem);
        this.newMenuItem.connect("activate", Lang.bind(this, this._launchPrefs));

        this.actor.connect('button-press-event',
            Lang.bind(this, this._updateBrightness));
        this.actor.connect('scroll-event',
            Lang.bind(this, this._onScrollEvent));
    },

    _onScrollEvent: function(actor, event) {
        switch (event.get_scroll_direction()) {
            case Clutter.ScrollDirection.DOWN:
            case Clutter.ScrollDirection.LEFT:
                this._stepDown();
                break;
            case Clutter.ScrollDirection.UP:
            case Clutter.ScrollDirection.RIGHT:
                this._stepUp();
                break;            
            default:
                break;
        }
    },

    _stepUp: function() {
        this._proxy.GetPercentageRemote(Lang.bind(this,
            function (result, error) {
                if (!error) {
                    if (result < 100) {
                        this._proxy.StepUpRemote();
                        this._updateBrightness();
                    }
                }
            }));

    },

    _stepDown: function() {
        this._proxy.GetPercentageRemote(Lang.bind(this,
            function (result, error) {
                if (!error) {
                    if (result > 0) {
                        this._proxy.StepDownRemote();
                        this._updateBrightness();
                    }
                }
            }));
    },

    _setBrightness: function(brightness, refreshSlider) {
        brightness = parseInt(brightness);
        this._proxy.SetPercentageRemote(brightness);
        this._updateBrightness(refreshSlider);
    },

    _updateBrightness: function(refreshSlider) {
        this._proxy.GetPercentageRemote(Lang.bind(this,
            function (result, error) {
                if (!error) {
                    settings.set_string("level", result.toString());
                    if (!this._slider._dragging && refreshSlider != 0)
                        this._slider.setValue(result / 100);
                }
            }));
    },

    _launchPrefs: function() {
        let appSys = Shell.AppSystem.get_default();
        let app = appSys.lookup_app('gnome-shell-extension-prefs.desktop');
        app.launch(global.display.get_current_time_roundtrip(),
            ['extension:///' + UUID], -1, null);
        this.menu.close();
    }
}

function init(metadata) {
    imports.gettext.bindtextdomain(Name,
        metadata.path + "/locale");
}

function enable() {
    settings = Convenience.getSettings();
    indicator = new ScreenBrightness();

    settingsIdArray[0] = settings.connect("changed::" + SETTING_ICON,
        Lang.bind(this,  function () {
            disable();
            enable();
        }));
    showIcon = settings.get_boolean(SETTING_ICON);
    if (showIcon)
        Main.panel.addToStatusArea('brightness', indicator, 3);

    for(key in KeyBindings) {
        global.display.add_keybinding(key,
            settings,
            Meta.KeyBindingFlags.NONE,
            KeyBindings[key]
            );
    }
}

function disable() {
    for(key in KeyBindings) {
        global.display.remove_keybinding(key);
    }

    if (settings !== null && settingsIdArray !== null) {
        for (let i = 0; i < settingsIdArray.length; i++) {
            if (settingsIdArray[i] > -1)
                settings.disconnect(settingsIdArray[i]);
        }
    }

    if (indicator !== null && indicator._onChangedId > -1)
        indicator._proxy.disconnect(indicator._onChangedId);
    settings = null;
    if (indicator !== null) indicator.destroy();
    indicator = null;
}
