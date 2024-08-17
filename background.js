// Initialize user data when the extension is installed
chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.sync.set({
    balance: 0,
    lastCheckIn: null
  }, function () {
    console.log("Initial user data set");
  });
});

// Set up daily alarm to reset check-in status
if (chrome.alarms) {
  chrome.alarms.create("dailyReset", {
    periodInMinutes: 1440 // 24 hours
  });
}

// Listen for the daily alarm
if (chrome.alarms) {
  chrome.alarms.onAlarm.addListener(function (alarm) {
    if (alarm.name === "dailyReset") {
      resetDailyCheckIn();
    }
  });
}

// Function to reset daily check-in status
function resetDailyCheckIn() {
  chrome.storage.sync.set({ lastCheckIn: null }, function () {
    console.log("Daily check-in status reset");
  });
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "checkIn") {
    handleCheckIn(sendResponse);
    return true; // Indicates we will respond asynchronously
  } else if (request.action === "sendMoney") {
    handleSendMoney(request.amount, request.recipientUsername, request.senderUsername, sendResponse);
    return true; // Indicates we will respond asynchronously
  } else if (request.action === "fetchNotionDatabase") {
    fetchNotionDatabase(request.databaseId, sendResponse);
    return true; // Keep the message channel open for asynchronous response
  }
});

// Handle check-in logic
function handleCheckIn(sendResponse) {
  chrome.storage.sync.get(['balance', 'lastCheckIn'], function (data) {
    const today = new Date().toDateString();
    if (data.lastCheckIn !== today) {
      const newBalance = data.balance + 1;
      chrome.storage.sync.set({
        balance: newBalance,
        lastCheckIn: today
      }, function () {
        sendResponse({ success: true, newBalance: newBalance });
      });
    } else {
      sendResponse({ success: false, message: "Already checked in today" });
    }
  });
}

function handleSendMoney(amount, recipientUsername, senderUsername, sendResponse) {
  chrome.storage.sync.get(['users', 'transactions'], function (data) {
    let users = data.users || {};
    let transactions = data.transactions || [];

    // Error checking
    if (!users[senderUsername]) {
      sendResponse({ success: false, message: "Sender account not found" });
      return;
    }
    if (!users[recipientUsername]) {
      sendResponse({ success: false, message: "Recipient account not found" });
      return;
    }
    if (users[senderUsername].balance < amount) {
      sendResponse({ success: false, message: "Insufficient funds" });
      return;
    }
    if (amount <= 0) {
      sendResponse({ success: false, message: "Invalid amount" });
      return;
    }

    // Perform the transfer
    users[senderUsername].balance -= amount;
    users[recipientUsername].balance += amount;

    // Log the transaction
    const transaction = {
      id: Date.now(),
      date: new Date().toISOString(),
      sender: senderUsername,
      recipient: recipientUsername,
      amount: amount
    };
    transactions.push(transaction);

    // Save the updated data
    chrome.storage.sync.set({ users: users, transactions: transactions }, function () {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        sendResponse({ success: false, message: "Error saving transaction" });
      } else {
        sendResponse({
          success: true,
          newBalance: users[senderUsername].balance,
          transaction: transaction
        });
      }
    });
  });
}

import { NOTION_API_KEY } from './apiKey.js';

function fetchNotionDatabase(databaseId, sendResponse) {
  fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2021-08-16',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  })
  .then(response => response.json())
  .then(data => {
    sendResponse({ data: data });
  })
  .catch(error => {
    sendResponse({ error: error.message });
  });
}