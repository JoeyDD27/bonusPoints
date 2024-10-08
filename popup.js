document.addEventListener("DOMContentLoaded", () => {
  const loginButton = document.getElementById("loginButton");
  const registerButton = document.getElementById("registerButton");
  const goToRegisterButton = document.getElementById("goToRegisterButton");
  const backToLoginButton = document.getElementById("backToLoginButton");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const regUsernameInput = document.getElementById("regUsername");
  const regPasswordInput = document.getElementById("regPassword");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const pageContentDiv = document.getElementById("pageContent");
  const togglePasswordButton = document.getElementById("togglePassword");
  const toggleRegPasswordButton = document.getElementById("toggleRegPassword");
  const balanceRankingDiv = document.getElementById("balanceRanking");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const nicknameForm = document.getElementById("nicknameForm");
  const newNicknameInput = document.getElementById("newNickname");
  const changeNicknameButton = document.getElementById("changeNicknameButton");
  const transferForm = document.getElementById("transferForm");
  const transferUsernameInput = document.getElementById("transferUsername");
  const transferAmountInput = document.getElementById("transferAmount");
  const transferButton = document.getElementById("transferButton");

  console.log("DOMContentLoaded event fired");

  // Set version number
  fetch('manifest.json')
    .then(response => response.json())
    .then(data => {
      document.getElementById('version').textContent = 'v' + data.version;
    });

  showBalanceRanking();

  function loginUser(username, password) {
    chrome.runtime.sendMessage({ action: "loginUser", username: username, password: password }, response => {
      console.log("Response received:", response);
      if (response.success) {
        loginForm.style.display = 'none';
        let welcomeMessage = `
          <div id="welcomeMessage">
            <h2>Welcome, ${response.nickname}!</h2>
            <p>Your balance: ${response.balance} | Rank: ${response.rank}</p>
            ${response.checkedIn ? `<p>You've checked in today! +1 added to your balance.</p>` : ''}
          </div>
        `;
        pageContentDiv.innerHTML = welcomeMessage;
        usernameInput.value = "";
        passwordInput.value = "";
        nicknameForm.style.display = 'block';
        transferForm.style.display = 'block';
        showBalanceRanking(response.uid);
        currentUserUid = response.uid;
        currentUserNickname = response.nickname; // Set the current user's nickname
      } else {
        console.error(`Error logging in user:`, response.error);
        pageContentDiv.textContent = response.error;
      }
      enableButtons();
      hideLoading();
    });
  }

  togglePasswordButton.addEventListener("click", () => {
    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      togglePasswordButton.textContent = "Hide Password";
    } else {
      passwordInput.type = "password";
      togglePasswordButton.textContent = "Show Password";
    }
  });

  toggleRegPasswordButton.addEventListener("click", () => {
    if (regPasswordInput.type === "password") {
      regPasswordInput.type = "text";
      confirmPasswordInput.type = "text";
      toggleRegPasswordButton.textContent = "Hide Password";
    } else {
      regPasswordInput.type = "password";
      confirmPasswordInput.type = "password";
      toggleRegPasswordButton.textContent = "Show Password";
    }
  });

  goToRegisterButton.addEventListener("click", animateRegisterForm);

  backToLoginButton.addEventListener("click", animateLoginForm);

  function validateInput(input, maxLength) {
    const alphanumericRegex = /^[a-zA-Z0-9]+$/;
    return input.length >= 3 && input.length <= maxLength && alphanumericRegex.test(input);
  }

  registerButton.addEventListener("click", () => {
    const username = regUsernameInput.value;
    const password = regPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const invitationCode = document.getElementById("invitationCode").value;

    if (validateInput(username, 20) && validateInput(password, 20) && invitationCode) {
      if (password !== confirmPassword) {
        pageContentDiv.textContent = "Passwords do not match";
        return;
      }

      // Disable buttons and show loading indicator
      disableButtons();
      showLoading();

      chrome.runtime.sendMessage({ action: "checkUsername", username: username }, response => {
        if (response.exists) {
          pageContentDiv.textContent = "Username already exists";
          enableButtons();
          hideLoading();
        } else {
          chrome.runtime.sendMessage({
            action: "checkInvitationCode",
            invitationCode: invitationCode
          }, invitationResponse => {
            if (invitationResponse.valid) {
              chrome.runtime.sendMessage({
                action: "registerUser",
                username: username,
                password: password,
                invitationCode: invitationCode
              }, response => {
                console.log("Response received:", response);
                if (response.success) {
                  pageContentDiv.textContent = "User registered successfully!";
                  usernameInput.value = username; // Fill in the login username input
                  passwordInput.value = ""; // Clear the password for security
                  regUsernameInput.value = "";
                  regPasswordInput.value = "";
                  confirmPasswordInput.value = "";
                  document.getElementById("invitationCode").value = "";
                  animateLoginForm(); // Switch to login form
                } else {
                  console.error(`Error registering user:`, response.error);
                  pageContentDiv.textContent = `Error registering user: ` + response.error;
                }
                enableButtons();
                hideLoading();
              });
            } else {
              pageContentDiv.textContent = "Invalid or already used invitation code";
              enableButtons();
              hideLoading();
            }
          });
        }
      });
    } else {
      pageContentDiv.textContent = "Username and password must be between 3 and 20 characters long, and contain only letters and numbers. Invitation code is required.";
    }
  });

  loginButton.addEventListener("click", () => {
    console.log("Login button clicked");
    const username = usernameInput.value;
    const password = passwordInput.value;

    if (validateInput(username, 20) && validateInput(password, 20)) {
      // Disable buttons and show loading indicator
      disableButtons();
      showLoading();

      chrome.runtime.sendMessage({ action: "loginUser", username: username, password: password }, response => {
        console.log("Response received:", response);
        if (response.success) {
          loginForm.style.display = 'none';
          let welcomeMessage = `
            <div id="welcomeMessage">
              <h2>Welcome, ${response.nickname}!</h2>
              <p>Your balance: ${response.balance} | Rank: ${response.rank}</p>
              ${response.checkedIn ? `<p>You've checked in today! +1 added to your balance.</p>` : ''}
            </div>
          `;
          pageContentDiv.innerHTML = welcomeMessage;
          usernameInput.value = "";
          passwordInput.value = "";
          showBalanceRanking(response.uid);
          nicknameForm.style.display = 'block';
          transferForm.style.display = 'block';
          currentUserUid = response.uid;
          currentUserNickname = response.nickname; // Set the current user's nickname
        } else {
          console.error(`Error logging in user:`, response.error);
          pageContentDiv.textContent = response.error;
        }
        enableButtons();
        hideLoading();
      });
    } else {
      pageContentDiv.textContent = "Username and password must be between 3 and 20 characters long, and contain only letters and numbers.";
    }
  });

  function showBalanceRanking(uid = null) {
    chrome.runtime.sendMessage({ action: "getAllUsersBalances", username: uid }, response => {
      if (response.success) {
        const balances = response.balances;
        balanceRankingDiv.innerHTML = "";

        const rankingTitle = document.createElement("h2");
        rankingTitle.textContent = "Balance Ranking (nickname)";
        balanceRankingDiv.appendChild(rankingTitle);

        const rankingList = document.createElement("div");

        let currentRank = 0;
        let previousBalance = null;

        balances.forEach((user, index) => {
          if (user.balance !== previousBalance) {
            currentRank = index + 1;
          }

          const listItem = document.createElement("div");
          listItem.textContent = `${currentRank}.${user.nickname}: ${user.balance}`;

          if (uid && user.uid === uid) {
            listItem.style.fontWeight = 'bold';
          }

          rankingList.appendChild(listItem);
          previousBalance = user.balance;
        });

        balanceRankingDiv.appendChild(rankingList);
        balanceRankingDiv.style.display = "block";
      } else {
        console.error("Error fetching balance ranking:", response.error);
      }
    });
  }

  function disableButtons() {
    loginButton.disabled = true;
    registerButton.disabled = true;
    goToRegisterButton.disabled = true;
    backToLoginButton.disabled = true;
  }

  function enableButtons() {
    loginButton.disabled = false;
    registerButton.disabled = false;
    goToRegisterButton.disabled = false;
    backToLoginButton.disabled = false;
  }

  function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loadingIndicator';
    loadingDiv.textContent = 'Loading...';
    document.body.appendChild(loadingDiv);
  }

  function hideLoading() {
    const loadingDiv = document.getElementById('loadingIndicator');
    if (loadingDiv) {
      loadingDiv.remove();
    }
  }

  function showElement(element) {
    element.style.display = 'block';
    setTimeout(() => {
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
    }, 10);
  }

  function hideElement(element) {
    element.style.opacity = '0';
    element.style.transform = 'translateY(-20px)';
    setTimeout(() => {
      element.style.display = 'none';
    }, 300);
  }

  function animateLoginForm() {
    hideElement(registerForm);
    showElement(loginForm);
  }

  function animateRegisterForm() {
    hideElement(loginForm);
    showElement(registerForm);
  }

  function updateWelcomeMessage(newBalance, newRank) {
    const welcomeMessageElement = document.querySelector("#welcomeMessage");
    if (welcomeMessageElement) {
      welcomeMessageElement.innerHTML = `
        <h2>Welcome, ${currentUserNickname}!</h2>
        <p>Your balance: ${newBalance} | Rank: ${newRank}</p>
      `;
    }
  }

  changeNicknameButton.addEventListener("click", () => {
    const newNickname = newNicknameInput.value;
    if (validateInput(newNickname, 20)) {
      disableButtons();
      showLoading();
      chrome.runtime.sendMessage({ action: "changeNickname", uid: currentUserUid, newNickname: newNickname }, response => {
        if (response.success) {
          const welcomeMessageElement = document.querySelector("#welcomeMessage h2");
          if (welcomeMessageElement) {
            welcomeMessageElement.textContent = `Welcome, ${newNickname}!`;
          } else {
            const welcomeMessage = `
              <div id="welcomeMessage">
                <h2>Welcome, ${newNickname}!</h2>
              </div>
            `;
            pageContentDiv.innerHTML = welcomeMessage + pageContentDiv.innerHTML;
          }
          newNicknameInput.value = "";
          pageContentDiv.insertAdjacentHTML('beforeend', "<p>Nickname changed successfully!</p>");
          showBalanceRanking(currentUserUid); // Refresh the balance ranking
        } else {
          pageContentDiv.textContent = `Error changing nickname: ${response.error}`;
        }
        enableButtons();
        hideLoading();
      });
    } else {
      pageContentDiv.textContent = "Nickname must be between 3 and 20 characters long";
    }
  });

  transferButton.addEventListener("click", () => {
    const recipientUsername = transferUsernameInput.value;
    const amount = parseInt(transferAmountInput.value, 10);

    if (recipientUsername && !isNaN(amount) && amount > 0) {
      // Check if the user is trying to transfer to themselves
      chrome.runtime.sendMessage({ action: "getCurrentUsername" }, response => {
        if (response.username === recipientUsername) {
          pageContentDiv.innerHTML += "<p>Error: You cannot transfer points to yourself.</p>";
          return;
        }

        disableButtons();
        showLoading();
        chrome.runtime.sendMessage({
          action: "transferPoints",
          senderUid: currentUserUid,
          recipientUsername: recipientUsername,
          amount: amount
        }, response => {
          if (response.success) {
            const newBalance = response.newBalance;
            pageContentDiv.innerHTML += `<p>Successfully transferred ${amount} points to ${recipientUsername}.</p>`;
            pageContentDiv.innerHTML += `<p>Your new balance: ${newBalance}</p>`;
            transferUsernameInput.value = "";
            transferAmountInput.value = "";

            // Update welcome message and balance ranking
            chrome.runtime.sendMessage({ action: "getAllUsersBalances", username: currentUserUid }, rankResponse => {
              if (rankResponse.success) {
                const userRank = rankResponse.balances.findIndex(user => user.uid === currentUserUid) + 1;
                updateWelcomeMessage(newBalance, userRank);
                showBalanceRanking(currentUserUid);
              }
            });
          } else {
            pageContentDiv.innerHTML += `<p>Error transferring points: ${response.error}</p>`;
          }
          enableButtons();
          hideLoading();
        });
      });
    } else {
      pageContentDiv.innerHTML += "<p>Please enter a valid recipient username and amount.</p>";
    }
  });
});