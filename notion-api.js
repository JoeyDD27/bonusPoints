import { NOTION_API_KEY } from './apiKey.js';
const DATABASE_ID = 'ec7c4890730248ff8181b40c95c661d1';

function fetchNotionDatabase() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: "fetchNotionDatabase", databaseId: DATABASE_ID },
      response => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.data);
        }
      }
    );
  });
}

export { fetchNotionDatabase };