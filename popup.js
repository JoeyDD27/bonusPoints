document.addEventListener('DOMContentLoaded', function () {
  const readNotionButton = document.getElementById('readNotionButton');
  if (readNotionButton) readNotionButton.addEventListener('click', readNotionData);
});

function readNotionData() {
  chrome.runtime.sendMessage({ action: "readNotion" }, function (response) {
    if (response.success) {
      displayNotionData(response.data);
    } else {
      alert('Failed to read Notion data: ' + response.message);
    }
  });
}

function displayNotionData(data) {
  const dataContainer = document.getElementById('notionData');
  dataContainer.innerHTML = '';

  const list = document.createElement('ul');
  data.forEach(username => {
    const li = document.createElement('li');
    li.textContent = username;
    list.appendChild(li);
  });

  dataContainer.appendChild(list);
}