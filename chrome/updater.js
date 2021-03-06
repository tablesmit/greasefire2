var URL = "http://skrul.com/projects/greasefire/indexes/";

var TIME_CHECK_INTERVAL = 60 * 1000;
var DAYS_TO_MILLISECONDS = 24 * 60 * 60 * 1000;

function Updater(store) {
  function setIf(key, value) {
    if (localStorage[key] === undefined) {
      localStorage[key] = value;
    }
  }

  setIf("enable_scheduled_updates", true);
  setIf("update_interval_ms", DAYS_TO_MILLISECONDS);
  // Schedule our first update for 30 seconds from now.
  setIf("next_update_date", Date.now() + (1000 * 30));

  this.store_ = store;
  this.update_interval_ms_ = parseInt(localStorage["update_interval_ms"]);
  this.next_update_date_ =
    new Date(parseInt(localStorage["next_update_date"]));
  this.isUpdating_ = false;
  this.enable_scheduled_updates_ =
    localStorage["enable_scheduled_updates"] == "true";
  this.timer_id = null;
}

Updater.prototype = {
  reset: function() {
    delete localStorage["enable_scheduled_updates"];
    delete localStorage["update_interval_ms"];
    delete localStorage["next_update_date"];
  },

  startScheduledUpdates: function() {
    this.startTimer_();
  },

  enable_scheduled_updates: function() {
    return this.enable_scheduled_updates_;
  },

  set_enable_scheduled_updates: function(val) {
    this.enable_scheduled_updates_ = val;
    localStorage["enable_scheduled_updates"] = val;
  },

  next_update_date: function() {
    return this.next_update_date_;
  },

  notifyStart_: function() {
    chrome.extension.sendRequest({action: "updater-start"});
  },

  notifyDone_: function() {
    chrome.extension.sendRequest({action: "updater-done"});
  },

  notifyStatus_: function(message) {
    chrome.extension.sendRequest(
      {action: "updater-status", message: message});
  },

  update: wrap(function(force, callback) {
    if (this.isUpdating_) {
      callback(false, "Already updating");
      return;
    }

    var that = this;
    this.notifyStart_();

    var finish = function(success, error) {
      that.scheduleNextUpdate_();
      that.notifyDone_();
      callback(success, error);
    };

    this.getVersion_(URL + "latest", function(success, latest_version) {
      if (!success) {
        finish(false, "can't read version");
        return;
      }

      var current_version = that.store_.current_version();
      d("latest version " + latest_version);
      d("current version " + current_version);
      if (!force && current_version && latest_version <= current_version) {
        that.notifyStatus_("Index is up to date.");
        finish(true);
        return;
      }

      var base_url = URL + formatISO8601(latest_version);
      that.updateFromBaseUrl_(base_url, latest_version, function(success, error) {
        finish(success, error);
      });
    });
  }),

  updateWithLocalData: wrap(function(callback) {
    if (this.isUpdating_) {
      callback(false, "Already updating");
      return;
    }

    var that = this;
    this.getVersion_("indexes/latest", function(success, local_version) {
      if (!success) {
        callback(false, "can't read local version");
        return;
      }
      d("local version " + local_version);
      that.updateFromBaseUrl_("indexes", local_version, callback);
    });
  }),

  updateFromBaseUrl_: wrap(function(base_url, version, callback) {
    d("Updater.updateFromBaseUrl_ " + base_url + " " + version);

    var that = this;
    this.isUpdating_ = true;
    var finish = function(success, error) {
      that.isUpdating_ = false;
      callback(success, error);
    };

    var includes;
    var excludes;
    var scripts;

    var on_progress = function(loaded, total) {
      chrome.extension.sendRequest({
        action: "updater-status",
        message: "Downloading indexes (" + loaded + ")"});
    };

    var done_downloading = function(data, error) {
      if (data) {
        scripts = data;
        that.store_.installNewData(
          version, includes, excludes, scripts, function() {
            finish(true);
          });
      } else {
        finish(false, error);
      }
    };

    var includes_dl = new Downloader(on_progress);
    var excludes_dl = new Downloader(on_progress);
    var scripts_dl = new Downloader(on_progress);
    includes_dl.get(base_url + "/include.dat", function(data, status) {
      if (!data) {
        finish(false, status);
        return;
      }
      includes = fixEncoding(data);

      excludes_dl.get(base_url + "/exclude.dat", function(data, status) {
        if (!data) {
          finish(false, status);
          return;
        }
        excludes = fixEncoding(data);

        scripts_dl.get(base_url + "/scripts.txt", function(data, status) {
          if (!data) {
            finish(false, status);
            return;
          }
          scripts = data;

          that.store_.installNewData(
              version, includes, excludes, scripts, function() {
            finish(true);
          });
        });
      });
    });
  }),

  getVersion_: wrap(function(url, callback) {
    var downloader = new Downloader();
    downloader.get(url + "?" + Math.random(), function(data, error) {
      if (data) {
        var d = parseISO8601(data);
        if (d) {
          callback(true, d);
          return;
        }
      }
      callback(false, error);
    });
  }),

  startTimer_: function() {
    if (this.timer_id)
      return;
    var that = this;
    this.timer_id = window.setTimeout(function() {
      that.tick_();
    }, TIME_CHECK_INTERVAL);
  },

  tick_: function() {
    d("tick " + (new Date()));
    if (this.enable_scheduled_updates_ &&
        Date.now() >= this.next_update_date_) {
      var that = this;
      this.update(false, function(success, error) {
        if (!success) {
          d("Error doing scheduled update: " + error);
        }
        that.startTimer_();
      });
    } else {
      this.startTimer_();
    }
  },

  scheduleNextUpdate_: function() {
    this.next_update_date_ = new Date(Date.now() + this.update_interval_ms_);
    localStorage["next_update_date"] = this.next_update_date_.getTime();
  }
}
