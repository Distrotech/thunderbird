# -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 4 -*-
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

var gAdvancedPane = {
  mPane: null,
  mInitialized: false,
  mShellServiceWorking: false,

  init: function ()
  {
    this.mPane = document.getElementById("paneAdvanced");
    this.updateMarkAsReadOptions(document.getElementById("automaticallyMarkAsRead").checked);
    this.updateCompactOptions();

    if (!(("arguments" in window) && window.arguments[1]))
    {
      // If no tab was specified, select the last used tab.
      let preference = document.getElementById("mail.preferences.advanced.selectedTabIndex");
      if (preference.value)
        document.getElementById("advancedPrefs").selectedIndex = preference.value;
    }
#ifdef MOZ_UPDATER
	this.updateReadPrefs();
#endif

    // Search integration -- check whether we should hide or disable integration
    let hideSearchUI = false;
    let disableSearchUI = false;
    Components.utils.import("resource:///modules/SearchIntegration.js");
    if (SearchIntegration)
    {
      if (SearchIntegration.osVersionTooLow)
        hideSearchUI = true;
      else if (SearchIntegration.osComponentsNotRunning)
        disableSearchUI = true;
    }
    else
    {
      hideSearchUI = true;
    }

    if (hideSearchUI)
    {
      document.getElementById("searchIntegrationContainer").hidden = true;
    }
    else if (disableSearchUI)
    {
      let searchCheckbox = document.getElementById("searchIntegration");
      searchCheckbox.checked = false;
      document.getElementById("searchintegration.enable").disabled = true;
    }

#ifdef HAVE_SHELL_SERVICE
    // If the shell service is not working, disable the "Check now" button
    // and "perform check at startup" checkbox.
    try {
      let shellSvc = Components.classes["@mozilla.org/mail/shell-service;1"]
                               .getService(Components.interfaces.nsIShellService);
      this.mShellServiceWorking = true;
    } catch (ex) {
      document.getElementById("alwaysCheckDefault").disabled = true;
      document.getElementById("alwaysCheckDefault").checked = false;
      document.getElementById("checkDefaultButton").disabled = true;
      this.mShellServiceWorking = false;
    }
#endif

    this.mInitialized = true;
  },

  tabSelectionChanged: function ()
  {
    if (this.mInitialized)
    {
      document.getElementById("mail.preferences.advanced.selectedTabIndex")
              .valueFromPreferences = document.getElementById("advancedPrefs").selectedIndex;
    }
  },

#ifdef HAVE_SHELL_SERVICE
  /**
   * Checks whether Thunderbird is currently registered with the operating
   * system as the default app for mail, rss and news.  If Thunderbird is not
   * currently the default app, the user is given the option of making it the
   * default for each type; otherwise, the user is informed that Thunderbird is
   * already the default.
   */
  checkDefaultNow: function (aAppType)
  {
    if (!this.mShellServiceWorking)
      return;

    // otherwise, bring up the default client dialog
    window.openDialog("chrome://messenger/content/systemIntegrationDialog.xul",
                      "SystemIntegration",
                      "modal,centerscreen,chrome,resizable=no", "calledFromPrefs");
  },
#endif

  showConfigEdit: function()
  {
    document.documentElement.openWindow("Preferences:ConfigManager",
                                        "chrome://global/content/config.xul",
                                        "", null);
  },

  /**
   * When the user toggles telemetry, update the rejected value as well, so we
   * know he expressed a choice, and don't re-prompt inadvertently.
   */
  telemetryEnabledChanged: function (event)
  {
    let rejected = document.getElementById("toolkit.telemetry.rejected");
    rejected.value = !event.target.value;
    let displayed = document.getElementById("toolkit.telemetry.prompted");
    displayed.value = 2;
  },

  // NETWORK TAB

  /*
   * Preferences:
   *
   * browser.cache.disk.capacity
   * - the size of the browser cache in KB
   */

  /**
   * Converts the cache size from units of KB to units of MB and returns that
   * value.
   */
  readCacheSize: function ()
  {
    var preference = document.getElementById("browser.cache.disk.capacity");
    return preference.value / 1024;
  },

  /**
   * Converts the cache size as specified in UI (in MB) to KB and returns that
   * value.
   */
  writeCacheSize: function ()
  {
    var cacheSize = document.getElementById("cacheSize");
    var intValue = parseInt(cacheSize.value, 10);
    return isNaN(intValue) ? 0 : intValue * 1024;
  },

  /**
   * Clears the cache.
   */
  clearCache: function ()
  {
    try {
      Services.cache.evictEntries(Components.interfaces.nsICache.STORE_ANYWHERE);
    } catch(ex) {}
  },

  updateButtons: function (aButtonID, aPreferenceID)
  {
    var button = document.getElementById(aButtonID);
    var preference = document.getElementById(aPreferenceID);
    // This is actually before the value changes, so the value is not as you expect. 
    button.disabled = preference.value == true;
    return undefined;
  },  
  
#ifdef MOZ_UPDATER
/**
 * Selects the item of the radiogroup, and sets the warnIncompatible checkbox
 * based on the pref values and locked states.
 *
 * UI state matrix for update preference conditions
 * 
 * UI Components:                              Preferences
 * Radiogroup                                  i   = app.update.enabled
 * Warn before disabling extensions checkbox   ii  = app.update.auto
 *                                             iii = app.update.mode
 *
 * Disabled states:
 * Element           pref  value  locked  disabled
 * radiogroup        i     t/f    f       false
 *                   i     t/f    *t*     *true*
 *                   ii    t/f    f       false
 *                   ii    t/f    *t*     *true*
 *                   iii   0/1/2  t/f     false
 * warnIncompatible  i     t      f       false
 *                   i     t      *t*     *true*
 *                   i     *f*    t/f     *true*
 *                   ii    t      f       false
 *                   ii    t      *t*     *true*
 *                   ii    *f*    t/f     *true*
 *                   iii   0/1/2  f       false
 *                   iii   0/1/2  *t*     *true*
 */
updateReadPrefs: function ()
{
  var enabledPref = document.getElementById("app.update.enabled");
  var autoPref = document.getElementById("app.update.auto");
  var radiogroup = document.getElementById("updateRadioGroup");
  
  if (!enabledPref.value)   // Don't care for autoPref.value in this case.
    radiogroup.value="manual"     // 3. Never check for updates.
  else if (autoPref.value)  // enabledPref.value && autoPref.value
    radiogroup.value="auto";      // 1. Automatically install updates
  else                      // enabledPref.value && !autoPref.value
    radiogroup.value="checkOnly"; // 2. Check, but let me choose

  var canCheck = Components.classes["@mozilla.org/updates/update-service;1"].
                   getService(Components.interfaces.nsIApplicationUpdateService).
                   canCheckForUpdates;

  // canCheck is false if the enabledPref is false and locked,
  // or the binary platform or OS version is not known.
  // A locked pref is sufficient to disable the radiogroup.
  radiogroup.disabled = !canCheck || enabledPref.locked || autoPref.locked;
  
  var modePref = document.getElementById("app.update.mode");
  var warnIncompatible = document.getElementById("warnIncompatible");

  // the warnIncompatible checkbox value is set by readAddonWarn
  warnIncompatible.disabled = radiogroup.disabled || modePref.locked ||
                              !enabledPref.value || !autoPref.value;
  
#ifdef MOZ_MAINTENANCE_SERVICE
  // Check to see if the maintenance service is installed.
  // If it is don't show the preference at all.
  var installed;
  try {
    let wrk = Components.classes["@mozilla.org/windows-registry-key;1"]
              .createInstance(Components.interfaces.nsIWindowsRegKey);
    wrk.open(wrk.ROOT_KEY_LOCAL_MACHINE,
             "SOFTWARE\\Mozilla\\MaintenanceService",
             wrk.ACCESS_READ | wrk.WOW64_64);
    installed = wrk.readIntValue("Installed");
    wrk.close();
  } catch(e) {
  }
  if (installed != 1) {
    document.getElementById("useService").hidden = true;
  }
#endif
},

/**
 * Sets the pref values based on the selected item of the radiogroup,
 * and sets the disabled state of the warnIncompatible checkbox accordingly.
 */
updateWritePrefs: function ()
{
  var enabledPref = document.getElementById("app.update.enabled");
  var autoPref = document.getElementById("app.update.auto");
  var radiogroup = document.getElementById("updateRadioGroup");
  switch (radiogroup.value) {
    case "auto":      // 1. Automatically install updates
      enabledPref.value = true;
      autoPref.value = true;
      break;
    case "checkOnly": // 2. Check, but but let me choose
      enabledPref.value = true;
      autoPref.value = false;
      break;
    case "manual":    // 3. Never check for updates.
      enabledPref.value = false;
      autoPref.value = false;
  }

  var warnIncompatible = document.getElementById("warnIncompatible");
  var modePref = document.getElementById("app.update.mode");
  warnIncompatible.disabled = enabledPref.locked || !enabledPref.value ||
                              autoPref.locked || !autoPref.value ||
                              modePref.locked;
},

  /**
   * app.update.mode is a three state integer preference, and we have to 
   * express all three values in a single checkbox:
   * "Warn me if this will disable extensions or themes"
   * Preference Value         Checkbox State    Meaning
   * 0                        Unchecked         Do not warn
   * 1                        Checked           Warn if there are incompatibilities
   * 2                        Checked           Warn if there are incompatibilities,
   *                                            or the update is major.
   */
  _modePreference: -1,
  addonWarnSyncFrom: function ()
  {
    var preference = document.getElementById("app.update.mode");
    var warn = preference.value != 0;
    gAdvancedPane._modePreference = warn ? preference.value : 1;
    return warn;
  },

  addonWarnSyncTo: function ()
  {
    var warnIncompatible = document.getElementById("warnIncompatible");
    return !warnIncompatible.checked ? 0 : gAdvancedPane._modePreference;
  },

  showUpdates: function ()
  {
    var prompter = Components.classes["@mozilla.org/updates/update-prompt;1"]
                             .createInstance(Components.interfaces.nsIUpdatePrompt);
    prompter.showUpdateHistory(window);
  },
#endif

  /**
   * Enable/disable the options of automatic marking as read depending on the
   * state of the automatic marking feature.
   *
   * @param aEnableRadioGroup  Boolean value indicating whether the feature is enabled.
   */
  updateMarkAsReadOptions: function(aEnableRadioGroup)
  {
    let autoMarkAsPref = document.getElementById("mailnews.mark_message_read.delay");
    let autoMarkDisabled = !aEnableRadioGroup || autoMarkAsPref.locked;
    document.getElementById("markAsReadAutoPreferences").disabled = autoMarkDisabled;
    document.getElementById("secondsLabel").disabled = autoMarkDisabled;
    this.updateMarkAsReadTextbox();
  },

  /**
   * Automatically enable/disable delay textbox depending on state of the
   * Mark As Read On Delay feature.
   *
   * @param aFocusTextBox  Boolean value whether Mark As Read On Delay
   *                       option was selected and the textbox should be focused.
   */
  updateMarkAsReadTextbox: function(aFocusTextBox)
  {
    let globalCheckbox = document.getElementById("automaticallyMarkAsRead");
    let delayRadioOption = document.getElementById("markAsReadAfterDelay");
    let delayTextbox = document.getElementById("markAsReadDelay");
    let intervalPref = document.getElementById("mailnews.mark_message_read.delay.interval");
    delayTextbox.disabled = !globalCheckbox.checked ||
                            !delayRadioOption.selected || intervalPref.locked;
    if (!delayTextbox.disabled && aFocusTextBox)
      delayTextbox.focus();
  },

  updateCompactOptions: function(aCompactEnabled)
  {
    document.getElementById("offlineCompactFolderMin").disabled =
      !document.getElementById("offlineCompactFolder").checked ||
      document.getElementById("mail.purge_threshhold_mb").locked;
  },

  /**
   * Display the return receipts configuration dialog.
   */
  showReturnReceipts: function()
  {
    document.documentElement.openSubDialog("chrome://messenger/content/preferences/receipts.xul",
                                           "", null);
  },  

  /** 
   * Display the the connection settings dialog.
   */
  showConnections: function ()
  {
    document.documentElement
            .openSubDialog("chrome://messenger/content/preferences/connection.xul",
                           "", null);
  },

  /**
   * Display the the offline settings dialog.
   */
  showOffline: function()
  {
    document.documentElement
            .openSubDialog("chrome://messenger/content/preferences/offline.xul",
                           "", null);  
  },

  /**
   * Display the user's certificates and associated options.
   */
  showCertificates: function ()
  {
    document.documentElement.openWindow("mozilla:certmanager",
                                        "chrome://pippki/content/certManager.xul",
                                        "", null);
  },

  /**
   * Display a dialog in which OCSP preferences can be configured.
   */
  showOCSP: function ()
  {
    document.documentElement.openSubDialog("chrome://mozapps/content/preferences/ocsp.xul",
                                           "", null);
  },

  /**
   * Display a dialog from which the user can manage his security devices.
   */
  showSecurityDevices: function ()
  {
    document.documentElement.openWindow("mozilla:devicemanager",
                                        "chrome://pippki/content/device_manager.xul",
                                        "", null);
  }
};