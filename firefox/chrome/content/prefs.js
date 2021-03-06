/*
 * Copyright (C) 2008 by Steve Krulewitz <skrulx@gmail.com>
 * Licensed under GPLv2 or later, see file LICENSE in the xpi for details.
 */
const {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

function $(id) {
  return document.getElementById(id);
}

var PrefsController = {

  _gfs: Cc["@b0nk3rz.net/greasefire2/service;1"].getService().wrappedJSObject,
  _up: Cc["@b0nk3rz.net/greasefire2/updater;1"].getService().wrappedJSObject,
  filePicker: Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker),

  init: function PrefsController_init() {
    //$("days").value = this._up.updateIntervalMinutes / 1440; // (1440 = 24 * 60)
    $("us_mirror").value = this._up._prefs.getCharPref("us_mirror");
    $("notificationSound").value = this._up._prefs.getCharPref("notification_sound_path");
    $("useNotification").checked = (this._up._prefs.getCharPref("notification_sound_path") != "");
    if(this._up._prefs.getCharPref("notification_sound_path") == "") $('nsBrowser').setAttribute('disabled','true');
    //this._up.addListener(this);
    this._updateDisplay();
  },

  unload: function () {
    this._up.removeListener(this);
  },

  update: function() {
    if (this._up.isUpdating) {
      this._up.cancelUpdate();
    }
    else {
      this._up.startUpdate(false);
    }
  },

  updateInterval: function (aDays) {
    var d = parseInt(aDays);
    if (!isNaN(d) && d >= 0) {
      this._up.updateIntervalMinutes = d * 1440; // (1440 = 24 * 60)
    }
    this._updateDisplay();
  },

  updateCheckbox: function (aChecked) {
    if (aChecked) {
      var d = $("days").value;
      if (d == 0) {
        d = 1;
        $("days").value = 1;
      }
      this.updateInterval(d);
    }
    else {
      this._up.updateIntervalMinutes = 0;
    }
    this._updateDisplay();
  },

  updateMirror: function (aMirror) {
    this._up._prefs.setCharPref("us_mirror", aMirror);
  },

  updateNotificationSoundCheckbox: function (aChecked){
    if(!aChecked){
      $('nsBrowser').setAttribute('disabled', 'true');
      $('notificationSound').value="";
      this._up._prefs.setCharPref('notification_sound_path', "");
    }else
      $('nsBrowser').removeAttribute('disabled');
  },

  updateNotificationSound: function (filePath){
      this._up._prefs.setCharPref('notification_sound_path', filePath);
  },

  getSoundFileBrowser: function (){
    var window = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator).getMostRecentWindow("navigator:browser");
    this.filePicker.init(window, "Select notification sound file..", Ci.nsIFilePicker.modeOpen);
    this.filePicker.appendFilters(Ci.nsIFilePicker.filterAudio); //filterAudio
    return this.filePicker;
  },

  onUpdateStarted: function () {
    $("status").value = "Connecting...";
    this._updateDisplay();
  },

  onUpdateFinished: function (aStatus, aMessage) {

    if (aStatus == Cr.NS_OK) {
      $("status").value = "Update complete!";
    }
    else if (aStatus == Cr.NS_BINDING_ABORTED) {
      $("status").value = "Update cancelled";
      $("progress").value = 0;
    }
    else if (aStatus == Cr.NS_ERROR_FILE_ALREADY_EXISTS) {
      $("status").value = "Already up to date.";
      $("progress").value = 0;
    }
    else {
      $("status").value = "Error updating: " + aMessage;
    }

    this._updateDisplay();
  },

  onDownloadProgress: function (aCurrentBytes, aTotalBytes) {
    $("progress").value = (aCurrentBytes / aTotalBytes) * 100;

    if (aCurrentBytes == aTotalBytes) {
      $("status").value = "Extracting new index...";
    }
    else {
      $("status").value = "Downloading " + aCurrentBytes + " of " + aTotalBytes + " bytes";
    }
  },

  _updateDisplay: function() (this._gfs.getIndexDate((function(aDate) {
    $("index-date").value = (new Date(aDate)).toLocaleString();
    $("script-count").value = this._gfs.scriptCount;

    if (this._up.updateIntervalMinutes > 0) {
      $("next-update").value = (new Date(this._up.nextUpdateDate)).toLocaleString();
      $("auto").checked = true;
    }
    else {
      $("next-update").value = "n/a";
      $("auto").checked = false;
    }

    if (this._up.isUpdating) {
      $("update-button").label = "Cancel update";
      $("progress-box").hidden = false;
      $("throbber").hidden = false;
    }
    else {
      $("update-button").label = "Update now";
      $("throbber").hidden = true;
    }
  }).bind(this))),

  QueryInterface: XPCOMUtils.generateQI([
      Ci.nsISupports, Ci.nsIDOMEventListener])

}
