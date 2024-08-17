// Listen for messages from the extension's background script
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "getPageInfo") {
    // Get information from the current page
    let pageInfo = {
      title: document.title,
      url: window.location.href
    };
    sendResponse(pageInfo);
  }
});

// Function to insert the Money Board widget into the page
function insertMoneyBoardWidget() {
  let widget = document.createElement('div');
  widget.id = 'money-board-widget';
  widget.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #f0f0f0;
    border: 1px solid #ccc;
    padding: 10px;
    border-radius: 5px;
    z-index: 9999;
  `;
  widget.innerHTML = `
    <h3>Money Board</h3>
    <p>Username: <span id="mb-username">Loading...</span></p>
    <p>Balance: $<span id="mb-balance">Loading...</span></p>
    <button id="mb-check-in">Daily Check-in</button>
  `;
  document.body.appendChild(widget);

  // Add event listener to the check-in button
  document.getElementById('mb-check-in').addEventListener('click', function () {
    chrome.runtime.sendMessage({ action: "checkIn" }, function (response) {
      if (response.success) {
        updateBalance(response.newBalance);
        alert('Check-in successful! You received $1');
      } else {
        alert(response.message || 'Check-in failed');
      }
    });
  });

  // Load and display user data
  loadUserData();
}

function loadUserData() {
  chrome.runtime.sendMessage({ action: "getUserData" }, function (response) {
    if (response.success) {
      updateUsername(response.username);
      updateBalance(response.balance);
    } else {
      updateUsername('Not logged in');
      updateBalance(0);
    }
  });
}

function updateUsername(username) {
  document.getElementById('mb-username').textContent = username;
}

function updateBalance(balance) {
  document.getElementById('mb-balance').textContent = balance.toFixed(2);
}

// Insert the widget when the content script runs
insertMoneyBoardWidget();

// Listen for messages from the extension's background script to update the balance
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "updateBalance") {
    updateBalance(request.balance);
  }
  sendResponse({ received: true });
});

// Update the balance periodically
function updateBalance() {
  chrome.runtime.sendMessage({ action: "getBalance" }, function (response) {
    if (response.balance !== undefined) {
      document.getElementById('mb-balance').textContent = response.balance.toFixed(2);
    }
  });
}

// Update balance every 30 seconds
setInterval(updateBalance, 30000);

// You can add more functionality here, such as highlighting prices on the page
// or providing context menu options for quick money transfers

function updateWidget(username, balance) {
  document.getElementById('mb-username').textContent = username || 'Not set';
  document.getElementById('mb-balance').textContent = balance.toFixed(2);
}

// Call this function after inserting the widget and whenever you receive updated data
chrome.runtime.sendMessage({ action: "getUserData" }, function (response) {
  if (response.success) {
    updateWidget(response.username, response.balance);
  }
});