/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function test() {
  is(getBrowser().tabs.length, 1, "one tab is open initially");

  // Add several new tabs in sequence, interrupted by selecting a
  // different tab, moving a tab around and closing a tab,
  // returning a list of opened tabs for verifying the expected order.
  // The new tab behaviour is documented in bug 465673
  let tabs = [];
  function addTab(aURL, aReferrer) {
    tabs.push(getBrowser().addTab(aURL, {referrerURI: aReferrer}));
  }

  addTab("http://mochi.test:8888/#0");
  getBrowser().selectedTab = tabs[0];
  addTab("http://mochi.test:8888/#1");
  addTab("http://mochi.test:8888/#2", getBrowser().currentURI);
  addTab("http://mochi.test:8888/#3", getBrowser().currentURI);
  getBrowser().selectedTab = tabs[tabs.length - 1];
  getBrowser().selectedTab = tabs[0];
  addTab("http://mochi.test:8888/#4", getBrowser().currentURI);
  getBrowser().selectedTab = tabs[3];
  addTab("http://mochi.test:8888/#5", getBrowser().currentURI);
  getBrowser().removeTab(tabs.pop());
  addTab("about:blank", getBrowser().currentURI);
  getBrowser().moveTabTo(getBrowser().selectedTab, 1);
  addTab("http://mochi.test:8888/#6", getBrowser().currentURI);
  addTab();
  addTab("http://mochi.test:8888/#7");

  function testPosition(tabNum, expectedPosition, msg) {
    is(Array.indexOf(getBrowser().tabs, tabs[tabNum]), expectedPosition, msg);
  }

  testPosition(0, 3, "tab without referrer was opened to the far right");
  testPosition(1, 7, "tab without referrer was opened to the far right");
  testPosition(2, 5, "tab with referrer opened immediately to the right");
  testPosition(3, 1, "next tab with referrer opened further to the right");
  testPosition(4, 4, "tab selection changed, tab opens immediately to the right");
  testPosition(5, 6, "blank tab with referrer opens to the right of 3rd original tab where removed tab was");
  testPosition(6, 2, "tab has moved, new tab opens immediately to the right");
  testPosition(7, 8, "blank tab without referrer opens at the end");
  testPosition(8, 9, "tab without referrer opens at the end");

  tabs.forEach(getBrowser().removeTab, getBrowser());
}
