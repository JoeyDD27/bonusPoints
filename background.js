// background.js
import { NOTION_API_SECRET } from './apikey.js';
import { DATABASE_ID_BASE, DATABASE_ID_ACTIVATIONCODE } from './config.js';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkActivationCode") {
    checkActivationCode(request.activationCode)
      .then(isValid => {
        sendResponse({ valid: isValid });
      })
      .catch(error => {
        console.error("Error checking activation code:", error);
        sendResponse({ valid: false, error: error.message });
      });
    return true;
  } else if (request.action === "registerUser") {
    checkUsernameExists(request.username)
      .then(exists => {
        if (exists) {
          sendResponse({success: false, error: "Username already exists"});
        } else {
          return registerUser(request.username, request.password, request.activationCode);
        }
      })
      .then(registeredContent => {
        if (registeredContent) {
          sendResponse({success: true, content: registeredContent});
        }
      })
      .catch(error => sendResponse({success: false, error: error.message}));
    return true;
  } else if (request.action === "checkUsername") {
    checkUsernameExists(request.username)
      .then(exists => {
        sendResponse({exists: exists});
      })
      .catch(error => {
        console.error("Error checking username:", error);
        sendResponse({exists: false, error: error.message});
      });
    return true;
  } else if (request.action === "loginUser") {
    loginUser(request.username, request.password)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true;
  } else if (request.action === "getAllUsersBalances") {
    getAllUsersBalances(request.username)
      .then(result => sendResponse({success: true, ...result}))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true;
  }
});

async function registerUser(username, password, activationCode) {
  try {
    const isValidCode = await checkActivationCode(activationCode);
    if (!isValidCode) {
      throw new Error("Invalid or already used activation code");
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
          activationCode: {
            number: parseInt(activationCode, 10)
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

    // Update activation code status
    const activationCodePage = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID_ACTIVATIONCODE}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_SECRET}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          property: "activationCode",
          number: {
            equals: parseInt(activationCode, 10)
          }
        }
      })
    });

    if (!activationCodePage.ok) {
      throw new Error(`HTTP error! status: ${activationCodePage.status}`);
    }

    const activationCodeData = await activationCodePage.json();

    if (activationCodeData.results.length > 0) {
      const updateResponse = await fetch(`https://api.notion.com/v1/pages/${activationCodeData.results[0].id}`, {
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

async function checkActivationCode(activationCode) {
  const numericActivationCode = parseInt(activationCode, 10);
  if (isNaN(numericActivationCode)) {
    throw new Error("Invalid activation code");
  }

  const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID_ACTIVATIONCODE}/query`, {
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
            property: "activationCode",
            number: {
              equals: numericActivationCode
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
      const lastCheckInDate = userInfo.lastCheckInDate.date ? new Date(userInfo.lastCheckInDate.date.start) : new Date(0);
      const beijingNow = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
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
      const userRank = allUsersData.results.findIndex(user => user.id === userId) + 1;

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

function getActivationCode() {
  return ACTIVATION_CODE;
}