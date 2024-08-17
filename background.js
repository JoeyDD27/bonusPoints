import { NOTION_API_KEY } from './config.js';

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "readNotion") {
    handleReadNotion(sendResponse);
    return true; // Indicates we will respond asynchronously
  }
});

function handleReadNotion(sendResponse) {
  const NOTION_DATABASE_ID = 'ec7c4890730248ff8181b40c95c661d1';

  fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sorts: [
        {
          property: "username",
          direction: "ascending"
        }
      ]
    })
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data && data.results && Array.isArray(data.results)) {
        const processedData = processNotionData(data.results);
        sendResponse({ success: true, data: processedData });
      } else {
        throw new Error('Unexpected API response structure');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      sendResponse({ success: false, message: 'Failed to fetch Notion data: ' + error.message });
    });
}

function processNotionData(results) {
  return results.map(row => {
    const usernameProperty = row.properties.username;
    return usernameProperty?.title?.[0]?.plain_text || 'No username';
  }).filter(username => username !== 'No username');
}