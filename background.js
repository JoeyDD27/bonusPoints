// background.js
import { NOTION_API_SECRET } from './apikey.js';
import { DATABASE_ID_BASE, DATABASE_ID_INVITATIONCODE, DATABASE_ID_TRANSFER } from './config.js';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkInvitationCode") {
    checkInvitationCode(request.invitationCode)
      .then(isValid => {
        sendResponse({ valid: isValid });
      })
      .catch(error => {
        console.error("Error checking invitation code:", error);
        sendResponse({ valid: false, error: error.message });
      });
    return true;
  } else if (request.action === "registerUser") {
    checkUsernameExists(request.username)
      .then(exists => {
        if (exists) {
          sendResponse({ success: false, error: "Username already exists" });
        } else {
          return registerUser(request.username, request.password, request.invitationCode);
        }
      })
      .then(registeredContent => {
        if (registeredContent) {
          sendResponse({ success: true, content: registeredContent });
        }
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === "checkUsername") {
    checkUsernameExists(request.username)
      .then(exists => {
        sendResponse({ exists: exists });
      })
      .catch(error => {
        console.error("Error checking username:", error);
        sendResponse({ exists: false, error: error.message });
      });
    return true;
  } else if (request.action === "loginUser") {
    loginUser(request.username, request.password)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === "getAllUsersBalances") {
    getAllUsersBalances(request.username)
      .then(result => sendResponse({ success: true, ...result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === "changeNickname") {
    changeNickname(request.uid, request.newNickname)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === "transferPoints") {
    transferPoints(request.senderUid, request.recipientUsername, request.amount)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function registerUser(username, password, invitationCode) {
  try {
    const isValidCode = await checkInvitationCode(invitationCode);
    if (!isValidCode) {
      throw new Error("Invalid or already used invitation code");
    }

    const response = await fetch(`https://api.notion.com/v1/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_SECRET}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { database_id: DATABASE_ID_BASE },
        properties: {
          uid: {
            title: [
              {
                text: {
                  content: 'U' + new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(/[\/,\s]/g, '').replace(/:/g, '')
                }
              }
            ]
          },
          username: {
            rich_text: [
              {
                text: {
                  content: username
                }
              }
            ]
          },
          nickname: {
            rich_text: [
              {
                text: {
                  content: username
                }
              }
            ]
          },
          password: {
            rich_text: [
              {
                text: {
                  content: password
                }
              }
            ]
          },
          balance: {
            number: 100
          },
          invitationCode: {
            number: parseInt(invitationCode, 10)
          },
          lastCheckInDate: {
            date: {
              start: "2000-01-01"
            }
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Update invitation code status
    const invitationCodePage = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID_INVITATIONCODE}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_SECRET}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          property: "invitationCode",
          number: {
            equals: parseInt(invitationCode, 10)
          }
        }
      })
    });

    if (!invitationCodePage.ok) {
      throw new Error(`HTTP error! status: ${invitationCodePage.status}`);
    }

    const invitationCodeData = await invitationCodePage.json();

    if (invitationCodeData.results.length > 0) {
      const updateResponse = await fetch(`https://api.notion.com/v1/pages/${invitationCodeData.results[0].id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_API_SECRET}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            isUsed: {
              checkbox: true
            }
          }
        })
      });

      if (!updateResponse.ok) {
        throw new Error(`HTTP error! status: ${updateResponse.status}`);
      }
    }

    return { success: true, content: data };
  } catch (error) {
    console.error("Error registering user:", error);
    return { success: false, error: error.message };
  }
}

async function checkInvitationCode(invitationCode) {
  const numericInvitationCode = parseInt(invitationCode, 10);
  if (isNaN(numericInvitationCode)) {
    throw new Error("Invalid invitation code");
  }

  const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID_INVITATIONCODE}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_API_SECRET}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filter: {
        and: [
          {
            property: "invitationCode",
            number: {
              equals: numericInvitationCode
            }
          },
          {
            property: "isUsed",
            checkbox: {
              equals: false
            }
          }
        ]
      }
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.results.length > 0;
}

async function checkUsernameExists(username) {
  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID_BASE}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_SECRET}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          property: 'username',
          rich_text: {
            equals: username
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.results.length > 0;
  } catch (error) {
    console.error("Error checking username:", error);
    throw error;
  }
}

async function loginUser(username, password) {
  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID_BASE}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_SECRET}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          and: [
            {
              property: 'username',
              rich_text: {
                equals: username
              }
            },
            {
              property: 'password',
              rich_text: {
                equals: password
              }
            }
          ]
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.results.length > 0) {
      const userInfo = data.results[0].properties;
      const userId = data.results[0].id;

      // Check if the user is locked
      if (userInfo.locked && userInfo.locked.checkbox) {
        return { success: false, error: "Account is locked. Please contact support." };
      }

      const lastCheckInDate = userInfo.lastCheckInDate.date ? new Date(userInfo.lastCheckInDate.date.start) : new Date(0);
      const beijingNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
      const isSameDay = lastCheckInDate.getFullYear() === beijingNow.getFullYear() &&
        lastCheckInDate.getMonth() === beijingNow.getMonth() &&
        lastCheckInDate.getDate() === beijingNow.getDate();
      let checkedIn = false;
      if (!isSameDay) {
        // Update balance and lastCheckInDate
        const updateResponse = await fetch(`https://api.notion.com/v1/pages/${userId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${NOTION_API_SECRET}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            properties: {
              balance: {
                number: userInfo.balance.number + 1
              },
              lastCheckInDate: {
                date: {
                  start: beijingNow.toISOString()
                }
              }
            }
          })
        });

        if (!updateResponse.ok) {
          throw new Error(`HTTP error! status: ${updateResponse.status}`);
        }

        checkedIn = true;
      }

      // Get all users' balances to calculate rank
      const allUsersResponse = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID_BASE}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_API_SECRET}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sorts: [
            {
              property: 'balance',
              direction: 'descending'
            }
          ]
        })
      });

      if (!allUsersResponse.ok) {
        throw new Error(`HTTP error! status: ${allUsersResponse.status}`);
      }

      const allUsersData = await allUsersResponse.json();
      let userRank = 1;
      let prevBalance = null;

      for (let i = 0; i < allUsersData.results.length; i++) {
        const currentBalance = allUsersData.results[i].properties.balance.number;
        if (prevBalance !== null && currentBalance < prevBalance) {
          userRank = i + 1;
        }
        if (allUsersData.results[i].id === userId) {
          break;
        }
        prevBalance = currentBalance;
      }

      return {
        success: true,
        balance: checkedIn ? userInfo.balance.number + 1 : userInfo.balance.number,
        username: username,
        nickname: userInfo.nickname.rich_text[0].text.content,
        uid: userInfo.uid.title[0].text.content,
        checkedIn: checkedIn,
        rank: userRank
      };
    } else {
      return { success: false, error: "Invalid username or password" };
    }
  } catch (error) {
    console.error("Error logging in:", error);
    return { success: false, error: error.message };
  }
}

async function getAllUsersBalances(currentUsername) {
  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID_BASE}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_SECRET}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          property: 'balance',
          number: {
            is_not_empty: true
          }
        },
        sorts: [
          {
            property: 'balance',
            direction: 'descending'
          }
        ],
        page_size: 200
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      balances: data.results.map(result => ({
        nickname: result.properties.nickname.rich_text[0].text.content,
        balance: result.properties.balance.number,
        uid: result.properties.uid.title[0].text.content
      })),
      currentUser: currentUsername
    };
  } catch (error) {
    console.error("Error fetching user balances:", error);
    throw error;
  }
}

async function changeNickname(uid, newNickname) {
  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID_BASE}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_SECRET}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          property: 'uid',
          title: {
            equals: uid
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.results.length > 0) {
      const userId = data.results[0].id;

      const updateResponse = await fetch(`https://api.notion.com/v1/pages/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_API_SECRET}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            nickname: {
              rich_text: [
                {
                  text: {
                    content: newNickname
                  }
                }
              ]
            }
          }
        })
      });

      if (!updateResponse.ok) {
        throw new Error(`HTTP error! status: ${updateResponse.status}`);
      }

      return { success: true };
    } else {
      return { success: false, error: "User not found" };
    }
  } catch (error) {
    console.error("Error changing nickname:", error);
    return { success: false, error: error.message };
  }
}

async function transferPoints(senderUid, recipientUsername, amount) {
  try {
    console.log("Starting transfer process...");
    // Get sender's information
    const senderResponse = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID_BASE}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_SECRET}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          property: 'uid',
          title: {
            equals: senderUid
          }
        }
      })
    });

    if (!senderResponse.ok) {
      throw new Error(`HTTP error! status: ${senderResponse.status}`);
    }

    const senderData = await senderResponse.json();
    if (senderData.results.length === 0) {
      return { success: false, error: "Sender not found" };
    }

    const sender = senderData.results[0];
    const senderBalance = sender.properties.balance.number;

    if (senderBalance < amount) {
      return { success: false, error: "Insufficient balance" };
    }

    console.log("Sender found and has sufficient balance");

    // Get recipient's information
    const recipientResponse = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID_BASE}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_SECRET}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          property: 'username',
          rich_text: {
            equals: recipientUsername
          }
        }
      })
    });

    if (!recipientResponse.ok) {
      throw new Error(`HTTP error! status: ${recipientResponse.status}`);
    }

    const recipientData = await recipientResponse.json();
    if (recipientData.results.length === 0) {
      return { success: false, error: "Recipient not found" };
    }

    const recipient = recipientData.results[0];

    console.log("Recipient found");

    const senderNewBalance = senderBalance - amount;
    const receiverNewBalance = recipient.properties.balance.number + amount;

    // Update sender's balance
    await fetch(`https://api.notion.com/v1/pages/${sender.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_API_SECRET}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          balance: {
            number: senderNewBalance
          }
        }
      })
    });

    console.log("Sender's balance updated");

    // Update recipient's balance
    await fetch(`https://api.notion.com/v1/pages/${recipient.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_API_SECRET}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          balance: {
            number: receiverNewBalance
          }
        }
      })
    });

    console.log("Recipient's balance updated");

    // Write transaction record
    console.log("Creating transaction record...");
    const now = new Date();
    const tid = 't' + now.getFullYear().toString().slice(-2) +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0') +
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0');

    const transactionResponse = await fetch(`https://api.notion.com/v1/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_SECRET}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { database_id: DATABASE_ID_TRANSFER },
        properties: {
          tid: {
            title: [
              {
                text: {
                  content: tid
                }
              }
            ]
          },
          sender: {
            rich_text: [
              {
                text: {
                  content: sender.properties.username.rich_text[0].text.content
                }
              }
            ]
          },
          receiver: {
            rich_text: [
              {
                text: {
                  content: recipientUsername
                }
              }
            ]
          },
          amount: {
            number: amount
          },
          senderNewBalance: {
            number: senderNewBalance
          },
          receiverNewBalance: {
            number: receiverNewBalance
          }
        }
      })
    });

    if (!transactionResponse.ok) {
      const errorText = await transactionResponse.text();
      console.error("Error creating transaction record. Status:", transactionResponse.status);
      console.error("Error details:", errorText);
      throw new Error(`HTTP error! status: ${transactionResponse.status}, details: ${errorText}`);
    }

    const transactionData = await transactionResponse.json();
    console.log("Transaction record created successfully:", transactionData);

    return { success: true };
  } catch (error) {
    console.error("Error transferring points:", error);
    return { success: false, error: error.message };
  }
}

function getInvitationCode() {
  return INVITATION_CODE;
}