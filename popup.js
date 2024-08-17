import { fetchNotionDatabase } from './notion-api.js';

let balance = 0;
let lastCheckIn = null;
let currentUsername = '';

document.addEventListener('DOMContentLoaded', function () {
  loadUserData();
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById('checkInButton').addEventListener('click', checkIn);
  document.getElementById('sendMoneyButton').addEventListener('click', sendMoney);
  document.getElementById('fetchNotionDataButton').addEventListener('click', loadNotionData);
}

function loadUserData() {
  chrome.storage.sync.get(['balance', 'lastCheckIn', 'currentUser'], function (result) {
    balance = result.balance || 0;
    lastCheckIn = result.lastCheckIn || null;
    currentUsername = result.currentUser || '';
    if (!currentUsername) {
      promptForUsername();
    } else {
      updateUI();
    }
  });
}

function promptForUsername() {
  const username = prompt("Please enter your username:");
  if (username) {
    currentUsername = username;
    chrome.storage.sync.set({ currentUser: username }, function () {
      updateUI();
    });
  }
}

function updateUI() {
  document.getElementById('balance').textContent = balance.toFixed(2);
  document.getElementById('username').textContent = currentUsername || 'Not set';
}

function checkIn() {
  chrome.runtime.sendMessage({ action: "checkIn" }, function (response) {
    if (response.success) {
      balance = response.newBalance;
      updateUI();
      alert('Check-in successful! You received $1');
    } else {
      alert(response.message || 'Check-in failed');
    }
  });
}

function sendMoney() {
  const amount = parseFloat(document.getElementById('amount').value);
  const recipientUsername = document.getElementById('recipient').value;

  if (!amount || !recipientUsername) {
    alert('Please enter an amount and recipient username');
    return;
  }

  chrome.runtime.sendMessage(
    {
      action: 'sendMoney',
      amount: amount,
      recipientUsername: recipientUsername,
      senderUsername: currentUsername
    },
    function (response) {
      if (response.success) {
        balance = response.newBalance;
        updateUI();
        alert(`Successfully sent $${amount} to ${recipientUsername}`);
      } else {
        alert(response.message || 'Failed to send money');
      }
    }
  );
}

async function loadNotionData() {
  try {
    const data = await fetchNotionDatabase();
    displayNotionData(data);
  } catch (error) {
    console.error('Error fetching Notion data:', error);
    document.getElementById('notionData').textContent = 'Failed to load Notion data';
  }
}

function displayNotionData(data) {
  const notionDataElement = document.getElementById('notionData');
  notionDataElement.innerHTML = '';

  if (data.results && data.results.length > 0) {
    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';

    // Create table header
    const headerRow = table.insertRow();
    Object.keys(data.results[0].properties).forEach(key => {
      const th = document.createElement('th');
      th.textContent = key;
      th.style.border = '1px solid black';
      th.style.padding = '5px';
      headerRow.appendChild(th);
    });

    // Create table rows
    data.results.forEach(item => {
      const row = table.insertRow();
      Object.values(item.properties).forEach(property => {
        const cell = row.insertCell();
        cell.textContent = JSON.stringify(property);
        cell.style.border = '1px solid black';
        cell.style.padding = '5px';
      });
    });

    notionDataElement.appendChild(table);
  } else {
    notionDataElement.textContent = 'No data found in the Notion database.';
  }
}