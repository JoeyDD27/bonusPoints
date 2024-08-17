let balance = 0;
let lastCheckIn = null;
let currentUsername = '';

document.addEventListener('DOMContentLoaded', function () {
  loadUserData();
  document.getElementById('checkInButton').addEventListener('click', checkIn);
  document.getElementById('sendMoneyButton').addEventListener('click', sendMoney);
  document.getElementById('readNotionButton').addEventListener('click', readNotionData);
});

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

function readNotionData() {
  chrome.runtime.sendMessage({ action: "readNotion" }, function (response) {
    if (response.success) {
      alert('Notion data read successfully: ' + JSON.stringify(response.data));
    } else {
      alert('Failed to read Notion data: ' + response.message);
    }
  });
}