/*
 * Copyright/Copyleft (C) 2012 Orest Tarasiuk <orest.tarasiuk@tum.de>
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
 */

const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const ExtensionUtils = imports.misc.extensionUtils;
const Convenience = ExtensionUtils.getCurrentExtension().imports.convenience;
const Gettext = imports.gettext.domain("gnome-shell-extension-brightness-control");
const _ = Gettext.gettext;
const GObject = imports.gi.GObject;

let settings;
let boolSettings;
let stringSettings;

const pretty_names = {
    'decreasedisplaybrightness': 'Decrease display brightness',
    'increasedisplaybrightness': 'Increase display brightness'
}

function append_hotkey(model, settings, name, pretty_name) {
    let [key, mods] = Gtk.accelerator_parse(settings.get_strv(name)[0]);

    let row = model.insert(10);

    model.set(row, [0, 1, 2, 3], [name, pretty_name,
        mods, key ]);
}

function init() {
    Convenience.initTranslations();
    settings = Convenience.getSettings();

    boolSettings = {
        persist: {
            label: _("Persist across reboots"),
            help: _("Remember or forget the brightness level across reboots."
                + " Even if you enable this, you might have to click the icon"
                + " before rebooting in order to have the level saved!")
        },
        showicon: {
            label: _("Show top bar icon"),
            help: _("Show or hide the extension icon in the top bar")
        }
    };
/*
    stringSettings = {
        step: {
            label: _("Brightness adjustment step (hover-scroll) [% points]"),
            help: _("Brightness percentage points adjustment step when hover-scrolling")
        },
        level: {
            label: _("The current brightness level"),
            help: _("The current brightness level")
    };
        }*/
}

function buildPrefsWidget() {
    let frame = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        border_width: 10
    });
    let vbox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin: 20,
        margin_top: 10
    });

    for (setting in boolSettings) {
        let hbox = _createBoolSetting(setting);
        vbox.add(hbox);
    }
    //    for (setting in stringSettings) {
    //        let hbox = createStringSetting(setting);
    //        vbox.add(hbox);
    //    }

    //frame.add(vbox);
    //frame.show_all();
    //return frame;


    let model = new Gtk.ListStore();

    model.set_column_types([
        GObject.TYPE_STRING,
        GObject.TYPE_STRING,
        GObject.TYPE_INT,
        GObject.TYPE_INT
        ]);

    for(key in pretty_names) {
        append_hotkey(model, settings, key, _(pretty_names[key]));
    }

    let treeview = new Gtk.TreeView({
        'expand': true,
        'model': model
    });

    let col;
    let cellrend;

    cellrend = new Gtk.CellRendererText();

    col = new Gtk.TreeViewColumn({
        'title': 'Keybindings',
        'expand': true
    });

    col.pack_start(cellrend, true);
    col.add_attribute(cellrend, 'text', 1);


    treeview.append_column(col);


    cellrend = new Gtk.CellRendererAccel({
        'editable': true,
        'accel-mode': Gtk.CellRendererAccelMode.GTK
    });

    cellrend.connect('accel-edited', function(rend, iter, key, mods) {
        let value = Gtk.accelerator_name(key, mods);

        let [succ, iter ] = model.get_iter_from_string(iter);

        if(!succ) {
            throw new Error("Something is broken!");
        }

        let name = model.get_value(iter, 0);

        model.set(iter, [ 2, 3 ], [ mods, key ]);


        settings.set_strv(name, [value]);
    });

    col = new Gtk.TreeViewColumn({
        'title': 'Accel'
    });

    col.pack_end(cellrend, false);
    col.add_attribute(cellrend, 'accel-mods', 2);
    col.add_attribute(cellrend, 'accel-key', 3);

    treeview.append_column(col);


    let win = new Gtk.ScrolledWindow({
        'vexpand': true
    });

    //win.add_with_viewport(frame);
    //win.add(treeview);
    //win.show_all();
    //return win;

    frame.add(vbox);
    frame.add(treeview);
    frame.show_all();
    return frame;
}


function _createBoolSetting(setting) {
    let hbox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL
    });

    let settingLabel = new Gtk.Label({
        label: boolSettings[setting].label,
        xalign: 0
    });

    let settingSwitch = new Gtk.Switch({
        active: settings.get_boolean(setting)
    });
    settingSwitch.connect("notify::active", function(button) {
        settings.set_boolean(setting, button.active);
    });

    if (boolSettings[setting].help) {
        settingLabel.set_tooltip_text(boolSettings[setting].help);
        settingSwitch.set_tooltip_text(boolSettings[setting].help);
    }

    hbox.pack_start(settingLabel, true, true, 0);
    hbox.add(settingSwitch);

    return hbox;
}

function createStringSetting(setting) {
    let hbox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        margin_top: 5
    });

    let setting_label = new Gtk.Label({
        label: stringSettings[setting].label,
        xalign: 0
    });

    let setting_string = new Gtk.Entry({
        text: settings.get_string(setting.replace("_", "-"))
    });
    setting_string.connect("notify::text", function(entry) {
        settings.set_string(setting.replace("_", "-"), entry.text);
    });

    if (stringSettings[setting].mode == "passwd") {
        setting_string.set_visibility(false);
    }

    if (stringSettings[setting].help) {
        setting_label.set_tooltip_text(stringSettings[setting].help)
        setting_string.set_tooltip_text(stringSettings[setting].help)
    }

    hbox.pack_start(setting_label, true, true, 0);
    hbox.add(setting_string);

    return hbox;
}
